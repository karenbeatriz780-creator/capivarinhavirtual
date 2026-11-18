// 📄 Relatório para a Efí (pedido de informações sobre MED / contestações).
// Roda em segundo plano (pode demorar uns minutos): puxa da Efí TODOS os Pix recebidos no período,
// as devoluções de cada um e as infrações MED (com o motivo), liga cada Pix ao pedido do site
// (produto, cliente, data da entrega, link entregue) e salva o resultado em gastos/relatorio_efi.
// POST {inicio?:'AAAA-MM-DD', fim?:'AAAA-MM-DD'}  (senha de administrador em x-admin-key)
import { getStore } from '@netlify/blobs';
import { obterToken, efiRequest, erroEfi, aplicarPagamento } from './_efi.mjs';
import { entregarPago } from './_email.mjs';

const SITE = 'https://capivarinhalove.com.br';
const DIA = 864e5, PASSO = 5 * DIA; // a Efí aceita períodos curtos: vai de 5 em 5 dias

async function listar(caminho, campo, token, ini, fim, avisos) {
  const todos = [];
  for (let t = ini; t < fim; t += PASSO) {
    const a = new Date(t), b = new Date(Math.min(fim, t + PASSO));
    for (let pag = 0; pag < 60; pag++) {
      const q = '?inicio=' + encodeURIComponent(a.toISOString()) + '&fim=' + encodeURIComponent(b.toISOString()) +
        '&paginacao.paginaAtual=' + pag + '&paginacao.itensPorPagina=100';
      const r = await efiRequest(caminho + q, { token });
      if (!r.ok || !r.data) { avisos.push(caminho + ' (' + a.toISOString().slice(0, 10) + '): ' + erroEfi(r.data, r.status)); if (r.status === 403 || r.status === 401) return { itens: todos, negado: true }; break; }
      const lista = Array.isArray(r.data[campo]) ? r.data[campo] : [];
      todos.push(...lista);
      const tot = r.data.parametros && r.data.parametros.paginacao && r.data.parametros.paginacao.quantidadeDePaginas;
      if (!tot || pag + 1 >= tot || !lista.length) break;
    }
  }
  return { itens: todos, negado: false };
}

const nomePagador = (p) => (p.gnExtras && p.gnExtras.pagador && p.gnExtras.pagador.nome) || (p.pagador && p.pagador.nome) || '';
const ehLivro = (g) => g.produto === 'livro' || !!g.livro;
const temMus = (g) => !!(g.musicaPreviewUrl || g.musicaPreviewId || (g.ofertaM1 && g.ofertaM1.url) || (g.musica && (g.musica.url || g.musica.taskId || typeof g.musica === 'string')));
const NOMES = { carta: 'Carta digital personalizada', convite: 'Convite digital personalizado', jogo: 'Jogo/quiz digital personalizado', relampago: 'Presente digital personalizado',
  presente: 'Presente digital personalizado (página com fotos e mensagem)', completo: 'Presente digital personalizado + música' };
function produto(g) {
  if (!g) return '';
  if (ehLivro(g)) return 'Livro infantil personalizado + músicas';
  const pr = String(g.produto || '');
  if (pr.startsWith('extra')) return 'Item extra do pedido (' + pr.replace('extra_', '') + ')';
  if (pr === 'musica' || (!NOMES[pr] && temMus(g))) return 'Música personalizada (' + (g.quatro ? '4 versões' : '2 versões') + ')';
  return NOMES[pr] || 'Presente digital personalizado';
}
function linkEntrega(g) {
  if (!g) return '';
  if (ehLivro(g)) return SITE + '/#/livro/' + g.id;
  if (String(g.produto || '').startsWith('extra') && g.refPresente) return SITE + '/#/p/' + g.refPresente + '/c';
  return SITE + '/#/p/' + g.id + (g.produto === 'musica' || temMus(g) ? '/c' : '');
}
function entregue(g) {
  if (!g || !g.pago) return false;
  if (ehLivro(g)) { const L = g.livro || {}; return L.status === 'pronto' || !!(L.capa && L.capa.ok) || (L.paginas || []).some((x) => x && x.ok) || !!g.capa; }
  if (g.produto === 'musica') return temMus(g);
  return true; // presente / carta / convite / jogo / extras: o produto é a própria página personalizada, liberada no pagamento
}

