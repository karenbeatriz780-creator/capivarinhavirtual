import { getStore } from '@netlify/blobs';
import { idsDoDia, diaBR } from './_indice.mjs';
import { enviarTexto, conversaAberta, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos, SITE, enviarModeloPago, textoIndica, entregarPedidoPagoZap } from './_zap.mjs';
import { avancarLivro, entregarLivroZap } from './_livros.mjs';

// A CADA MINUTO: quem PAGOU recebe no WhatsApp o link das músicas + os áudios completos.
// - Quem conversou com o número nas últimas 24 h → manda GRÁTIS (texto + áudios + indica e ganha).
// - Quem NÃO conversou → 1 mensagem de UTILIDADE (modelo aprovado, ~R$ 0,08) com o link e o botão
//   "Receber os áudios aqui". Se tocar/responder em até 7 dias, recebe os áudios grátis (whatsapp-webhook).
// - Quem não pagou: nada (só quem conversou recebe lembrete, de graça).
export const config = { schedule: '*/3 * * * *' };

const JANELA = 6 * 3600 * 1000; // só pedidos pagos nas últimas 6 h (não dispara pra pedidos antigos)

export default async () => {
  const loja = getStore('whatsapp'), presentes = getStore('presentes');
  const agora = Date.now();
  let ids = [];
  try { ids = (await idsDoDia(diaBR(agora), 'pg')).concat(await idsDoDia(diaBR(agora - 86400000), 'pg')); } catch (e) { return; }
  ids = [...new Set(ids)].slice(-200);
  const feitos = await Promise.all(ids.map((id) => loja.get('pago_' + id, { type: 'json' }).catch(() => null)));
  const novos = ids.filter((id, i) => !feitos[i]).slice(0, 20);
  for (const id of novos) {
    try {
      const g = await presentes.get(id, { type: 'json' }).catch(() => null);
      if (!g || !g.pago || g.cancelado) continue;
      if (agora - (g.pagoEm || 0) > JANELA) { await loja.setJSON('pago_' + id, { pulado: 'antigo', em: agora }); continue; }
      // LIVRO MÁGICO: termina de gerar as ilustrações (mesmo que a pessoa tenha fechado a tela)
      if (g.produto === 'livro') {
        let gl = g;
        try { gl = (await avancarLivro(id, process.env.URL || SITE)) || g; } catch (e) { console.error('avisar-pagos livro', id, e && e.message); }
        if (!gl.livro || gl.livro.status !== 'pronto') continue; // volta daqui a 3 min
        // número de entrega: o que tocou em "Receber no WhatsApp" (deste livro ou do principal do pacote), senão o do formulário
        let zapEnt = gl.livro.zapEntrega || '';
        if (!zapEnt && gl.pacoteDe) { const gp = await presentes.get(gl.pacoteDe, { type: 'json' }).catch(() => null); zapEnt = (gp && gp.livro && gp.livro.zapEntrega) || ''; }
        let numL = String(zapEnt || gl.whatsapp || '').replace(/\D/g, '');
        await loja.setJSON('pago_' + id, { em: agora, livro: true });
        let entregou = false;
        if (numL.length >= 10) {
          if (!numL.startsWith('55') || numL.length <= 11) numL = '55' + numL;
          const abertaL = await conversaAberta(numL);
          if (abertaL) {
            await entregarLivroZap(abertaL, gl, process.env.URL || SITE); entregou = true;
            await registrar('pago_enviado', { para: abertaL, pedido: id, nome: gl.livro.nome, via: 'livro' });
          }
        }
        // sem conversa aberta: já deixa os PDFs prontos pra quando o cliente pedir no WhatsApp
        if (!entregou && !gl.livro.pdf) await fetch((process.env.URL || SITE) + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
        continue;
      }
      if (!temMusica(g)) { await loja.setJSON('pago_' + id, { pulado: 'sem música', em: agora }); continue; }
      await entregarPedidoPagoZap(g);
    } catch (e) { console.error('avisar-pagos:', id, e && e.message); }
  }
};
