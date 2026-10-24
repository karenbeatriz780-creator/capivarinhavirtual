import { getStore } from '@netlify/blobs';
import { obterToken, conferirPagamentoEfi, aplicarPagamento, listarPixRecebidos } from './_efi.mjs';
import { lerIndice, lerDias, idsDosDias, diaBR } from './_indice.mjs';
// ATENÇÃO: este arquivo precisa ser .mjs. Não deixe um admin-pedidos.js junto na pasta.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function autorizado(req) {
  // Painel aberto: leitura liberada pra quem tem o link (sem senha).
  // As ações de cancelar / marcar como pago continuam exigindo a senha.
  return true;
}

export default async (req) => {
  const t0 = Date.now(); // tudo precisa terminar em ~7s, senão o painel não abre
  try {
    if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);

    const store = getStore('presentes');
    // ?dias=N → só os pedidos dos últimos N dias (abre rápido). Sem isso, carrega tudo.
    const nDias = Math.max(0, Math.min(60, parseInt(new URL(req.url).searchParams.get('dias'), 10) || 0));
    const idxDias = await lerDias();
    let blobs, parcial = false;
    if (nDias && idxDias && idxDias.dias) {
      blobs = idsDosDias(idxDias, nDias, 'p').map((key) => ({ key }));
      parcial = true;
    } else {
      blobs = (await store.list()).blobs;
    }

    // Antes isso buscava um registro de cada vez, esperando um terminar pra
    // começar o próximo — com centenas de pedidos salvos, essa fila serial
    // é o motivo do painel travar/demorar pra abrir. Buscando todos em
    // paralelo, o tempo de carregamento não cresce junto com a quantidade
    // de pedidos.
    const registros = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)));

    // Plano B do webhook: confere na Efí os pedidos pendentes dos últimos 3 dias.
    // Faz isso com limite de tempo (~6s) pra o painel nunca estourar o tempo do
    // Netlify: a cada atualização confere primeiro os que estão há mais tempo
    // sem conferir, então em poucas atualizações todos passam pela checagem.
    const TRES_DIAS = 3 * 24 * 3600 * 1000, agora = Date.now();
    const resta = () => 7000 - (Date.now() - t0);
    const pendentes = registros
      .filter((g) => g && !g.pago && !g.cancelado && g.pagamento && g.pagamento.provedor === 'efi' && g.pagamento.txid && (!g.criadoEm || agora - g.criadoEm < TRES_DIAS))
      .sort((x, y) => ((x.pagamento.efiConferidoEm || 0) - (y.pagamento.efiConferidoEm || 0)) || ((y.criadoEm || 0) - (x.criadoEm || 0)));
    let liberadosAgora = 0, conferidos = 0;
    const comLimite = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('tempo'), Math.max(0, ms)))]);
    // ?conferir=0 → só lista (o painel abre na hora); a conferência na Efí
    // roda numa segunda chamada, em segundo plano.
    const conferir = new URL(req.url).searchParams.get('conferir') !== '0';
    if (conferir && pendentes.length && resta() > 2500) {
      try {
        const token = await comLimite(obterToken(), Math.min(3000, resta() - 1500));
        if (token && token !== 'tempo') {
          // 1) Jeito rápido: pega a lista de TODOS os Pix que caíram na conta nos
          //    últimos 3 dias e libera os pedidos ligados a eles (pelo txid).
          try {
            const pixes = await comLimite(listarPixRecebidos(token, new Date(agora - TRES_DIAS), new Date(agora + 60000)), Math.min(4000, resta() - 1500));
            if (Array.isArray(pixes) && pixes.length) {
              const porId = {}; registros.forEach((g) => { if (g && g.id) porId[g.id] = g; });
              const txStore = getStore('efi-txid');
              await Promise.all(pixes.filter((p) => p && p.txid).map(async (p) => {
                try {
                  const mapa = await txStore.get(p.txid, { type: 'json' });
                  const g = mapa && mapa.giftId && porId[mapa.giftId];
                  if (!g || g.pago || g.cancelado) return;
                  aplicarPagamento(g, { e2eid: p.endToEndId || null, valor: p.valor || null }, 'lista-pix-painel');
                  if (p.horario) { const h = Date.parse(p.horario); if (h) { g.pagoEm = h; g.pagamento.pagoEm = h; } }
                  liberadosAgora++;
                  await store.setJSON(g.id, g);
                } catch (e) { console.error('admin-pedidos: lista pix', p.txid, e && e.message); }
              }));
            }
          } catch (e) { console.error('admin-pedidos: listar pix', e && e.message); }

          // 2) Reforço: confere um a um os pendentes que sobraram (com limite de tempo).
          const aindaPendentes = pendentes.filter((g) => !g.pago);
          pendentes.length = 0; pendentes.push(...aindaPendentes);
          for (let i = 0; i < pendentes.length && resta() > 1800; i += 8) {
            await Promise.all(pendentes.slice(i, i + 8).map(async (g) => {
              try {
                const info = await comLimite(conferirPagamentoEfi(g, token), Math.min(2500, resta() - 800));
                if (info === 'tempo') return;
                conferidos++;
                if (info) { aplicarPagamento(g, info, 'consulta-painel'); liberadosAgora++; }
                else { g.pagamento.efiConferidoEm = Date.now(); }
                await comLimite(store.setJSON(g.id, g), Math.max(300, resta() - 300));
              } catch (e) { console.error('admin-pedidos: conferir', g.id, e && e.message); }
            }));
          }
        }
      } catch (e) { console.error('admin-pedidos: token Efí', e && e.message); }
    }
    const faltamConferir = Math.max(0, pendentes.length - conferidos);

    // mantém o índice de telefones (Meus presentes) em dia: remonta em segundo plano a cada 6h
    try {
      const idx = await lerIndice();
      if (!idx || !idx.montadoEm || Date.now() - idx.montadoEm > 6 * 3600 * 1000) {
        const base = new URL(req.url).origin;
        await Promise.race([fetch(base + '/.netlify/functions/indexar-telefones-background', { method: 'POST' }).catch(() => null), new Promise((r) => setTimeout(r, 1500))]);
      }
    } catch (e) {}
    // cópia de segurança das músicas pagas: roda a cada 3 h
    try {
      const bk = await getStore('indices').get('audios-backup', { type: 'json' }).catch(() => null);
      if (!bk || Date.now() - (bk.em || 0) > 3 * 3600 * 1000) {
        const base = new URL(req.url).origin;
        await Promise.race([fetch(base + '/.netlify/functions/guardar-audios-background', { method: 'POST' }).catch(() => null), new Promise((r) => setTimeout(r, 1200))]);
      }
    } catch (e) {}

    const pedidos = [];
    for (const g of registros) {
      if (!g) continue;
      pedidos.push({
        id: g.id,
        produto: g.produto,
        duracao: g.pagamento && g.pagamento.duracao || g.duracao || 'vitalicio',
        valor: g.pagamento ? g.pagamento.valor : 0,
        provedor: g.pagamento ? g.pagamento.provedor : null,
        pago: !!g.pago,
        trafego: (g.trafego && g.trafego.fonte) || null,
        cortesia: !!g.cortesia,
        comboDaMusica: !!g.comboDaMusica, quatro: !!g.quatro, dobroDe: g.dobroDe || null, dobroUsado: g.dobroUsado || null,
        cancelado: !!g.cancelado,
        criadoEm: g.criadoEm || null,
        pagoEm: g.pagoEm || null,
        meuNome: g.meuNome || '',
        parceiroNome: g.parceiroNome || '',
        musicaOn: !!g.musicaOn,
        musicaPreviewUrl: g.musicaPreviewUrl || null,
        musicaPreviewUrl2: g.musicaPreviewUrl2 || null,
        whatsapp: g.musicaWhatsapp || '',
        // Dados da música pedida — o painel usa pra mostrar/copiar a letra e
        // pra gerar uma nova versão seguindo o mesmo pedido do cliente.
        musicaPreviewId: g.musicaPreviewId || null,
        letra: g.musicaLetraTexto || g.musicaLetra || null,
        musicaEstilo: g.musicaEstilo || '',
        musicaEstiloOutro: g.musicaEstiloOutro || '',
        musicaClima: g.musicaClima || '',
        musicaPara: g.musicaPara || '',
        musicaOcasiao: g.musicaOcasiao || '',
        musicaParaNome: g.musicaParaNome || '',
        musicaFrase: g.musicaFrase || '',
        musicaVoz: g.musicaVoz || '',
        musicaHistoria: String(g.musicaTexto || '').slice(0, 1500),
        ofertaDe: g.ofertaDe || null,
        refDe: g.refDe || null,
        bonusDe: g.bonusDe || null,
        ofertaLiberadaAte: g.ofertaLiberadaAte || null,
        pacote6: !!g.pacote6,
        ofertaM2: g.ofertaM2 ? { url: g.ofertaM2.url || null, url2: g.ofertaM2.url2 || null, id: g.ofertaM2.id || null, letra: g.ofertaM2.letra || null, estilo: g.ofertaM2.estilo || '', paraNome: g.ofertaM2.paraNome || '' } : null,
        ofertaM1: g.ofertaM1 ? { url: g.ofertaM1.url || null, url2: g.ofertaM1.url2 || null, id: g.ofertaM1.id || null, letra: g.ofertaM1.letra || null, estilo: g.ofertaM1.estilo || '', paraNome: g.ofertaM1.paraNome || '' } : null
      });
    }

    pedidos.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    // custos por dia (músicas geradas e letras escritas) — últimos 14 dias
    const custos = {};
    if (idxDias && idxDias.dias) {
      for (let i = 0; i < 14; i++) {
        const d = diaBR(Date.now() - i * 86400000), e = idxDias.dias[d];
        custos[d] = { m: e && e.t ? e.t.length : 0, l: (e && e.l) || 0 };
      }
    }
    let resumo = null;
    try { resumo = await getStore('indices').get('receita', { type: 'json' }); } catch (e) {}
    return json({ ok: true, pedidos, liberadosAgora, faltamConferir, parcial, custos, resumo, indiceEm: idxDias && idxDias.montadoEm || 0 });
  } catch (e) {
    console.error('admin-pedidos (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
