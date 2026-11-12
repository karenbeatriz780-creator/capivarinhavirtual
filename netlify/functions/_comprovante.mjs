import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { PIX_MANUAL, lerCfgPix } from './_pixmanual.mjs';
import { aplicarPagamento } from './_efi.mjs';
import { indexarDia } from './_indice.mjs';
// 🧾 COMPROVANTE DO PIX MANUAL: a IA lê o print, o sistema confere as regras e (se tudo bater) libera sozinho.
// Regras: é comprovante de Pix CONCLUÍDO · valor = valor do pedido · recebedor = Gusthavo (nome/chave) ·
// data/hora DEPOIS que o Pix foi gerado (e não no futuro) · o mesmo comprovante (código da transação ou a mesma imagem) não vale 2 vezes.
const loja = () => getStore('comprovantes');
const OR = 'https://openrouter.ai/api/v1/chat/completions';
const MODELOS = ['anthropic/claude-haiku-4.5', 'google/gemini-3.6-flash'];
const PROMPT = 'Você confere comprovantes de Pix brasileiros. Leia a imagem e responda SÓ um JSON, sem texto fora dele, com: ' +
  '{"comprovante": true se for um comprovante/recibo de transferência Pix (false se for outra coisa), ' +
  '"concluido": true se o Pix aparece como realizado/concluído/efetuado (false se agendado, pendente, em processamento, cancelado ou não der pra saber), ' +
  '"valor": número em reais (ex 9.99) ou null, "dataHora": "AAAA-MM-DD HH:MM" (horário de Brasília como está no comprovante) ou null, ' +
  '"recebedorNome": texto ou null, "recebedorChave": texto ou null, "recebedorBanco": texto ou null, "pagadorNome": texto ou null, ' +
  '"idTransacao": o código da transação / ID / E2E / autenticação (o mais longo que aparecer, sem espaços) ou null, ' +
  '"editado": true se parecer montagem/edição (textos desalinhados, fontes diferentes, números sobrepostos), "obs": observação curta}';

