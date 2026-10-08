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
// IMPORTANTE: descrever pela INSTRUMENTAÇÃO certa. Dizer "viola caipira e
// sanfona" no sertanejo entrega modão/raiz (Leonardo), não o sertanejo
// universitário moderno (Zé Neto, Luan Santana) que o cliente espera.
const GENERO_PT = {
  romantica:'balada romântica pop, com piano, cordas orquestrais e violão suave de estúdio, produção pop moderna',
  sertanejo:'sertanejo universitário moderno, com violão, guitarra elétrica limpa, baixo, bateria e teclado, produção de estúdio atual e polida, estilo romântico de rádio e arena',
  pop:'pop moderno, com sintetizadores, baixo marcado e batida eletrônica de rádio',
  rock:'rock pesado, com guitarra elétrica distorcida, riff marcado, baixo encorpado e bateria forte',
  mpb:'MPB, com violão de nylon dedilhado, arranjo intimista e percussão discreta',
  bossa:'bossa nova, com violão de nylon em batida sincopada, vassourinha na bateria e harmonia de jazz',
  gospel:'gospel de adoração, com piano, órgão, cordas e coral em crescendo',
  samba:'samba, com cavaquinho, pandeiro, surdo e tamborim',
  pagode:'pagode, com cavaquinho, tantã, banjo e repique de mão',
  forro:'forró pé de serra, com sanfona, zabumba e triângulo',
  piseiro:'piseiro, com sanfona eletrônica, batida programada e groove dançante',
  funk:'funk carioca, com batida 808 pesada e percussão de baile',
  trap:'trap, com 808 grave, hi-hats rápidos e sintetizador sombrio',
  eletronica:'música eletrônica de pista, com sintetizadores, drop e batida four on the floor',
  reggae:'reggae, com guitarra no contratempo, baixo grave e bateria com groove arrastado',
  jazz:'jazz, com saxofone, contrabaixo acústico, piano e vassourinha na bateria',
  blues:'blues, com guitarra elétrica de blues, gaita e levada arrastada',
  axe:'axé baiano, com percussão de carnaval, metais e guitarra baiana',
  lofi:'lo-fi, com batida suave, textura de vinil e teclado sonhador',
  infantil:'música infantil, alegre e simples, com xilofone e melodia cantarolável'
};

