// 🇺🇸 Site em inglês (/us): cria o pedido da música para pagar no cartão (US$).
// POST {taskId, email, nome, paraNome, estilo, clima, relacao, ocasiao, voz, letra}
// A música (prévia) já foi gerada; aqui só guarda o pedido com o preço em dólar.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { indexarDia } from './_indice.mjs';
import { statusIndicacao, registrarIndicado, registrarUso } from './_indicacao.mjs';
import { indexarEmail } from './us-extra.mjs';

export const PRECO_US = Number(process.env.PRECO_US) || 7.99;
const USD_BRL = () => Number(process.env.USD_BRL) || 5.65; // só estimativa; ao pagar, entra o valor exato em reais do Stripe
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const str = (b, k, n) => String((b && b[k]) || '').trim().slice(0, n || 200);

export default async (req) => {
  if (req.method === 'GET') return json({ preco: PRECO_US, moeda: 'usd' });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const taskId = str(b, 'taskId', 120), email = str(b, 'email', 160).toLowerCase();
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(taskId)) return json({ erro: 'Please create your song first.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ erro: 'Please enter a valid email.' }, 400);
  const reg = await getStore('musicas').get(taskId, { type: 'json' }).catch(() => null);
  if (!reg || !reg.url) return json({ erro: 'Your song is still being made. Please wait a moment.' }, 409);
  const id = 'us' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const agora = Date.now();
  const g = {
    id, produto: 'musica', idioma: 'en', pais: 'us', email,
    meuNome: str(b, 'nome', 80), musicaParaNome: str(b, 'paraNome', 120),
    musicaEstilo: str(b, 'estilo', 40), musicaClima: str(b, 'clima', 40), musicaPara: str(b, 'relacao', 40), musicaOcasiao: str(b, 'ocasiao', 80), musicaVoz: str(b, 'voz', 20),
    musicaLetra: str(b, 'letra', 5000) || reg.letraAprovada || null,
    musicaPreviewId: taskId, musicaPreviewUrl: reg.url, musicaPreviewUrl2: reg.url2 || null,
    musicaOn: true, musicaPersonalizar: true, duracao: 'vitalicio', expiraEm: null,
    criadoEm: agora, pago: false, quatro: true,
    pagamento: { provedor: 'stripe', status: 'ATIVA', moeda: 'usd', valorMoeda: PRECO_US, valor: Math.round(PRECO_US * USD_BRL() * 100) / 100 }
  };
  // 🎶 4 MÚSICAS: as 2 da prévia + mais 2 (outra letra/estilo) que a pessoa cria depois de pagar
  const dobroDe = str(b, 'dobroDe', 80);
  if (dobroDe) {
    const lojaP = getStore('presentes');
    const origem = await lojaP.get(dobroDe, { type: 'json' }).catch(() => null);
    if (!origem || !origem.pago || origem.cancelado || !origem.quatro || origem.idioma !== 'en') return json({ erro: 'These songs are not available for this order.' }, 400);
    if (origem.dobroUsado && origem.dobroUsado !== id) return json({ erro: 'You already created your other 2 songs.', jaUsado: origem.dobroUsado }, 400);
    Object.assign(g, { pago: true, pagoEm: agora, dobroDe, quatro: false, email: origem.email || email, meuNome: g.meuNome || origem.meuNome || '', pagamento: { provedor: 'incluso', status: 'CONCLUIDA', valor: 0, pagoEm: agora } });
    await lojaP.setJSON(id, g);
    origem.dobroUsado = id; origem.dobroEm = agora; await lojaP.setJSON(dobroDe, origem);
    try { await indexarDia('p', id); } catch (e) {}
    try { await indexarEmail(g.email, id); } catch (e) {}
    return json({ ok: true, id, gratis: true });
  }
  // 🎁 indique e ganhe: música GRÁTIS de quem já tem indicação confirmada
  const bonusDe = str(b, 'bonusDe', 80);
  if (bonusDe) {
    const dono = await getStore('presentes').get(bonusDe, { type: 'json' }).catch(() => null);
    const st = dono && dono.pago ? await statusIndicacao(bonusDe) : { disponiveis: 0 };
    if (!(st.disponiveis >= 1)) return json({ erro: 'You don\'t have a free song available yet.' }, 400);
    Object.assign(g, { pago: true, pagoEm: agora, bonusDe, quatro: false, pagamento: { provedor: 'bonus', status: 'CONCLUIDA', valor: 0, pagoEm: agora } });
    await getStore('presentes').setJSON(id, g);
    await registrarUso(bonusDe, id);
    try { await indexarDia('p', id); } catch (e) {}
    try { await indexarEmail(email, id); } catch (e) {}
    return json({ ok: true, id, gratis: true });
  }
  // veio pelo link de um cliente → conta pra ele quando pagar
  const ref = str(b, 'ref', 80);
  if (ref && /^[A-Za-z0-9_-]{4,80}$/.test(ref) && ref !== id) { try { await registrarIndicado(ref, id); g.refDe = ref; } catch (e) {} }
  await getStore('presentes').setJSON(id, g);
  try { await indexarDia('p', id); } catch (e) {}
  try { await indexarEmail(email, id); } catch (e) {}
  try { reg.pedidoId = id; reg.email = email; await getStore('musicas').setJSON(taskId, reg); } catch (e) {}
  return json({ ok: true, id, preco: PRECO_US });
};
