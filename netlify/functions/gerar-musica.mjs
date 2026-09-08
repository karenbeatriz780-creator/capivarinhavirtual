function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const estilo = String((body && body.estilo) || '').trim();
    const texto = String((body && body.texto) || '').trim();
    if (!estilo) return json({ erro: 'Escolhe um estilo primeiro.' }, 400);
    if (!texto) return json({ erro: 'Conta um pouco da história de vocês.' }, 400);

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) {
      // Ainda sem a chave da Unifically configurada no Netlify.
      return json({ erro: 'A geração de música ainda está sendo configurada. Volta em breve!' }, 503);
    }

    // TODO: assim que eu tiver a documentação exata da Unifically (endpoint, formato
    // do corpo da requisição e formato da resposta), a chamada real entra aqui.
    // Por enquanto, mesmo com a chave presente, a integração não está pronta.
    return json({ erro: 'A geração de música ainda está sendo configurada. Volta em breve!' }, 503);

  } catch (e) {
    console.error('gerar-musica (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
