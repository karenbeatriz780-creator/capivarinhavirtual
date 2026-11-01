// LIVRO MÁGICO — gera os 3 PDFs do livro (em segundo plano, pode levar alguns segundos)
// POST { id, para? }  → se vier "para" (WhatsApp), manda os PDFs pra ele quando ficarem prontos
import { getStore } from '@netlify/blobs';
import { gerarPdfsLivro } from './_pdf.mjs';
import { enviarPdfsLivro, pdfsProntos } from './_livros.mjs';

export default async (req) => {
  let b = {}; try { b = await req.json(); } catch (e) {}
  const id = String(b.id || '');
  if (!/^L[0-9a-f]{14}$/.test(id)) return;
  try {
    const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
    if (!g || !g.livro || !g.pago) return;
    if (!(await pdfsProntos(g)) || b.refazer) {
      const r = await gerarPdfsLivro(id);
      if (r.erro) { console.error('livro-pdf', id, r.erro); return; }
    }
    if (b.para) await enviarPdfsLivro(String(b.para), g);
  } catch (e) { console.error('livro-pdf-background', id, e && e.stack || e); }
};
