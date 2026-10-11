import { getStore } from '@netlify/blobs';
import { obterToken, conferirPagamentoEfi, aplicarPagamento, listarPixRecebidos } from './_efi.mjs';
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
    const { blobs } = await store.list();

    // Antes isso buscava um registro de cada vez, esperando um terminar pra
    // começar o próximo — com centenas de pedidos salvos, essa fila serial
    // é o motivo do painel travar/demorar pra abrir. Buscando todos em
    // paralelo, o tempo de carregamento não cresce junto com a quantidade
    // de pedidos.
    const registros = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));

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
    if (pendentes.length && resta() > 2500) {
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
        cancelado: !!g.cancelado,
        criadoEm: g.criadoEm || null,
        pagoEm: g.pagoEm || null,
        meuNome: g.meuNome || '',
        parceiroNome: g.parceiroNome || '',
        musicaOn: !!g.musicaOn,
        musicaPreviewUrl: g.musicaPreviewUrl || null,
        musicaPreviewUrl2: g.musicaPreviewUrl2 || null,
        whatsapp: g.musicaWhatsapp || ''
      });
    }

    pedidos.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    return json({ ok: true, pedidos, liberadosAgora, faltamConferir });
  } catch (e) {
    console.error('admin-pedidos (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
