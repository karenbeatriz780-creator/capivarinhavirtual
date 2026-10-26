import { getStore } from '@netlify/blobs';
import { pegarAudio, jaGuardado, versoesDoPedido } from './_audio.mjs';
import { lerDias, idsDosDiasTudo } from './_indice.mjs';

// Guarda uma cópia de TODAS as músicas pagas (o serviço de música apaga o
// arquivo em ~7 dias). Ordem: 1) o pedido pedido em ?id= (na hora do pagamento),
// 2) os pagos dos últimos 10 dias (os mais urgentes), 3) o resto do histórico.
// Roda em segundo plano (até 15 min); o que já foi guardado é pulado.
export default async (req) => {
  const t0 = Date.now();
  const idx = getStore('indices');
  const presentes = getStore('presentes');
  let unico = '';
  try { unico = (new URL(req.url).searchParams.get('id') || '').trim(); } catch (e) {}

  async function guardarPedido(id, falhas) {
    const g = await presentes.get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.pago || g.cancelado) return { novos: 0, vistos: 0 };
    let novos = 0, vistos = 0;
    for (const v of versoesDoPedido(g)) {
      vistos++;
      if (await jaGuardado(g, v)) continue;
      const buf = await pegarAudio(g, v);
      if (buf) novos++;
      else if (falhas) {
        falhas.push({ id: g.id, v, nome: g.musicaParaNome || g.parceiroNome || g.meuNome || '', whatsapp: g.musicaWhatsapp || g.whatsapp || '', pagoEm: g.pagoEm || (g.pagamento && g.pagamento.pagoEm) || g.criadoEm || 0 });
        console.log('sem áudio:', g.id, 'v' + v);
      }
    }
    return { novos, vistos };
  }

  // só um pedido (chamado logo depois do pagamento): rápido, sem trava
  if (unico) {
    try { const r = await guardarPedido(unico, null); console.log('áudio do pedido', unico, r); } catch (e) { console.error('guardar 1:', e && e.message); }
    return;
  }

  try {
    const trava = await idx.get('audios-rodando', { type: 'json' }).catch(() => null);
    if (trava && Date.now() - (trava.em || 0) < 14 * 60 * 1000) return;
    await idx.setJSON('audios-rodando', { em: Date.now() });
    let novos = 0, vistos = 0;
    const falhas = [], feitos = {};
    // 1) pagos recentes primeiro
    let recentes = [];
    try { recentes = await idsDosDiasTudo(await lerDias(), 10, 'pg'); } catch (e) {}
    for (const id of recentes) {
      if (Date.now() - t0 > 13 * 60 * 1000) break;
      if (feitos[id]) continue; feitos[id] = 1;
      const r = await guardarPedido(id, falhas); novos += r.novos; vistos += r.vistos;
    }
    // 2) todo o resto
    const { blobs } = await presentes.list();
    for (const b of blobs) {
      if (Date.now() - t0 > 13 * 60 * 1000) break;
      if (feitos[b.key]) continue; feitos[b.key] = 1;
      const r = await guardarPedido(b.key, falhas); novos += r.novos; vistos += r.vistos;
    }
    const fim = Date.now() - t0 < 13 * 60 * 1000;
    falhas.sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0));
    await idx.setJSON('audios-backup', { em: Date.now(), completo: fim, novos, falhas: falhas.length, vistos, semAudio: falhas.slice(0, 300) });
    console.log('backup de áudios:', { novos, falhas: falhas.length, vistos, completo: fim });
  } catch (e) { console.error('guardar-audios:', e && e.stack || e); }
  try { await idx.setJSON('audios-rodando', { em: 0 }); } catch (e) {}
};
