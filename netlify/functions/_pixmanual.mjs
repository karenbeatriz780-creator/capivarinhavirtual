import { getStore } from '@netlify/blobs';
// PIX MANUAL (reserva quando a Efí não gera cobrança): o site monta um Pix "copia e cola" com a CHAVE do Gusthavo e o valor do pedido.
// O cliente paga, manda o comprovante, a IA confere e o Gusthavo libera no painel (ou libera sozinho se ele ligar o automático).
// Chave Pix aleatória do Nubank (fixa no código — o site em index.html usa a mesma; a do Bradesco foi trocada).
export const PIX_MANUAL = {
  chave: (process.env.PIX_MANUAL_CHAVE || '13c18586-94b7-4c25-b9b9-562ea79fe41a').trim(),
  nome: (process.env.PIX_MANUAL_NOME || 'GUSTHAVO DOS SANTOS DE JESUS').trim(),
  banco: 'Nubank',
  cidade: (process.env.PIX_MANUAL_CIDADE || 'SAO PAULO').trim()
};
// "Já paguei" (sem comprovante): o pedido libera sozinho depois desse tempo, sem conferir o Pix.
export const ESPERA_JA_PAGUEI = 45 * 1000;
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(s) {
  let c = 0xFFFF;
  for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
// referência do pedido (vai no Pix e aparece em muitos comprovantes): só letras/números, até 25
export const refPedido = (id) => String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
export function brcode(valor, ref) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', PIX_MANUAL.chave);
  let s = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986') +
    campo('54', Number(valor).toFixed(2)) + campo('58', 'BR') + campo('59', semAcento(PIX_MANUAL.nome).slice(0, 25)) +
    campo('60', semAcento(PIX_MANUAL.cidade).slice(0, 15)) + campo('62', campo('05', refPedido(ref))) + '6304';
  return s + crc16(s);
}
// modo: 'auto' = tenta a Efí e, se ela recusar, usa o Pix manual · 'manual' = sempre Pix manual · 'efi' = só Efí
const cfgLoja = () => getStore('gastos');
let cache = null, cacheEm = 0;
export async function lerCfgPix() {
  if (cache && Date.now() - cacheEm < 30000) return cache;
  const c = (await cfgLoja().get('cfg_pixmanual', { type: 'json' }).catch(() => null)) || {};
  cache = { modo: ['auto', 'manual', 'efi'].indexOf(c.modo) >= 0 ? c.modo : 'auto', autoLiberar: c.autoLiberar !== false, semComprovante: c.semComprovante !== false, efiFalhouEm: c.efiFalhouEm || 0, efiErro: c.efiErro || '' };
  cacheEm = Date.now(); return cache;
}
export async function salvarCfgPix(m) { const c = Object.assign({}, await lerCfgPix(), m); await cfgLoja().setJSON('cfg_pixmanual', c); cache = c; cacheEm = Date.now(); return c; }
// Efí recusou há pouco? (não fica batendo nela a cada pedido: pula por 10 min)
export async function pularEfi() { const c = await lerCfgPix(); return c.modo === 'manual' || (c.modo === 'auto' && Date.now() - c.efiFalhouEm < 10 * 60e3); }
export async function marcarEfiFalhou(erro) { try { await salvarCfgPix({ efiFalhouEm: Date.now(), efiErro: String(erro || '').slice(0, 200) }); } catch (e) {} }
export async function podeManual() { return (await lerCfgPix()).modo !== 'efi'; }

// SEM COMPROVANTE (regra do Gusthavo, 12/11): liberou o Pix manual → libera a música em 1 minuto (ou na hora no "Já paguei")
export const ESPERA_LIBERAR = 60e3;
export async function marcarPendente(id) { try { await getStore('comprovantes').setJSON('pend_' + id, { id, em: Date.now() }); } catch (e) {} }
