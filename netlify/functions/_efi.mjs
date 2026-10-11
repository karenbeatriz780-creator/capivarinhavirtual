import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pastaAtual = path.dirname(fileURLToPath(import.meta.url));
function ambiente() {
  return (process.env.EFI_ENV || 'homologation').toLowerCase() === 'production' ? 'production' : 'homologation';
}

function baseUrl() {
  return ambiente() === 'production' ? 'https://pix.api.efipay.com.br' : 'https://pix-h.api.efipay.com.br';
}

export function certificadoDisponivel() {
  const arquivo = path.join(pastaAtual, 'efi-cert.p12');
  if (fs.existsSync(arquivo)) return true;
  return !!(process.env.EFI_CERT_P12_BASE64 || '').trim();
}

function certificado() {
  const arquivo = path.join(pastaAtual, 'efi-cert.p12');
  if (fs.existsSync(arquivo)) return fs.readFileSync(arquivo);
  const b64 = (process.env.EFI_CERT_P12_BASE64 || '').trim();
  if (!b64) throw new Error('Certificado da Efí não encontrado.');
  return Buffer.from(b64, 'base64');
}

function credenciais() {
  const clientId = (process.env.EFI_CLIENT_ID || '').trim();
  const clientSecret = (process.env.EFI_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw new Error('EFI_CLIENT_ID/EFI_CLIENT_SECRET não configurados.');
  return { clientId, clientSecret };
}

export function modoTeste() { return ambiente() !== 'production'; }

export function efiRequest(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
  const url = new URL(path, baseUrl());
  const payload = body == null ? null : JSON.stringify(body);
  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method,
    pfx: certificado(),
    passphrase: process.env.EFI_CERT_PASSWORD || '',
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data = raw;
        try { data = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data, raw });
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('Timeout ao conectar com a Efí.')));
    if (payload) req.write(payload);
    req.end();
  });
}

let _tokenCache = null; // { token, expira } — reaproveita o token enquanto a função está "quente"

export async function obterToken() {
  if (_tokenCache && _tokenCache.expira > Date.now()) return _tokenCache.token;
  const { clientId, clientSecret } = credenciais();
  const auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const res = await efiRequest('/oauth/token', {
    method: 'POST',
    body: { grant_type: 'client_credentials' },
    headers: { Authorization: 'Basic ' + auth }
  });
  if (!res.ok || !res.data || !res.data.access_token) {
    const msg = res.data && (res.data.mensagem || res.data.message || res.data.nome);
    throw new Error('Efí recusou a autenticação' + (msg ? ': ' + msg : ' (HTTP ' + res.status + ')'));
  }
  const validade = Number(res.data.expires_in || 3600);
  _tokenCache = { token: res.data.access_token, expira: Date.now() + Math.max(60, validade - 120) * 1000 };
  return res.data.access_token;
}

/* Plano B do webhook: pergunta direto pra Efí se a cobrança deste pedido já
   foi paga. Devolve { e2eid, valor } quando o Pix caiu, ou null. */
export async function conferirPagamentoEfi(presente, token) {
  const pg = presente && presente.pagamento;
  if (!presente || presente.pago || presente.cancelado || !pg || pg.provedor !== 'efi' || !pg.txid) return null;
  const tk = token || await obterToken();
  const r = await efiRequest('/v2/cob/' + encodeURIComponent(pg.txid), { token: tk });
  if (!r.ok || !r.data) return null;
  if (String(r.data.status || '').toUpperCase() !== 'CONCLUIDA') return null;
  const pix = Array.isArray(r.data.pix) && r.data.pix[0] ? r.data.pix[0] : {};
  return { e2eid: pix.endToEndId || null, valor: pix.valor || null };
}

/* Marca o presente como pago (mesma regra do webhook). Muda o objeto e devolve ele. */
export function aplicarPagamento(presente, info, origem) {
  const agora = Date.now();
  presente.pago = true;
  presente.pagoEm = presente.pagoEm || agora;
  presente.criadoEm = presente.criadoEm || agora;
  presente.expiraEm = (presente.duracao === 'h48') ? presente.criadoEm + 48 * 3600 * 1000 : null;
  presente.pagamento = Object.assign({}, presente.pagamento || {}, {
    provedor: 'efi', status: 'CONCLUIDA', e2eid: (info && info.e2eid) || null,
    valorRecebido: (info && info.valor) || null, pagoEm: presente.pagoEm, confirmadoPor: origem || 'consulta'
  });
  return presente;
}

export function erroEfi(data, status) {
  if (data && typeof data === 'object') return data.mensagem || data.message || data.nome || ('HTTP ' + status);
  return (typeof data === 'string' && data.slice(0, 250)) || ('HTTP ' + status);
}

/* Lista os Pix recebidos na conta num período (todas as páginas, até um limite).
   Cada item traz o txid da cobrança, que liga o Pix ao pedido. */
export async function listarPixRecebidos(token, inicio, fim, maxPaginas = 5) {
  const tk = token || await obterToken();
  const todos = [];
  for (let pag = 0; pag < maxPaginas; pag++) {
    const q = '?inicio=' + encodeURIComponent(inicio.toISOString()) + '&fim=' + encodeURIComponent(fim.toISOString()) +
      '&paginacao.paginaAtual=' + pag + '&paginacao.itensPorPagina=100';
    const r = await efiRequest('/v2/pix' + q, { token: tk });
    if (!r.ok || !r.data) { if (!todos.length) throw new Error('Efí /v2/pix: ' + erroEfi(r.data, r.status)); break; }
    const lista = Array.isArray(r.data.pix) ? r.data.pix : [];
    todos.push(...lista);
    const total = r.data.parametros && r.data.parametros.paginacao && r.data.parametros.paginacao.quantidadeDePaginas;
    if (!total || pag + 1 >= total || !lista.length) break;
  }
  return todos;
}