export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return;
  const gastos = getStore('gastos');
  let b = {}; try { b = await req.json(); } catch (e) {}
  const fim = b.fim ? Date.parse(b.fim + 'T23:59:59-03:00') : Date.now();
  const testes = new Set((Array.isArray(b.testes) ? b.testes : []).map((x) => String(x).trim()).filter((x) => /^[A-Za-z0-9_-]{4,80}$/.test(x)));
  const liberados = [];
  const marcados = new Set((Array.isArray(b.contestados) ? b.contestados : []).map((x) => String(x).trim()).filter((x) => /^E[0-9A-Za-z]{20,40}$/.test(x)));
  const ini = b.inicio ? Date.parse(b.inicio + 'T00:00:00-03:00') : fim - 120 * DIA;
  await gastos.setJSON('relatorio_efi', { status: 'gerando', inicio: ini, fim, em: Date.now() });
  try {
    const token = await obterToken(), avisos = [];
    const rp = await listar('/v2/pix', 'pix', token, ini, fim, avisos);
    const ri = await listar('/v2/gn/infracoes', 'infracoes', token, ini, fim, avisos);
    const infPorE2e = {};
    ri.itens.forEach((x) => { if (x.endToEndId) (infPorE2e[x.endToEndId] = infPorE2e[x.endToEndId] || []).push(x); });

    const txs = getStore('efi-txid'), presentes = getStore('presentes');
    const linhas = [];
    for (const p of rp.itens) {
      let g = null;
      if (p.txid) {
        const m = await txs.get(p.txid, { type: 'json' }).catch(() => null);
        if (m && m.giftId) g = await presentes.get(m.giftId, { type: 'json' }).catch(() => null);
      }
      const devs = (p.devolucoes || []).map((d) => ({ valor: d.valor, status: d.status, natureza: d.natureza || '', motivo: d.motivo || d.descricao || '',
        quando: (d.horario && (d.horario.liquidacao || d.horario.solicitacao)) || '' }));
      const infs = (infPorE2e[p.endToEndId] || []).map((x) => ({ id: x.idInfracao, status: x.status, razao: x.razao || '', tipoSituacao: x.tipoSituacao || '',
        tipoFraude: x.tipoFraude || '', comentario: x.comentario || '', aberta: (x.dadosAnalise && x.dadosAnalise.abertura) || x.criadoEm || '', defesa: x.defesa || '' }));
      // Pix recebido na Efí mas o pedido não ficou como pago (aviso perdido) → libera e entrega AGORA
      if (g && !g.pago && !g.cancelado) {
        try { aplicarPagamento(g, { e2eid: p.endToEndId, valor: p.valor }, 'relatorio-efi'); await presentes.setJSON(g.id, g); liberados.push(g.id); await entregarPago(g).catch(() => {}); } catch (e) {}
      }
      const ehTeste = !!(g && (testes.has(g.id) || /\bteste?\b/i.test(String(g.meuNome || '') + ' ' + String(g.musicaParaNome || '')))) || (Number(p.valor) || 0) <= 1;
      linhas.push({
        teste: ehTeste,
        e2e: p.endToEndId || '', txid: p.txid || '', valor: Number(p.valor) || 0, pagoEm: p.horario || '', pagador: nomePagador(p),
        pedido: g ? g.id : '', produto: produto(g), cliente: g ? (g.meuNome || '') : '', para: g ? (g.musicaParaNome || g.nome || g.parceiroNome || '') : '',
        entregue: entregue(g), entregueEm: g ? (g.pagoEm || null) : null, link: linkEntrega(g), canceladoSite: !!(g && g.cancelado),
        diag: g && !entregue(g) ? { produto: g.produto || '(vazio)', pago: !!g.pago, cancelado: !!g.cancelado, livro: g.livro ? (g.livro.status || '?') : null,
          campos: Object.keys(g).filter((k) => /musica|livro|oferta|url|pagin|capa|foto|pdf/i.test(k)).slice(0, 14) } : null,
        devolucoes: devs, infracoes: infs, informado: marcados.has(p.endToEndId), contestado: devs.length > 0 || infs.length > 0 || marcados.has(p.endToEndId)
      });
    }
    // infrações de Pix que não vieram na lista (fora do período da lista)
    // o responsável declarou: pedidos pagos sem entrega detectada (depois da liberação automática acima) são testes dele
    if (b.pendTeste) linhas.forEach((l) => { if (l.pedido && !l.entregue) l.teste = true; });
    const vistos = new Set(linhas.map((l) => l.e2e));
    const infSoltas = ri.itens.filter((x) => !vistos.has(x.endToEndId)).map((x) => ({ e2e: x.endToEndId, valor: Number(x.valor) || 0, data: x.dataTransacao || '', status: x.status, razao: x.razao || '', comentario: x.comentario || '' }));
    linhas.sort((a, c) => String(c.pagoEm).localeCompare(String(a.pagoEm)));
    const contest = linhas.filter((l) => l.contestado);
    const resumo = {
      pagamentos: linhas.length, valorTotal: +linhas.reduce((s, l) => s + l.valor, 0).toFixed(2),
      ligados: linhas.filter((l) => l.pedido).length, entregues: linhas.filter((l) => l.entregue).length,
      contestados: contest.length, valorContestado: +contest.reduce((s, l) => s + l.valor, 0).toFixed(2),
      percentual: linhas.length ? +(contest.length * 100 / linhas.length).toFixed(2) : 0,
      contestadosEntregues: contest.filter((l) => l.entregue).length,
      semPedido: linhas.filter((l) => !l.pedido).length,
      liberadosAgora: liberados, testes: linhas.filter((l) => l.teste).length,
      pendentes: linhas.filter((l) => l.pedido && !l.teste && !l.entregue).slice(0, 40).map((l) => ({ pedido: l.pedido, valor: l.valor, pagoEm: l.pagoEm, produto: l.produto, link: l.link, diag: l.diag })),
      naoEntreguesPorTipo: linhas.filter((l) => l.diag).reduce((o, l) => { const k = l.diag.produto + (l.diag.livro ? ' / livro ' + l.diag.livro : '') + (l.diag.pago ? '' : ' / não pago no site'); o[k] = (o[k] || 0) + 1; return o; }, {}), informadosNaoAchados: [...marcados].filter((x) => !vistos.has(x)),
      reembolsosPeloSite: linhas.filter((l) => l.canceladoSite).length,
      infracoesMED: ri.itens.length, medLiberado: !ri.negado
    };
    await gastos.setJSON('relatorio_efi', { status: 'pronto', versao: 2, inicio: ini, fim, em: Date.now(), resumo, linhas, infSoltas, avisos: avisos.slice(0, 8) });
  } catch (e) {
    await gastos.setJSON('relatorio_efi', { status: 'erro', erro: String(e && e.message || e), inicio: ini, fim, em: Date.now() });
  }
};
