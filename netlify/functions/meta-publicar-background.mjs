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
      await etapa('O Meta está processando o vídeo…');
      for (let i = 0; i < 60; i++) { // até ~10 min
        const v = await graph('GET', a.videoId, { fields: 'status,picture' }).catch(() => null);
        const st = v && v.status && v.status.video_status;
        if (st === 'ready') { a.thumb = v.picture; break; }
        if (st === 'error') throw new Error('o Meta não conseguiu processar o vídeo');
        await dormir(10000);
      }
      if (!a.thumb) { const t = await graph('GET', a.videoId + '/thumbnails', {}).catch(() => null); a.thumb = t && t.data && t.data[0] && t.data[0].uri; }
      if (!a.thumb) throw new Error('o vídeo ainda não ficou pronto no Meta — tente publicar de novo em alguns minutos');
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
