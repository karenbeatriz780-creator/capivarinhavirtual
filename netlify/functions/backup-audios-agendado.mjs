// Dispara a cópia de segurança das músicas pagas 1 VEZ POR DIA, na virada do dia
// (00:10 no horário de Brasília = 03:10 UTC). O serviço de música apaga o arquivo
// em ~7 dias; a cópia diária dos últimos 8 dias pega cada música várias vezes antes disso.
// Aproveita a mesma volta diária pra apagar fotos de criança do Livro Mágico que não
// precisam mais ficar guardadas (livro pronto, ou prévia não paga com mais de 3 dias).
import { getStore } from '@netlify/blobs';

export const config = { schedule: '10 3 * * *' };

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  if (base) {
    try { await fetch(base + '/.netlify/functions/guardar-audios-background', { method: 'POST' }); } catch (e) { console.error('backup-audios-agendado:', e && e.message); }
  }
  // prévias guardadas (cache do áudio de 70 s): apaga as com mais de 3 dias
  try {
    const pv = getStore('previas'), { blobs } = await pv.list({ prefix: 'pv_' });
    for (const b of blobs.slice(0, 2000)) {
      const m = await pv.getMetadata(b.key).catch(() => null);
      if (!m || !m.metadata || Date.now() - (m.metadata.em || 0) > 3 * 86400000) await pv.delete(b.key).catch(() => {});
    }
  } catch (e) { console.error('limpar prévias:', e && e.message); }
  try {
    const livros = getStore('livros'), presentes = getStore('presentes');
    const { blobs } = await livros.list({ prefix: 'foto/' });
    let apagadas = 0;
    for (const b of blobs.slice(0, 300)) {
      const id = b.key.slice(5).split('/')[0]; // foto/<pedido> ou foto/<pedido>/x1 (quem vai junto)
      const g = await presentes.get(id, { type: 'json' }).catch(() => null);
      const velho = !g || Date.now() - (g.criadoEm || 0) > 3 * 86400000;
      const pronto = g && g.pago && g.livro && g.livro.status === 'pronto';
      if (pronto || (velho && !(g && g.pago))) { await livros.delete(b.key); apagadas++; }
    }
    if (apagadas) console.log('livro: fotos apagadas', apagadas);
  } catch (e) { console.error('limpeza de fotos do livro:', e && e.message); }
};
