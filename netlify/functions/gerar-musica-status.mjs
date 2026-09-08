function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function acharUrlAudio(data) {
  const tentativas = [
    () => data.output && data.output.audio_url,
    () => data.output && data.output.url,
    () => data.output && Array.isArray(data.output) && data.output[0] && data.output[0].audio_url,
    () => data.output && Array.isArray(data.output) && data.output[0] && data.output[0].url,
    () => data.output && Array.isArray(data.output.clips) && data.output.clips[0] && data.output.clips[0].audio_url,
    () => data.result && data.result.audio_url,
    () => data.result && data.result.url,
    () => data.audio_url,
    () => data.url
  ];
  for (const t of tentativas) {
    try { const v = t(); if (v) return v; } catch (e) {}
  }
  return null;
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    if (!taskId) return json({ erro: 'Faltou o identificador da tarefa.' }, 400);

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) return json({ erro: 'A geração de música ainda está sendo configurada.' }, 503);

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/tasks/' + encodeURIComponent(taskId), {
        headers: { Authorization: 'Bearer ' + apiKey }
      });
    } catch (e) {
      console.error('Unifically status (rede):', e && e.stack || e);
      return json({ erro: 'Não consegui checar o andamento agora.' }, 502);
    }

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      console.error('Unifically status:', resp.status, JSON.stringify(data));
      return json({ erro: 'Não consegui checar o andamento agora.' }, 502);
    }

    const status = (data.status || '').toLowerCase();
    if (status === 'failed' || status === 'error') {
      console.error('Unifically tarefa falhou:', JSON.stringify(data));
      return json({ pronto: false, falhou: true, erro: 'A geração falhou. Tenta de novo.' });
    }

    const audioUrl = acharUrlAudio(data);
    if (audioUrl) return json({ pronto: true, url: audioUrl });

    // Ainda processando — loga a resposta crua só na primeira vez que isso acontecer
    // seria útil, mas por simplicidade deixamos o front seguir tentando.
    return json({ pronto: false });

  } catch (e) {
    console.error('gerar-musica-status (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
