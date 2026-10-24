import { getStore } from '@netlify/blobs';
import { pegarAudio, jaGuardado, versoesDoPedido } from './_audio.mjs';

// Guarda uma cópia de TODAS as músicas pagas (desde o primeiro pedido).
// Roda em segundo plano (até 15 min); se não der tempo, continua na próxima vez
// (o que já foi guardado é pulado).
export default async () => {
  const t0 = Date.now();
  const idx = getStore('indices');
  try {
    const trava = await idx.get('audios-rodando', { type: 'json' }).catch(() => null);
    if (trava && Date.now() - (trava.em || 0) < 14 * 60 * 1000) return;
    await idx.setJSON('audios-rodando', { em: Date.now() });
    const presentes = getStore('presentes');
    const { blobs } = await presentes.list();
    let novos = 0, falhas = 0, vistos = 0;
    for (const b of blobs) {
      if (Date.now() - t0 > 13 * 60 * 1000) break;
      const g = await presentes.get(b.key, { type: 'json' }).catch(() => null);
      if (!g || !g.pago || g.cancelado) continue;
      for (const v of versoesDoPedido(g)) {
        vistos++;
        if (await jaGuardado(g, v)) continue;
        const buf = await pegarAudio(g, v);
        if (buf) novos++; else { falhas++; console.log('sem áudio:', g.id, 'v' + v); }
      }
    }
    const fim = Date.now() - t0 < 13 * 60 * 1000;
    await idx.setJSON('audios-backup', { em: Date.now(), completo: fim, novos, falhas, vistos });
    console.log('backup de áudios:', { novos, falhas, vistos, completo: fim });
  } catch (e) { console.error('guardar-audios:', e && e.stack || e); }
  try { await idx.setJSON('audios-rodando', { em: 0 }); } catch (e) {}
};