// A Suno tende a "cair" sempre em sertanejo ou samba — são os gêneros mais
// comuns do Brasil. Pra cada gênero, isso é o que ele NÃO pode soar.
const GENERO_EVITAR = {
  romantica:'sertanejo, modão, viola caipira, sanfona, country ou batida de forró',
  pop:'sertanejo, samba',
  rock:'sertanejo, samba, forró',
  mpb:'sertanejo, pagode',
  bossa:'sertanejo, samba pesado, forró',
  gospel:'sertanejo, samba',
  sertanejo:'sertanejo raiz, modão, música caipira antiga, viola caipira, sanfona, samba',
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
// O clima tem que mudar o ARRANJO, não só a letra. Sem isso, "rock animado"
// sai com a mesma pegada de "rock melancólico".
const CLIMA_ARRANJO = {
  alegre:'andamento acelerado, arranjo cheio e vibrante',
  emocionante:'começa suave e cresce até um refrão grandioso e emocionado',
  romantica:'andamento médio, arranjo suave e envolvente',
  calma:'andamento lento, arranjo enxuto e delicado',
  nostalgica:'andamento médio, arranjo saudoso, com espaço entre os instrumentos',
  festiva:'andamento animado, arranjo cheio e comemorativo',
  energetica:'andamento rápido, execução intensa e crua, instrumentos com força total',
  divertida:'andamento saltitante, arranjo leve e brincalhão',
  inspiradora:'crescimento gradual até um final grandioso e triunfante',
  melancolica:'andamento lento, arranjo contido e sentido'
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
    const letraAprovada = String((body && body.letraAprovada) || '').trim();

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

    // BRIEFING (gpt_description_prompt): A DOCUMENTAÇÃO DA UNIFICALLY/SUNO
    // DIZ QUE ESSE CAMPO SÓ ACEITA ATÉ 500 CARACTERES no modo custom:false.
    // O código antigo montava um texto de até 2900 caracteres (gênero +
    // nicho + ocasião + história + nomes + frase + clima + arranjo + voz +
    // avisos de gênero) e mandava tudo — ou seja, só os primeiros ~500
    // caracteres chegavam de verdade na Suno, e o resto (quase sempre a
    // frase exata, os nomes e o final da história) nunca era lido. Era
    // isso que fazia a letra sair sem nada do que a pessoa escreveu.
    // Agora a prioridade dentro dos 500 caracteres é: 1) a história da
    // pessoa (recebe o espaço que sobrar — é o que ela mais quer ver na
    // letra), 2) a frase exata e os nomes (sempre garantidos, por serem
    // curtos), 3) o aviso de "não seja romântico" quando for mãe/pai/
    // irmão/amigo (evita constrangimento). Gênero e clima já vão garantidos
    // pelas TAGS (acima) e não precisam repetir aqui.
    var genPT = GENERO_PT[estilo] || GENERO_PT.romantica;
    var genNome = genPT.split(',')[0];
    var LIMITE_BRIEFING = 500;
    var fixos = [];
    if (frase) fixos.push('Inclua esta frase: "' + frase + '"');
    if (nomesLetra) fixos.push('Cite os nomes: ' + nomesLetra);
    if (NICHO_EVITAR[relacao]) fixos.push(NICHO_EVITAR[relacao]);
    var sufixo = fixos.length ? ('. ' + fixos.join('. ')) : '';
    var prefixo = 'Gênero ' + genNome + '. Letra em português, sobre: ';
    var espacoHistoria = Math.max(40, LIMITE_BRIEFING - prefixo.length - sufixo.length);
    var historiaUsada = texto.length > espacoHistoria
      ? texto.slice(0, espacoHistoria - 1).trim() + '…'
      : texto;
    const prompt = (prefixo + historiaUsada + sufixo).slice(0, LIMITE_BRIEFING);

    // MODO LITERAL: quando já existe uma letra aprovada pela pessoa (fluxo novo,
    // com prévia da letra por IA antes de compor), a Suno recebe essa letra
    // EXATA no campo "prompt" do modo custom — é o único jeito de garantir que
    // o que a pessoa aprovou saia igual, cantado. Sem letra aprovada (fluxo
    // antigo / chamada direta), cai no modo por descrição de sempre.
    const usarLetraLiteral = letraAprovada.length > 0;
    const inputSuno = usarLetraLiteral
      ? {
          mv: 'chirp-bluejay',
          custom: true,
          prompt: letraAprovada.slice(0, 5000),
          tags: tagsEstilo,
          title: 'Nossa música'
        }
      : {
          mv: 'chirp-bluejay',
          custom: false,
          gpt_description_prompt: prompt,
          tags: tagsEstilo,
          title: 'Nossa música'
        };

    // Registra exatamente o que vai pra Suno — é o que permite conferir,
    // quando a música sai fora do estilo, se o erro foi nosso ou dela.
    console.log('PEDIDO DE MUSICA >> genero=' + estilo + ' | clima=' + clima +
      ' | voz=' + voz + ' | relacao=' + relacao + ' | ocasiao=' + ocasiao +
      ' | modo=' + (usarLetraLiteral ? 'letra literal (custom)' : 'briefing (500 car.)'));
    console.log('TAGS >> ' + tagsEstilo);
    if (usarLetraLiteral) console.log('LETRA APROVADA >> ' + inputSuno.prompt);
    else console.log('BRIEFING >> ' + prompt);

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/tasks', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'suno-ai/music',
          input: inputSuno
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
        letraAprovada: usarLetraLiteral ? inputSuno.prompt : null,
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
