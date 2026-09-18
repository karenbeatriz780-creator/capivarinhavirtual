import { getStore } from '@netlify/blobs';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Gênero vem SEMPRE primeiro e repetido — é o que mais pesa na fidelidade.
// Descrições enxutas: tag poluída faz a Suno misturar estilos.
// Nome do gênero em português — vai no BRIEFING, que é o texto que a Suno
// realmente lê no modo de composição. É aqui que o estilo é decidido.
const GENERO_PT = {
  romantica:'balada romântica pop, com piano, cordas orquestrais e um violão suave de estúdio (produção pop, não country)',
  sertanejo:'sertanejo, com viola caipira e sanfona',
  pop:'pop moderno, com sintetizadores e batida marcada',
  rock:'rock, com guitarra distorcida, baixo e bateria',
  mpb:'MPB, com violão de nylon',
  bossa:'bossa nova, com violão e suingue suave',
  gospel:'gospel de adoração, com piano e coral',
  samba:'samba, com cavaquinho e pandeiro',
  pagode:'pagode, com cavaquinho e tantã',
  forro:'forró, com sanfona, zabumba e triângulo',
  piseiro:'piseiro, com sanfona eletrônica e batida dançante',
  funk:'funk carioca, com batida 808 pesada',
  trap:'trap, com 808 e hi-hats rápidos',
  eletronica:'música eletrônica, com sintetizadores e batida de pista',
  reggae:'reggae, com guitarra no contratempo e baixo grave',
  jazz:'jazz, com saxofone e contrabaixo acústico',
  blues:'blues, com guitarra e gaita',
  axe:'axé, com percussão de carnaval e metais',
  lofi:'lo-fi, com batida suave e clima tranquilo',
  infantil:'música infantil, alegre e simples'
};

// A Suno tende a "cair" sempre em sertanejo ou samba — são os gêneros mais
// comuns do Brasil. Pra cada gênero, isso é o que ele NÃO pode soar.
const GENERO_EVITAR = {
  romantica:'sertanejo, viola caipira, sanfona, batida de forró ou piseiro',
  pop:'sertanejo, samba',
  rock:'sertanejo, samba, forró',
  mpb:'sertanejo, pagode',
  bossa:'sertanejo, samba pesado, forró',
  gospel:'sertanejo, samba',
  sertanejo:'samba, pagode',
  samba:'sertanejo',
  pagode:'sertanejo, samba de salão',
  forro:'sertanejo, piseiro eletrônico',
  piseiro:'forró tradicional, sertanejo',
  funk:'sertanejo, trap',
  trap:'funk carioca, sertanejo',
  eletronica:'sertanejo, samba',
  reggae:'sertanejo, samba',
  jazz:'sertanejo, samba',
  blues:'sertanejo, samba',
  axe:'sertanejo',
  lofi:'sertanejo, samba',
  infantil:'sertanejo, samba'
};

