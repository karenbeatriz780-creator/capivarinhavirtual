function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Gênero vem SEMPRE primeiro e repetido — é o que mais pesa na fidelidade.
// Descrições enxutas: tag poluída faz a Suno misturar estilos.
const GENEROS = {
  romantica:  'romantic ballad, acoustic guitar, piano, tender',
  sertanejo:  'sertanejo, viola caipira, brazilian country, sertanejo universitario',
  pop:        'pop, catchy, modern production',
  rock:       'rock, electric guitars, drums, driving',
  mpb:        'MPB, musica popular brasileira, acoustic',
  bossa:      'bossa nova, nylon guitar, soft swing',
  gospel:     'gospel, worship, uplifting',
  samba:      'samba, cavaquinho, pandeiro, brazilian samba',
  pagode:     'pagode, cavaquinho, tantã, brazilian pagode',
  forro:      'forró, accordion, zabumba, triangle, northeastern brazilian',
  piseiro:    'piseiro, electronic accordion, danceable northeastern brazilian',
  funk:       'brazilian funk, heavy beat, funk carioca',
  trap:       'trap, hip hop, 808 bass',
  eletronica: 'EDM, electronic dance, synths',
  reggae:     'reggae, offbeat guitar, laid back groove',
  jazz:       'jazz, saxophone, swing, upright bass',
  blues:      'blues, blues guitar, slow shuffle',
  axe:        'axé, brazilian carnival, percussion, upbeat',
  lofi:       'lo-fi, chill, mellow beat',
  infantil:   "children's song, playful, simple melody"
};
const CLIMAS = {
  alegre:'joyful', emocionante:'emotional', romantica:'romantic', calma:'gentle',
  nostalgica:'nostalgic', festiva:'celebratory', energetica:'energetic',
  divertida:'playful', inspiradora:'uplifting', melancolica:'melancholic'
};
const VOZES = { masculina:'male vocals', feminina:'female vocals', dueto:'male and female duet vocals' };

