function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Tags de estilo em inglês — a Suno responde melhor a descrições de estilo em inglês,
// mesmo gerando a letra em português.
const ESTILOS = {
  romantica: 'romantic ballad, acoustic guitar and piano, warm and tender, brazilian',
  pop:       'emotional pop, soft synths, gentle beat, brazilian pop',
  sertanejo: 'sertanejo, viola caipira, brazilian country ballad, romantic',
  acustico:  'brazilian MPB, acoustic guitar, intimate vocals',
  festa:     'upbeat, celebratory, danceable, joyful, brazilian pop'
};

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const estilo = String((body && body.estilo) || '').trim();
    const texto = String((body && body.texto) || '').trim();
    const meuNome = String((body && body.meuNome) || '').trim();
    const parceiroNome = String((body && body.parceiroNome) || '').trim();
    if (!estilo) return json({ erro: 'Escolhe um estilo primeiro.' }, 400);
    if (!texto) return json({ erro: 'Conta um pouco da história de vocês.' }, 400);

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) {
      return json({ erro: 'A geração de música ainda está sendo configurada. Volta em breve!' }, 503);
    }

    const tagsEstilo = ESTILOS[estilo] || ESTILOS.romantica;
    const nomes = [meuNome, parceiroNome].filter(Boolean).join(' e ');
    const prompt = ('Uma música romântica em português, com letra emocionante, sobre a história de '
      + (nomes || 'um casal') + ': ' + texto).slice(0, 2900);
    const titulo = ('Nossa música' + (nomes ? ' - ' + nomes : '')).slice(0, 80);

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/tasks', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'suno-ai/music',
          input: {
            mv: 'chirp-bluejay',
            custom: true,
            prompt: prompt,
            tags: tagsEstilo,
            title: titulo
          }
        })
      });
    } catch (e) {
      console.error('Unifically (rede):', e && e.stack || e);
      return json({ erro: 'Não consegui falar com o servidor de música agora.' }, 502);
    }

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      console.error('Unifically criar tarefa:', resp.status, JSON.stringify(data));
      return json({ erro: 'Não consegui começar a geração da música agora.' }, 502);
    }

    // A Unifically embrulha o corpo real da resposta em "data": { success, code, data: {...} }
    const conteudo = (data && data.data) || data;
    const taskId = conteudo.task_id || conteudo.id;
    if (!taskId) {
      console.error('Unifically sem task_id:', JSON.stringify(data));
      return json({ erro: 'O serviço de música não retornou um identificador de tarefa.' }, 502);
    }

    return json({ ok: true, taskId: taskId });

  } catch (e) {
    console.error('gerar-musica (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
