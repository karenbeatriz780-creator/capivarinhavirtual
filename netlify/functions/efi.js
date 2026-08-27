import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Certificados costumam passar de 3KB em Base64, e a soma de todas as
// variáveis de ambiente de uma function na Netlify não pode passar de 4KB
// (limite da AWS Lambda por baixo do capô). Por isso o certificado é lido
// de um arquivo enviado junto com o código (netlify/functions/efi-cert.p12).
// A forma como a Netlify empacota e carrega as functions faz com que nem
// __dirname nem import.meta.url sejam confiáveis aqui, então procuramos o
// arquivo em vários lugares possíveis e usamos o primeiro que existir.
function localizarCertificado() {
  const nome = 'efi-cert.p12';
  const candidatos = [];
  if (process.env.LAMBDA_TASK_ROOT) {
    candidatos.push(path.join(process.env.LAMBDA_TASK_ROOT, 'netlify', 'functions', nome));
  }
  candidatos.push(path.join(process.cwd(), 'netlify', 'functions', nome));
  candidatos.push(path.join(process.cwd(), nome));
  if (typeof __dirname !== 'undefined') {
    candidatos.push(path.join(__dirname, nome));
  }
  try {
    candidatos.push(path.join(path.dirname(fileURLToPath(import.meta.url)), nome));
  } catch {}
  for (const c of candidatos) {
    try { if (c && fs.existsSync(c)) return c; } catch {}
  }
  return null;
}
function ambiente() {
  return (process.env.EFI_ENV || 'homologation').toLowerCase() === 'production' ? 'production' : 'homologation';
}

function baseUrl() {
  return ambiente() === 'production' ? 'https://pix.api.efipay.com.br' : 'https://pix-h.api.efipay.com.br';
}

export function certificadoDisponivel() {
  if (localizarCertificado()) return true;
  return !!(process.env.EFI_CERT_P12_BASE64 || '').trim();
}

function certificado() {
  const arquivo = localizarCertificado();
  if (arquivo) return fs.readFileSync(arquivo);
  const b64 = (process.env.EFI_CERT_P12_BASE64 || '').trim();
  if (!b64) throw new Error('Certificado da Efí não encontrado: nem netlify/functions/efi-cert.p12 nem EFI_CERT_P12_BASE64 estão configurados.');
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

export async function obterToken() {
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
  return res.data.access_token;
}

export function erroEfi(data, status) {
  if (data && typeof data === 'object') return data.mensagem || data.message || data.nome || ('HTTP ' + status);
  return (typeof data === 'string' && data.slice(0, 250)) || ('HTTP ' + status);
}
