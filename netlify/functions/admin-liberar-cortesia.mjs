import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { indexar, indexarDia } from './_indice.mjs';

// PAINEL: libera uma música SEM pagamento ("de presente"/cortesia).
// O link do cliente passa a funcionar normalmente (ouvir completo + baixar),
// mas o pedido fica marcado como cortesia e NÃO entra na receita do painel.
//   POST { id: <pedido> }  ou  { t: <taskId da música> } (quem só gerou a música)
// Precisa da senha de administrador (header x-admin-key).

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
function autorizado(req) {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha) return false;
  return (req.headers.get('x-admin-key') || '') === senha;
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!autorizado(req)) return json({ erro: 'Senha incorreta.' }, 401);
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const id = String(body.id || '').trim();
    const t = String(body.t || '').trim();
    const presentes = getStore('presentes');
    const agora = Date.now();
    let g = null;

    if (id) {
      g = await presentes.get(id, { type: 'json' });
      if (!g) return json({ erro: 'Pedido não encontrado.' }, 404);
    } else if (t) {
      const musicas = getStore('musicas');
      const m = await musicas.get(t, { type: 'json' });
      if (!m || !m.url) return json({ erro: 'Essa música ainda não ficou pronta.' }, 404);
      if (m.pedidoRecId) g = await presentes.get(m.pedidoRecId, { type: 'json' });
      if (!g) {
        const novoId = 'c' + crypto.randomBytes(6).toString('hex');
        g = {
          id: novoId, produto: 'musica', duracao: 'vitalicio', musicaOn: true, criadoEm: agora,
          meuNome: '', parceiroNome: '',
          musicaParaNome: m.nomes || '',
          musicaPreviewUrl: m.url, musicaPreviewUrl2: m.url2 || null, musicaPreviewId: t,
          musicaLetra: m.letraAprovada || m.letra || null,
          musicaLetraTexto: m.letraAprovada || m.letra || null,
          musicaEstilo: m.estilo || '', musicaClima: m.clima || '', musicaPara: m.relacao || '',
          musicaOcasiao: m.ocasiao || '', musicaTexto: m.historia || '',
          musicaWhatsapp: m.whatsapp || ''
        };
        m.pedidoRecId = novoId;
        await musicas.setJSON(t, m);
      }
    } else {
      return json({ erro: 'Faltou o pedido ou a música.' }, 400);
    }

    if (g.pago && !g.cortesia) return json({ ok: true, id: g.id, jaPago: true });
    const atualizado = Object.assign({}, g, {
      pago: true, cancelado: false, cortesia: true, cortesiaEm: agora,
      quatro: (g.produto || 'musica') === 'musica' && !g.ofertaM1 && !g.pacote6 && !g.dobroDe && !g.bonusDe,
      pagoEm: g.pagoEm || agora, expiraEm: null,
      pagamento: Object.assign({}, g.pagamento || {}, {
        provedor: 'cortesia', status: 'CORTESIA', valor: 0, duracao: 'vitalicio', confirmadoEm: agora
      })
    });
    await presentes.setJSON(atualizado.id, atualizado);
    await indexar(atualizado.musicaWhatsapp, 'p', atualizado.id);
    await indexarDia('p', atualizado.id);
    return json({ ok: true, id: atualizado.id });
  } catch (e) {
    console.error('admin-liberar-cortesia:', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor.' }, 500);
  }
};
