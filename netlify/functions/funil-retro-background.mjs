// 🔻 Funil da música — RETROATIVO (17/11): usa o registro antigo de passos (store "funil", gravado desde sempre pelo site)
// + o índice de pedidos (Pix/cartão gerado) e pagos. Não tem "entrou no site" nem aparelho (isso só existe a partir de 17/11).
// POST {dias: 1|7|15} com x-admin-key → salva em gastos/funil_retro_<dias>
import { getStore } from '@netlify/blobs';
import { idsDoDia } from './_indice.mjs';

const ETAPAS = ['musicaPara', 'musicaNome', 'musicaOcasiao', 'musicaGenero', 'musicaClima', 'musicaHistoria', 'musicaLetra', 'musicaFinal', 'escolha', 'pagamento', 'pagou'];
export default async (req) => {
  const senha = (process.env.ADMIN_SENHA || '').trim();
  if (!senha || (req.headers.get('x-admin-key') || '') !== senha) return;
  let b = {}; try { b = await req.json(); } catch (e) {}
  const dias = [1, 7, 15].indexOf(Number(b.dias)) >= 0 ? Number(b.dias) : 7;
  const G = getStore('gastos'), chave = 'funil_retro_' + dias;
  await G.setJSON(chave, { status: 'gerando', em: Date.now() });
  try {
    const agora = Date.now(), dia = (i) => new Date(agora - 3 * 36e5 - i * 864e5).toISOString().slice(0, 10);
    // dias completos: "1 dia" = ontem; "7 dias" = ontem e os 6 antes
    const lista = []; for (let i = 1; i <= dias; i++) lista.push(dia(i));
    const ini = Date.parse(lista[lista.length - 1] + 'T03:00:00Z'), fim = Date.parse(dia(0) + 'T03:00:00Z');
    const st = getStore('funil'), { blobs } = await st.list();
    const cont = {}; ETAPAS.forEach((e) => { cont[e] = 0; });
    const ids = new Set();
    for (let i = 0; i < blobs.length; i += 150) {
      const regs = await Promise.all(blobs.slice(i, i + 150).map((x) => st.get(x.key, { type: 'json' }).catch(() => null)));
      for (const r of regs) {
        if (!r || r.dev || r.produto !== 'musica') continue;
        const t = r.primeiraVez || r.ultimaVez || 0; if (t < ini || t >= fim) continue;
        ids.add(String(r.id));
        const vistos = new Set((r.passosVistos || [r.passo]).map((k) => (k === 'checkout' ? 'escolha' : k)));
        ETAPAS.forEach((e) => { if (vistos.has(e)) cont[e]++; });
      }
    }
    const pag = new Set(), pagou = new Set();
    for (const d of lista.concat([dia(0)])) {
      (await idsDoDia(d, 'p').catch(() => [])).forEach((x) => { if (ids.has(x)) pag.add(x); });
      (await idsDoDia(d, 'pg').catch(() => [])).forEach((x) => { if (ids.has(x)) pagou.add(x); });
    }
    cont.pagamento = Math.max(cont.pagamento, pag.size); cont.pagou = pagou.size;
    if (cont.escolha < cont.pagamento) cont.escolha = cont.pagamento;
    await G.setJSON(chave, { status: 'pronto', em: Date.now(), dias, de: lista[lista.length - 1], ate: lista[0], etapas: ETAPAS.map((e) => ({ e, total: cont[e] })) });
  } catch (e) { await G.setJSON(chave, { status: 'erro', erro: String(e && e.message || e), em: Date.now() }); }
};
