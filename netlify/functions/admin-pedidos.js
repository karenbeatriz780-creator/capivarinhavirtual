import { getStore } from '@netlify/blobs';
import { obterToken, conferirPagamentoEfi, aplicarPagamento } from './_efi.mjs';

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

    // Plano B do webhook: pedidos pendentes dos últimos 3 dias que têm cobrança
    // Pix são conferidos direto na Efí. Se o Pix caiu, o pedido é liberado aqui
    // mesmo (o cliente passa a receber o presente/música pelo link).
    const TRES_DIAS = 3 * 24 * 3600 * 1000, agora = Date.now();
    const pendentes = registros.filter((g) => g && !g.pago && !g.cancelado && g.pagamento && g.pagamento.provedor === 'efi' && g.pagamento.txid && (!g.criadoEm || agora - g.criadoEm < TRES_DIAS));
    let liberadosAgora = 0;
    if (pendentes.length) {
      try {
        const token = await obterToken();
        for (let i = 0; i < pendentes.length; i += 6) {
          await Promise.all(pendentes.slice(i, i + 6).map(async (g) => {
            try {
              const info = await conferirPagamentoEfi(g, token);
              if (info) { aplicarPagamento(g, info, 'consulta-painel'); await store.setJSON(g.id, g); liberadosAgora++; }
            } catch (e) { console.error('admin-pedidos: conferir', g.id, e && e.message); }
          }));
        }
      } catch (e) { console.error('admin-pedidos: token Efí', e && e.message); }
    }

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
        meuNome: g.meuNome || '',
        parceiroNome: g.parceiroNome || '',
        musicaOn: !!g.musicaOn,
        musicaPreviewUrl: g.musicaPreviewUrl || null,
        musicaPreviewUrl2: g.musicaPreviewUrl2 || null,
        whatsapp: g.musicaWhatsapp || ''
      });
    }

    pedidos.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    return json({ ok: true, pedidos, liberadosAgora });
  } catch (e) {
    console.error('admin-pedidos (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