// Cada nicho tem seu jeito de falar. Isso é o que faz uma música pra mãe não
// soar como declaração de namorado — e a de amigo não virar canção de amor.
const NICHOS = {
  namorada: { tratamento:'a namorada de quem está enviando',
    tom:'apaixonado e carinhoso, com declaração de amor romântico',
    evitar:'evite soar como amizade ou como relação familiar' },
  namorado: { tratamento:'o namorado de quem está enviando',
    tom:'apaixonado e carinhoso, com declaração de amor romântico',
    evitar:'evite soar como amizade ou como relação familiar' },
  esposa: { tratamento:'a esposa de quem está enviando',
    tom:'amor maduro, de parceria construída e vida compartilhada',
    evitar:'evite tom de paquera ou de começo de namoro' },
  marido: { tratamento:'o marido de quem está enviando',
    tom:'amor maduro, de parceria construída e vida compartilhada',
    evitar:'evite tom de paquera ou de começo de namoro' },
  mae: { tratamento:'a mãe de quem está enviando',
    tom:'gratidão, colo, cuidado recebido a vida inteira, admiração profunda',
    evitar:'NUNCA use linguagem romântica ou de casal — é amor de filho para mãe' },
  pai: { tratamento:'o pai de quem está enviando',
    tom:'gratidão, exemplo, orgulho, força e proteção recebidas',
    evitar:'NUNCA use linguagem romântica ou de casal — é amor de filho para pai' },
  irma: { tratamento:'a irmã de quem está enviando',
    tom:'cumplicidade de quem cresceu junto, brigas e reconciliações, parceria de vida',
    evitar:'NUNCA use linguagem romântica — é amor entre irmãos' },
  irmao: { tratamento:'o irmão de quem está enviando',
    tom:'cumplicidade de quem cresceu junto, brigas e reconciliações, parceria de vida',
    evitar:'NUNCA use linguagem romântica — é amor entre irmãos' },
  amiga: { tratamento:'a melhor amiga de quem está enviando',
    tom:'amizade verdadeira, lealdade, estar junto nos perrengues e nas festas',
    evitar:'NUNCA use linguagem romântica ou de paixão — é amizade' },
  amigo: { tratamento:'o melhor amigo de quem está enviando',
    tom:'amizade verdadeira, lealdade, estar junto nos perrengues e nas festas',
    evitar:'NUNCA use linguagem romântica ou de paixão — é amizade' },
  filho: { tratamento:'o filho ou filha de quem está enviando',
    tom:'amor de pai/mãe, orgulho de ver crescer, desejo de proteger',
    evitar:'NUNCA use linguagem romântica — é amor de pai/mãe para filho' }
};

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

    let body;
    try { body = await req.json(); }
    catch { return json({ erro: 'JSON inválido.' }, 400); }

    const estilo = String((body && body.estilo) || '').trim();
    const texto = String((body && body.texto) || '').trim();
    const clima = String((body && body.clima) || '').trim();
    const relacao = String((body && body.relacao) || '').trim();
    const ocasiao = String((body && body.ocasiao) || '').trim();
    const nomesLetra = String((body && body.nomesLetra) || '').trim();
    const frase = String((body && body.frase) || '').trim();
    const voz = String((body && body.voz) || '').trim();

    if (!estilo) return json({ erro: 'Escolhe um estilo primeiro.' }, 400);
    if (texto.length < 50) return json({ erro: 'Conta um pouco mais da história (pelo menos 50 caracteres).' }, 400);

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) {
      return json({ erro: 'A geração de música ainda está sendo configurada. Volta em breve!' }, 503);
    }

    // TAGS = só estilo musical. Gênero primeiro e repetido no fim pra reforçar.
    const gen = GENEROS[estilo] || GENEROS.romantica;
    const tagsPartes = [gen, 'sung in portuguese', 'brazilian'];
    if (CLIMAS[clima]) tagsPartes.push(CLIMAS[clima]);
    if (VOZES[voz]) tagsPartes.push(VOZES[voz]);
    tagsPartes.push(gen.split(',')[0]); // reforço final do gênero
    const tagsEstilo = tagsPartes.join(', ');

    // PROMPT = o briefing da letra. A Suno escreve a letra a partir daqui,
    // então quanto mais específico e ciente do nicho, melhor o resultado.
    const nicho = NICHOS[relacao] || null;
    var partes = [];
    partes.push('Componha a letra de uma música original em português do Brasil.');
    if (nicho) {
      partes.push('A música é dedicada para ' + nicho.tratamento + '.');
      partes.push('Tom: ' + nicho.tom + '.');
      partes.push('IMPORTANTE: ' + nicho.evitar + '.');
    }
    if (ocasiao) partes.push('Ocasião: ' + ocasiao.toLowerCase() + '. A letra deve fazer referência a esse momento.');
    partes.push('Baseie a letra nesta história real, usando os detalhes concretos que aparecem nela (lugares, datas, apelidos, situações): ' + texto);
    if (nomesLetra) partes.push('Cite estes nomes ao longo da letra: ' + nomesLetra + '.');
    if (frase) partes.push('Inclua esta frase exata em algum ponto da letra: "' + frase + '".');
    partes.push('Estrutura: dois versos, um refrão forte e memorável que se repete, e uma ponte.');
    partes.push('Use linguagem natural e brasileira, com imagens concretas em vez de clichês genéricos.');
    const prompt = partes.join(' ').slice(0, 2900);

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/tasks', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'suno-ai/music',
          input: {
            mv: 'chirp-bluejay',
            custom: false,
            gpt_description_prompt: prompt,
            prompt: prompt,
            tags: tagsEstilo,
            title: 'Nossa música'
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

    const conteudoResp = (data && data.data) || data;
    const taskId = conteudoResp.task_id || conteudoResp.id;
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
