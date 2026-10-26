import { getStore } from '@netlify/blobs';
import { idsDoDia, diaBR } from './_indice.mjs';
import { enviarTexto, enviarModeloTextos, conversaAberta, chaveNum, registrar, temMusica, linkPedido, entregarAudiosPagos } from './_zap.mjs';

// A CADA MINUTO: quem PAGOU recebe no WhatsApp o link das músicas + os áudios completos.
// - Se a pessoa conversou com o número nas últimas 24 h → manda tudo grátis (texto + áudios).
// - Se não → manda o modelo aprovado (WHATSAPP_MODELO_PAGO, ex: musica_pronta) com o link.
//   Quando ela responder, os áudios saem na hora (whatsapp-webhook → entregarAudiosPagos).
export const config = { schedule: '* * * * *' };

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
      if (!temMusica(g)) { await loja.setJSON('pago_' + id, { pulado: 'sem música', em: agora }); continue; }
      let num = String(g.musicaWhatsapp || g.whatsapp || '').replace(/\D/g, '');
      if (num.length < 10) { await loja.setJSON('pago_' + id, { pulado: 'sem whatsapp', em: agora }); continue; }
      if (!num.startsWith('55') || num.length <= 11) num = '55' + num;
      await loja.setJSON('pago_' + id, { em: agora, para: num }); // marca antes pra não mandar 2 vezes
      const nome = String(g.meuNome || '').trim().split(/\s+/)[0] || '';
      const aberta = await conversaAberta(num);
      if (aberta) {
        await enviarTexto(aberta, '🎉 *Pagamento confirmado!*' + (nome ? ' Obrigado, ' + nome + '!' : '') + ' 💗\n\n' +
          'Suas músicas já estão liberadas, sem corte.' + (g.quatro && !g.ofertaM1 ? ' E as *outras 2 músicas* do seu pacote você cria no mesmo link:' : ' Ficam salvas aqui:') + '\n' + linkPedido(g));
        await entregarAudiosPagos(aberta, g, false);
        await registrar('pago_enviado', { para: aberta, pedido: id, nome: g.musicaParaNome || nome, via: 'grátis' });
      } else {
        const modelo = (process.env.WHATSAPP_MODELO_PAGO || '').trim();
        const ok = modelo ? await enviarModeloTextos(num, modelo, [nome || 'tudo bem', linkPedido(g)]) : false;
        // quando a pessoa mandar qualquer mensagem (até 7 dias), recebe os áudios na hora
        await loja.setJSON('pagoaud_' + chaveNum(num), { id, em: agora });
        if (ok) {
          await registrar('pago_enviado', { para: num, pedido: id, nome: g.musicaParaNome || nome, via: 'modelo ' + modelo });
        } else {
          await registrar('pago_sem_aviso', { para: num, pedido: id, nome: g.musicaParaNome || nome, motivo: modelo ? 'modelo recusado' : 'cliente não abriu conversa e o modelo ainda não está configurado' });
        }
      }
    } catch (e) { console.error('avisar-pagos:', id, e && e.message); }
  }
};