async function lerIA(dataUrl) {
  const ch = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!ch) throw new Error('sem OPENROUTER_API_KEY');
  let ult = null;
  for (const model of MODELOS) {
    try {
      const r = await fetch(OR, { method: 'POST', headers: { Authorization: 'Bearer ' + ch, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 500, messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }] }) });
      const j = await r.json();
      const txt = (((j.choices || [])[0] || {}).message || {}).content || '';
      const m = /\{[\s\S]*\}/.exec(String(txt));
      if (m) return Object.assign(JSON.parse(m[0]), { _modelo: model });
      ult = new Error('IA não devolveu JSON: ' + String(txt || JSON.stringify(j.error || {})).slice(0, 150));
    } catch (e) { ult = e; }
  }
  throw ult || new Error('IA falhou');
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const soAlnum = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
function quandoBR(txt) { // "2026-11-12 17:25" (Brasília) → ms
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(txt || ''));
  if (!m) return null;
  return { t: Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '12') + ':' + (m[5] || '00') + ':00-03:00'), temHora: !!m[4] };
}
export function conferir(g, L, hashJaUsado, idJaUsado) {
  const pg = g.pagamento || {}, valorPed = Number(pg.valor || 0), motivos = [];
  if (!L || !L.comprovante) motivos.push('a imagem não parece um comprovante de Pix');
  else {
    if (!L.concluido) motivos.push('o Pix não aparece como concluído (pode estar agendado ou pendente)');
    if (L.valor == null || Math.abs(Number(L.valor) - valorPed) > 0.011) motivos.push('o valor do comprovante (' + (L.valor == null ? 'não encontrado' : 'R$ ' + Number(L.valor).toFixed(2).replace('.', ',')) + ') é diferente do pedido (R$ ' + valorPed.toFixed(2).replace('.', ',') + ')');
    const nome = norm(L.recebedorNome), chave = String(L.recebedorChave || '').toLowerCase();
    const nomeOk = /GUSTHAVO/.test(nome) || (/SANTOS/.test(nome) && /JESUS/.test(nome));
    const chaveOk = chave && PIX_MANUAL.chave.toLowerCase().indexOf(chave.replace(/[^a-f0-9-]/g, '').slice(0, 8)) >= 0 && chave.replace(/[^a-f0-9-]/g, '').length >= 8;
    if (!nomeOk && !chaveOk) motivos.push('o recebedor do comprovante não é a nossa conta' + (L.recebedorNome ? ' (aparece: ' + String(L.recebedorNome).slice(0, 40) + ')' : ''));
    const q = quandoBR(L.dataHora), gerado = pg.manualEm || g.criadoEm || 0;
    if (!q) motivos.push('não consegui ler a data do comprovante');
    else if (q.temHora ? (q.t < gerado - 3 * 60e3 || q.t > Date.now() + 10 * 60e3) : (q.t < gerado - 24 * 3600e3 || q.t > Date.now() + 24 * 3600e3)) motivos.push('a data/hora do comprovante (' + L.dataHora + ') é de antes do Pix ser gerado');
    if (L.editado) motivos.push('a imagem parece editada');
  }
  if (hashJaUsado && hashJaUsado !== g.id) motivos.push('esse mesmo comprovante já foi usado em outro pedido');
  if (idJaUsado && idJaUsado !== g.id) motivos.push('o código dessa transação já foi usado em outro pedido');
  return motivos;
}
export async function liberarManual(id, origem, extra) {
  const pres = getStore('presentes');
  const g = await pres.get(id, { type: 'json' });
  if (!g) throw new Error('pedido não encontrado');
  if (g.pago) return g;
  aplicarPagamento(g, { e2eid: (extra && extra.e2e) || null, valor: (g.pagamento && g.pagamento.valor) || null }, origem);
  g.pagamento.provedor = 'manual';
  g.pagamento.confirmadoPor = origem;
  if (/^ja-paguei/.test(String(origem))) g.pagamento.semConferencia = true; // liberado só pelo "já paguei", sem ver o Pix
  await pres.setJSON(id, g);
  try { await indexarDia('pg', g.id, g.pagoEm); } catch (e) {}
  return g;
}
// analisa e (se der) libera. imagem = Buffer (jpeg/png). Devolve { status: 'liberado'|'conferir'|'recusado', motivos, leitura }
export async function analisarComprovante(id, imagem, mime, origem) {
  const pres = getStore('presentes');
  const g = await pres.get(id, { type: 'json' });
  if (!g) return { status: 'erro', motivos: ['pedido não encontrado'] };
  if (g.pago) return { status: 'liberado', jaPago: true, motivos: [] };
  const pg = g.pagamento || {};
  if (pg.provedor !== 'manual') return { status: 'erro', motivos: ['esse pedido não está no Pix manual'] };
  const k = 'c_' + id, reg = (await loja().get(k, { type: 'json' }).catch(() => null)) || { id, envios: [] };
  if (reg.envios.length >= 6) return { status: 'conferir', motivos: ['muitos envios — vamos conferir manualmente'] };
  const hash = crypto.createHash('sha256').update(imagem).digest('hex').slice(0, 32);
  const imgKey = 'img_' + id + '_' + Date.now();
  await loja().set(imgKey, imagem, { metadata: { mime: mime || 'image/jpeg' } });
  let L = null, erroIA = null;
  try { L = await lerIA('data:' + (mime || 'image/jpeg') + ';base64,' + imagem.toString('base64')); } catch (e) { erroIA = e.message; }
  const idT = L && soAlnum(L.idTransacao).length >= 10 ? soAlnum(L.idTransacao) : null;
  const hU = await loja().get('h_' + hash, { type: 'json' }).catch(() => null);
  const iU = idT ? await loja().get('t_' + idT, { type: 'json' }).catch(() => null) : null;
  const motivos = erroIA ? ['não consegui ler o comprovante agora (' + erroIA.slice(0, 80) + ')'] : conferir(g, L, hU && hU.id, iU && iU.id);
  const cfg = await lerCfgPix();
  const okIA = !motivos.length;
  let status = okIA ? (cfg.autoLiberar ? 'liberado' : 'conferir') : (erroIA ? 'conferir' : 'recusado');
  const envio = { em: Date.now(), img: imgKey, hash, leitura: L, motivos, status, origem };
  reg.envios.push(envio); reg.ult = envio; reg.status = status; reg.valor = pg.valor; reg.whatsapp = g.musicaWhatsapp || g.whatsapp || '';
  reg.para = g.musicaParaNome || g.parceiroNome || ''; reg.criadoEm = g.criadoEm; reg.atualizadoEm = Date.now();
  await loja().setJSON(k, reg);
  await loja().setJSON('h_' + hash, { id, em: Date.now() });
  if (idT) await loja().setJSON('t_' + idT, { id, em: Date.now() });
  if (status === 'liberado') await liberarManual(id, 'comprovante-ia', { e2e: idT });
  else { g.pagamento.comprovante = { status, em: Date.now() }; await pres.setJSON(id, g); }
  try {
    const { avisar } = await import('./_meta.mjs');
    await avisar('🧾 Comprovante ' + (status === 'liberado' ? '✅ LIBERADO automático' : status === 'conferir' ? '⏳ pra CONFERIR' : '❌ recusado pela IA') +
      '\nPedido ' + id + ' · R$ ' + Number(pg.valor || 0).toFixed(2).replace('.', ',') + (L && L.pagadorNome ? ' · ' + L.pagadorNome : '') +
      (motivos.length ? '\nMotivo: ' + motivos.join('; ') : '') + (status !== 'liberado' ? '\nPainel → 🧾 Pix manual' : ''));
  } catch (e) {}
  return { status, motivos, leitura: L };
}

// libera pedido do Pix manual SEM comprovante ("Já paguei" ou 1 minuto depois). Deixa registro pra bater com o extrato.
export async function liberarSemComprovante(id, origem) {
  const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
  if (!g || g.pago || g.cancelado || !g.pagamento || g.pagamento.provedor !== 'manual') return g;
  const cfg = await lerCfgPix();
  if (!cfg.semComprovante) return g;
  const g2 = await liberarManual(id, origem);
  try {
    const k = 'c_' + id, reg = (await loja().get(k, { type: 'json' }).catch(() => null)) || { id, envios: [] };
    Object.assign(reg, { status: 'liberado', semComprovante: true, origemLib: origem, valor: g.pagamento.valor, whatsapp: g.musicaWhatsapp || g.whatsapp || '',
      para: g.musicaParaNome || g.parceiroNome || '', criadoEm: g.criadoEm, atualizadoEm: Date.now(), ult: Object.assign({}, reg.ult || {}, { origem }) });
    await loja().setJSON(k, reg);
    await loja().delete('pend_' + id).catch(() => {});
  } catch (e) {}
  return g2;
}
