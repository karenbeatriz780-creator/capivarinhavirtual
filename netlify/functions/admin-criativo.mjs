// Painel → "Novo anúncio": sobe a foto/vídeo pro Meta e dispara a publicação.
//  POST {acao:'imagem', base64, nome}                     → { hash }
//  POST {acao:'video-inicio', tamanho}                    → { sessao, videoId, ini, fim }
//  POST {acao:'video-parte', sessao, ini, fim, pos, parte(base64)} → { ini, fim } (próximo pedaço que o Meta quer) ou { falta }
//  POST {acao:'video-fim', sessao, nome}                  → { ok }
//  POST {acao:'publicar', ...}                            → { job }
//  GET  ?job=ID                                           → andamento
import { getStore } from '@netlify/blobs';
import { graphConta } from './_meta.mjs';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const conta = () => String(process.env.META_AD_ACCOUNT_ID || '').trim().replace(/^act_/, '');
const VER = () => (process.env.META_API_VERSION || 'v24.0').trim();
export default async (req) => {
  const L = getStore('gastos');
  if (req.method === 'GET') {
    const job = new URL(req.url).searchParams.get('job') || '';
    if (!/^[a-z0-9]{6,40}$/i.test(job)) return json({ erro: 'job inválido' }, 400);
    return json((await L.get('job_' + job, { type: 'json' }).catch(() => null)) || { etapa: 'Aguardando…' });
  }
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return json({ erro: 'Senha de administrador incorreta.' }, 401);
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return json({ erro: 'Meta Ads não está ligado.' }, 400);
  let b = {}; try { b = await req.json(); } catch (e) { return json({ erro: 'Arquivo grande demais pra esse pedaço.' }, 400); }
  try {
    if (b.acao === 'imagem') {
      const d = await graphConta('POST', 'adimages', { bytes: String(b.base64 || ''), name: String(b.nome || 'criativo').slice(0, 60) });
      const img = d.images && Object.values(d.images)[0];
      if (!img || !img.hash) return json({ erro: 'O Meta não devolveu a imagem.' }, 502);
      return json({ hash: img.hash, url: img.url || null });
    }
    if (b.acao === 'video-inicio') {
      const d = await graphConta('POST', 'advideos', { upload_phase: 'start', file_size: String(Number(b.tamanho) || 0) });
      return json({ sessao: d.upload_session_id, videoId: d.video_id, ini: Number(d.start_offset), fim: Number(d.end_offset) });
    }
    if (b.acao === 'video-parte') {
      // junta os pedaços (o Meta pode pedir blocos maiores do que cabe num envio) e manda quando completar
      const sess = String(b.sessao || '').replace(/\D/g, ''), k = 'vbuf_' + sess;
      const ini = Number(b.ini), fim = Number(b.fim), pos = Number(b.pos);
      const LS = getStore({ name: 'gastos', consistency: 'strong' });
      let ant = null;
      if (pos > 0) { // confere se o pedaço anterior já está guardado inteiro (senão o vídeo sai corrompido)
        for (let i = 0; i < 6; i++) {
          ant = await LS.get(k, { type: 'arrayBuffer' }).catch(() => null);
          if (ant && ant.byteLength === pos) break;
          await new Promise((r) => setTimeout(r, 700));
        }
        if (!ant || ant.byteLength !== pos) return json({ erro: 'falhou ao juntar os pedaços do vídeo — tente de novo' }, 502);
      }
      const pedaco = Buffer.from(String(b.parte || ''), 'base64');
      const buf = ant ? Buffer.concat([Buffer.from(ant), pedaco]) : pedaco;
      if (buf.length > fim - ini) return json({ erro: 'pedaço do vídeo fora de ordem — tente de novo' }, 502);
      if (buf.length < fim - ini) { await LS.set(k, buf); return json({ falta: fim - ini - buf.length }); }
      const fd = new FormData();
      fd.append('access_token', String(process.env.META_ADS_TOKEN).trim());
      fd.append('upload_phase', 'transfer'); fd.append('upload_session_id', sess); fd.append('start_offset', String(ini));
      fd.append('video_file_chunk', new Blob([buf]), 'parte');
      const r = await fetch('https://graph.facebook.com/' + VER() + '/act_' + conta() + '/advideos', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      await LS.delete(k).catch(() => {});
      if (!r.ok || d.error) return json({ erro: (d.error && (d.error.error_user_msg || d.error.message)) || 'falha ao enviar o vídeo' }, 502);
      return json({ ini: Number(d.start_offset), fim: Number(d.end_offset) });
    }
    if (b.acao === 'video-fim') {
      await graphConta('POST', 'advideos', { upload_phase: 'finish', upload_session_id: String(b.sessao || ''), title: String(b.nome || 'criativo').slice(0, 60) });
      return json({ ok: true });
    }
    if (b.acao === 'publicar') {
      const job = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const pega = (x) => (x ? { hash: x.hash ? String(x.hash) : null, videoId: x.videoId ? String(x.videoId) : null } : null);
      const dados = { tipo: b.tipo === 'video' ? 'video' : 'imagem', feed: pega(b.feed), vertical: pega(b.vertical),
        nome: String(b.nome || '').slice(0, 60), texto: String(b.texto || '').slice(0, 1500), titulo: String(b.titulo || '').slice(0, 120), orcamento: Number(b.orcamento) || null,
        idadeMin: parseInt(b.idadeMin, 10) || 18, idadeMax: parseInt(b.idadeMax, 10) || null, genero: [1, 2].indexOf(parseInt(b.genero, 10)) >= 0 ? parseInt(b.genero, 10) : null,
        posicoes: Array.isArray(b.posicoes) ? b.posicoes.map(String).slice(0, 7) : null,
        interesses: Array.isArray(b.interesses) ? b.interesses.slice(0, 40).map((x) => ({ id: String(x && x.id || ''), nome: String(x && x.nome || '').slice(0, 80), tipo: String(x && x.tipo || 'interests').slice(0, 30) })) : [] };
      await L.setJSON('job_' + job, { etapa: 'Na fila…', em: Date.now(), dados });
      await fetch((process.env.URL || 'https://capivarinhalove.com.br') + '/.netlify/functions/meta-publicar-background', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job })
      }).catch(() => {});
      return json({ job });
    }
    return json({ erro: 'ação inválida' }, 400);
  } catch (e) { return json({ erro: e.message || 'erro no Meta' }, 502); }
};