// Instrução de voz em português — vai no texto que a Suno lê, não só nas
// tags, porque tag sozinha vem sendo ignorada no modo de composição.
const VOZ_PT = {
  masculina:'A música deve ser cantada inteiramente por uma voz masculina.',
  feminina:'A música deve ser cantada inteiramente por uma voz feminina.',
  dueto:'A música deve ser um dueto: uma voz masculina e uma voz feminina cantando junto ou se revezando.'
};
const GENEROS = {
  romantica:  'romantic ballad, acoustic guitar, soft piano, strings, tender vocals',
  sertanejo:  'sertanejo, viola caipira, acoustic guitar, accordion, country ballad',
  pop:        'pop, synth, punchy drums, catchy hook, radio production',
  rock:       'rock, distorted electric guitars, live drums, bass, driving riff',
  mpb:        'MPB, nylon string guitar, subtle percussion, jazzy chords',
  bossa:      'bossa nova, nylon guitar, brushed drums, soft swing, jazz harmony',
  gospel:     'gospel, church organ, piano, choir, worship',
  samba:      'samba, cavaquinho, pandeiro, surdo, tamborim',
  pagode:     'pagode, cavaquinho, tantã, banjo, repique de mão',
  forro:      'forró, accordion, zabumba, triangle, northeastern groove',
  piseiro:    'piseiro, electronic accordion, programmed beat, danceable',
  funk:       'funk carioca, heavy 808 beat, baile funk percussion, urban',
  trap:       'trap, 808 bass, hi-hat rolls, dark synth, hip hop beat',
  eletronica: 'EDM, electronic synths, four on the floor beat, club production',
  reggae:     'reggae, offbeat guitar skank, dub bass, laid back groove',
  jazz:       'jazz, saxophone, upright bass, brushed drums, swing',
  blues:      'blues, electric blues guitar, slow shuffle, harmonica',
  axe:        'axé, carnival percussion, brass section, upbeat dance',
  lofi:       'lo-fi, mellow beat, vinyl texture, chill',
  infantil:   "children's song, playful melody, xylophone, simple bright arrangement"
};
const CLIMA_PT = {
  alegre:'alegre e contagiante', emocionante:'emocionante, de arrepiar',
  romantica:'romântico e apaixonado', calma:'calmo e suave',
  nostalgica:'nostálgico, de saudade', festiva:'festivo, de celebração',
  energetica:'energético e vibrante', divertida:'divertido e bem-humorado',
  inspiradora:'inspirador, de superação', melancolica:'melancólico'
};
const CLIMAS = {
  alegre:'joyful', emocionante:'emotional', romantica:'romantic', calma:'gentle',
  nostalgica:'nostalgic', festiva:'celebratory', energetica:'energetic',
  divertida:'playful', inspiradora:'uplifting', melancolica:'melancholic'
};
const VOZES = { masculina:'male vocals', feminina:'female vocals', dueto:'male and female duet vocals' };

