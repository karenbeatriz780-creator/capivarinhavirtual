// Publica o anúncio novo em segundo plano (vídeo precisa esperar o Meta processar).
import { getStore } from '@netlify/blobs';
import { lerCfg, publicarAnuncio, graph, logRobo, avisar } from './_meta.mjs';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export default async (req) => {
  let b = {}; try { b = await req.json(); } catch (e) {}
  const job = String(b.job || ''); if (!/^[a-z0-9]{6,40}$/i.test(job)) return;
  const L = getStore('gastos'), k = 'job_' + job;
  const j = await L.get(k, { type: 'json' }).catch(() => null); if (!j || !j.dados || j.feito) return;
  const etapa = async (t) => { j.etapa = t; await L.setJSON(k, j).catch(() => {}); };
  try {
    const cfg = await lerCfg(), a = Object.assign({}, j.dados);
    if (a.tipo === 'video') {
      for (const [rot, x] of [['feed', a.feed], ['reels/stories', a.vertical]]) {
        await etapa('O Meta está processando o vídeo do ' + rot + '…');
        for (let i = 0; i < 60 && !x.thumb; i++) { // até ~10 min cada
          const v = await graph('GET', x.videoId, { fields: 'status,picture' }).catch(() => null);
          const st = v && v.status && v.status.video_status;
          if (st === 'ready') { x.thumb = v.picture; break; }
          if (st === 'error') {
            const fases = ['uploading_phase', 'processing_phase', 'publishing_phase'].map((f) => v.status[f]).filter(Boolean);
            const det = fases.flatMap((f) => (f.errors || []).map((e) => e.message || e.code)).filter(Boolean).join('; ');
            throw new Error('o Meta não conseguiu processar o vídeo do ' + rot + (det ? ' (' + det + ')' : '') + '. Tente exportar em MP4 (H.264) e publicar de novo');
          }
          await dormir(10000);
        }
        if (!x.thumb) { const t = await graph('GET', x.videoId + '/thumbnails', {}).catch(() => null); x.thumb = t && t.data && t.data[0] && t.data[0].uri; }
        if (!x.thumb) throw new Error('o vídeo do ' + rot + ' ainda não ficou pronto no Meta — tente de novo em alguns minutos');
      }
    }
    const r = await publicarAnuncio(cfg, a, etapa);
    j.feito = true; j.ok = true; j.etapa = 'Publicado ✓ O Meta vai revisar o anúncio (minutos a algumas horas).'; j.resultado = r;
    await L.setJSON(k, j);
    await logRobo({ tipo: 'publicou', camp: r.nome, id: r.campanha, motivo: 'anúncio novo com R$ ' + r.orcamento + '/dia' });
    await avisar('🚀 Publiquei o anúncio *' + r.nome + '* com R$ ' + r.orcamento + '/dia. O Meta vai revisar e começa a rodar.');
  } catch (e) {
    j.feito = true; j.ok = false; j.erro = e.message; j.etapa = 'Não deu certo: ' + e.message;
    await L.setJSON(k, j).catch(() => {});
    await logRobo({ tipo: 'erro', camp: j.dados.nome || 'anúncio novo', motivo: 'publicar: ' + e.message }).catch(() => {});
  }
};