// Relação e ocasião viram tag de estilo — orientam o clima da música
// sem virar texto cantado.
// Como tratar cada nicho dentro do briefing da letra
const NICHO_TEXTO = {
  namorada:'a namorada', namorado:'o namorado', esposa:'a esposa', marido:'o marido',
  mae:'a mãe', pai:'o pai', irma:'a irmã', irmao:'o irmão',
  amiga:'a melhor amiga', amigo:'o melhor amigo', filho:'o filho ou filha'
};
// O que a letra NUNCA pode fazer em cada nicho — evita constrangimento
const NICHO_EVITAR = {
  mae:'A letra é de filho para mãe: nunca use linguagem romântica ou de casal.',
  pai:'A letra é de filho para pai: nunca use linguagem romântica ou de casal.',
  irma:'A letra é entre irmãos: nunca use linguagem romântica.',
  irmao:'A letra é entre irmãos: nunca use linguagem romântica.',
  amiga:'A letra é sobre amizade: nunca use linguagem romântica ou de paixão.',
  amigo:'A letra é sobre amizade: nunca use linguagem romântica ou de paixão.',
  filho:'A letra é de pai/mãe para filho: nunca use linguagem romântica.'
};
const RELACOES_TAG = {
  namorada:'romantic love song for a girlfriend', namorado:'romantic love song for a boyfriend',
  esposa:'love song for a wife, mature devoted love', marido:'love song for a husband, mature devoted love',
  mae:'heartfelt tribute to a mother, gratitude, not romantic',
  pai:'heartfelt tribute to a father, gratitude, not romantic',
  irma:'song about sibling bond, not romantic', irmao:'song about sibling bond, not romantic',
  amiga:'song about friendship, not romantic', amigo:'song about friendship, not romantic',
  filho:'song from a parent to their child, not romantic'
};
const OCASIOES_TAG = {
  'Aniversário':'birthday celebration', 'Aniversário de casamento':'wedding anniversary',
  'Dia dos Namorados':'valentines day', 'Dia das Mães':'mothers day',
  'Dia dos Pais':'fathers day', 'Declaração de amor':'love confession',
  'Pedido de namoro':'asking someone out', 'Aniversário de namoro':'dating anniversary',
  'Formatura':'graduation celebration', 'Chá revelação':'gender reveal celebration',
  'Surpresa':'surprise gift', 'Homenagem':'heartfelt tribute'
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

    // TAGS = estilo musical + contexto. Gênero primeiro e repetido no fim pra reforçar.
    // Relação e ocasião entram aqui (e não na letra) pra guiar o clima sem serem cantadas.
    // TAGS = SÓ o que é musical. Relação e ocasião saem daqui (são semânticas,
    // não sonoras) e ficam só no briefing da letra.
    // "brazilian" sozinho foi removido: puxava tudo pra samba/bossa.
    const gen = GENEROS[estilo] || GENEROS.romantica;
    const tagsPartes = [gen, gen.split(',')[0], 'portuguese vocals'];
    if (CLIMAS[clima]) tagsPartes.push(CLIMAS[clima]);
    if (VOZES[voz]) tagsPartes.push(VOZES[voz]);
    tagsPartes.push(gen.split(',')[0]); // terceiro reforço do gênero
    const tagsEstilo = tagsPartes.join(', ');

    // BRIEFING: a Suno compõe a letra a partir daqui (não é cantado literalmente).
    // Por isso as palavras-chave da pessoa viram matéria-prima, não a letra pronta.
    var b = [];
    var genPT = GENERO_PT[estilo] || GENERO_PT.romantica;
    var genNome = genPT.split(',')[0];
    // O gênero vem PRIMEIRO e é repetido: é o que mais pesa na composição.
    b.push('Gênero musical: ' + genNome.toUpperCase() + '. ');
    b.push('Componha uma música de ' + genPT);
    b.push(', cantada em português do Brasil');
    if (NICHO_TEXTO[relacao]) b.push(', dedicada para ' + NICHO_TEXTO[relacao]);
    if (ocasiao) b.push(', para a ocasião de ' + ocasiao.toLowerCase());
    b.push('. Use estes detalhes reais da história como base da letra: ' + texto);
    if (nomesLetra) b.push(' Cite na letra os nomes: ' + nomesLetra + '.');
    if (frase) b.push(' Inclua a frase: "' + frase + '".');
    b.push(' A música deve ter dois versos, um refrão marcante que se repete, e uma ponte.');
    b.push(' Use imagens concretas da história, evite frases genéricas.');
    if (NICHO_EVITAR[relacao]) b.push(' ' + NICHO_EVITAR[relacao]);
    if (CLIMA_PT[clima]) b.push(' O clima da música deve ser ' + CLIMA_PT[clima] + '.');
    if (VOZ_PT[voz]) b.push(' ' + VOZ_PT[voz]);
    b.push(' IMPORTANTE: o arranjo e a instrumentação devem ser de ' + genNome +
           ', e não de outro estilo.');
    if (GENERO_EVITAR[estilo]) {
      b.push(' Isso NÃO pode soar como ' + GENERO_EVITAR[estilo] + '.');
    }
    const prompt = b.join('').slice(0, 2900);

    // Registra exatamente o que vai pra Suno — é o que permite conferir,
    // quando a música sai fora do estilo, se o erro foi nosso ou dela.
    console.log('PEDIDO DE MUSICA >> genero=' + estilo + ' | clima=' + clima +
      ' | voz=' + voz + ' | relacao=' + relacao + ' | ocasiao=' + ocasiao);
    console.log('TAGS >> ' + tagsEstilo);
    console.log('BRIEFING >> ' + prompt);

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

    // Registra TODA geração — mesmo que a pessoa nunca chegue a pagar.
    // É o que garante que a música apareça no painel de qualquer jeito.
    try {
      await getStore('musicas').setJSON(taskId, {
        taskId: taskId,
        criadoEm: Date.now(),
        estilo: estilo,
        clima: clima,
        relacao: relacao,
        ocasiao: ocasiao,
        nomes: nomesLetra,
        historia: texto.slice(0, 400),
        whatsapp: String((body && body.whatsapp) || '').trim(),
        pago: false,
        url: null,
        url2: null
      });
    } catch (e) {
      // se o registro falhar, a música ainda deve ser gerada normalmente
      console.error('Falha ao registrar música:', e && e.message);
    }

    return json({ ok: true, taskId: taskId });

  } catch (e) {
    console.error('gerar-musica (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
