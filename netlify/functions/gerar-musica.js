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
  infantil:'música infantil, alegre e simples, com xilofone e melodia cantarolável',
  anos80:'pop rock dos anos 80, com sintetizadores analógicos, bateria eletrônica com reverb e guitarra retrô',
  eletrofunk:'eletrofunk, com batida de funk acelerada misturada com sintetizadores e drops eletrônicos',
  bregafunk:'brega funk recifense, com batida de brega funk, teclado e graves marcados',
  funkcria:'funk de cria, funk de favela com batida de baile pesada, 808 e vocal falado e marrento',
  jingle:'jingle comercial de rádio, curto, alegre e chiclete, com refrão grudento e produção pop limpa',
  sertanejoraiz:'sertanejo raiz, modão de viola caipira, dupla caipira, violão e sanfona, clima de interior',
  funkantigo:'funk carioca antigo dos anos 2000, funk melody com tamborzão e batida volt mix',
  gospeltrad:'hino gospel tradicional de igreja evangélica, estilo Assembleia de Deus, com teclado, órgão e coral congregacional',
  catolica:'música católica de missa, com violão, teclado e coral, clima de oração e louvor',
  arrocha:'arrocha baiano, com teclado, guitarra melódica e batida romântica dançante',
  tecnobrega:'tecnobrega paraense de aparelhagem, com batida eletrônica acelerada, teclado e guitarra',
  anos60:'rock e pop dos anos 60, estilo internacional retrô, com guitarra twang, órgão e bateria vintage',
  anos70:'disco e soul dos anos 70, estilo internacional, com baixo funkeado, metais, cordas e groove dançante',
  melody:'tecnomelody paraense, com teclado eletrônico, batida eletrônica romântica e vocal apaixonado',
  bregamarcante:'brega marcante paraense, com guitarra marcante, teclado e batida dançante de salão',
  batidao:'batidão de paredão, com grave pesado, batida eletrônica forte e teclado, feito pra tocar alto',
  seresta:'seresta, com teclado, violão e voz sofrida, clima de bar e sofrência',
  bregaromantico:'brega romântico dos anos 80 e 90, com teclado, guitarra e metais, bem apaixonado',
  carimbo:'carimbó paraense, com curimbó, maracas, banjo e sopro, ritmo de roda',
  lambada:'lambada, com guitarra, teclado e percussão acelerada, bem dançante',
  forroeletronico:'forró eletrônico, com sanfona, teclado, guitarra e bateria, estilo vaquejada',
  xote:'xote e baião nordestino, com sanfona, zabumba e triângulo, bem tradicional',
  pagodao:'pagodão baiano, com percussão pesada, guitarra baiana e swing acelerado',
  pagode90:'pagode romântico dos anos 90, com cavaquinho, banjo, teclado e coro',
  sambaraiz:'samba de raiz, roda de samba com cavaquinho, violão de 7 cordas, pandeiro e surdo',
  sambaenredo:'samba-enredo, com bateria de escola de samba, cavaquinho e coro forte',
  choro:'choro, com flauta, cavaquinho, violão de 7 cordas e pandeiro',
  frevo:'frevo, com metais, caixa e ritmo acelerado de carnaval',
  boibumba:'toada de boi-bumbá de Parintins, com tambores, palmas e coro grandioso',
  vanera:'vanerão gaúcho, com gaita (acordeão), violão e baixo, ritmo de fandango',
  jovemguarda:'Jovem Guarda dos anos 60, iê-iê-iê com guitarra, órgão e bateria retrô',
  rapnacional:'rap nacional, com batida boom bap, sample e rimas faladas',
  anos90:'pop e dance dos anos 90, estilo internacional, com sintetizadores, batida eurodance e refrão marcante',
  zoeira:'música de zoeira, estilo paródia cômica, arranjo animado, exagerado e engraçado',
  natal:'música natalina de Natal, com sinos, piano, cordas e coral, clima festivo e emocionante de fim de ano'
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
  infantil:'sertanejo, samba',
  anos80:'sertanejo, samba, trap',
  eletrofunk:'sertanejo, samba, rock',
  bregafunk:'sertanejo, samba, rock',
  funkcria:'sertanejo, samba, pop',
  jingle:'sertanejo romântico, balada lenta',
  sertanejoraiz:'sertanejo universitário, pop, eletrônico',
  funkantigo:'trap, funk moderno de 150 bpm',
  gospeltrad:'pop, eletrônico, sertanejo',
  catolica:'sertanejo, eletrônico',
  arrocha:'samba, rock',
  tecnobrega:'sertanejo, samba',
  anos60:'sertanejo, samba, eletrônico moderno',
  anos70:'sertanejo, samba, trap',
  melody:'sertanejo, samba, rock',
  bregamarcante:'sertanejo, samba',
  batidao:'sertanejo, samba, rock',
  seresta:'rock, trap',
  bregaromantico:'trap, eletrônico',
  carimbo:'sertanejo, eletrônico',
  lambada:'sertanejo, rock',
  forroeletronico:'sertanejo, samba',
  xote:'eletrônico, sertanejo',
  pagodao:'sertanejo, samba lento',
  pagode90:'sertanejo, eletrônico',
  sambaraiz:'sertanejo, eletrônico',
  sambaenredo:'sertanejo, eletrônico',
  choro:'eletrônico, sertanejo',
  frevo:'sertanejo, eletrônico',
  boibumba:'sertanejo, eletrônico',
  vanera:'samba, eletrônico',
  jovemguarda:'trap, eletrônico',
  rapnacional:'sertanejo, samba',
  anos90:'sertanejo, samba, trap',
  zoeira:'balada triste, música lenta e séria',
  natal:'funk, trap, rock pesado'
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
  sertanejo:  'sertanejo universitario, modern sertanejo, acoustic guitar, clean electric guitar, bass, drums, keyboard, polished contemporary production, romantic radio arena anthem',
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
  infantil:   "children's song, playful melody, xylophone, simple bright arrangement",
  anos80:     '80s synth pop, retro analog synths, gated reverb drums, new wave, 1980s',
  eletrofunk: 'eletrofunk, brazilian funk, electro synths, edm drops, fast baile beat',
  bregafunk:  'brega funk, recife brega funk beat, keyboard, heavy bass, danceable',
  funkcria:   'funk de favela, baile funk, heavy 808, tamborzão, spoken rap vocals, street',
  jingle:     'commercial jingle, catchy hook, upbeat pop, radio ad, short and memorable',
  sertanejoraiz: 'sertanejo raiz, moda de viola, viola caipira, accordion, rural brazilian country duo',
  funkantigo: 'old school baile funk, 2000s funk carioca, volt mix, tamborzao, funk melody',
  gospeltrad: 'traditional gospel hymn, church organ, piano, congregational choir, worship',
  catolica:   'catholic worship song, acoustic guitar, keyboard, choir, prayerful',
  arrocha:    'arrocha, romantic brazilian keyboard, melodic guitar, sofrencia',
  tecnobrega: 'tecnobrega, brazilian electro brega, fast electronic beat, synth keyboard, para',
  anos60:     '1960s rock and roll, twist, surf guitar, vintage organ, retro',
  anos70:     '1970s disco, funk soul, groovy bass, strings, horns, retro',
  melody:'tecnomelody, brazilian melody, para brega, electronic keyboard, romantic synth beat',
  bregamarcante:'brega marcante, brazilian brega, twangy lead guitar, keyboard, danceable',
  batidao:'batidao, paredao, heavy sub bass, brazilian electronic beat, keyboard, loud',
  seresta:'seresta, sofrencia, romantic brazilian keyboard ballad, acoustic guitar',
  bregaromantico:'romantic brega, 80s 90s brazilian, keyboard, electric guitar, horns',
  carimbo:'carimbo, amazonian folk, hand drums, maracas, banjo, brass',
  lambada:'lambada, brazilian dance, guitar, keyboard, fast percussion',
  forroeletronico:'forro eletronico, accordion, keyboard, electric guitar, drums, upbeat',
  xote:'xote, baiao, accordion, zabumba, triangle, traditional northeastern',
  pagodao:'pagodao baiano, swingueira, heavy percussion, bahia, fast groove',
  pagode90:'90s pagode romantico, cavaquinho, banjo, keyboard, backing choir',
  sambaraiz:'samba de raiz, roda de samba, 7-string guitar, cavaquinho, pandeiro',
  sambaenredo:'samba enredo, carnival drum section, bateria, cavaquinho, choir',
  choro:'choro, chorinho, flute, cavaquinho, 7-string guitar, pandeiro',
  frevo:'frevo, brass band, fast carnival, recife',
  boibumba:'boi bumba toada, amazonian drums, big choir, epic',
  vanera:'vanerao, gaucho, accordion, acoustic guitar, southern brazil',
  jovemguarda:'jovem guarda, 60s brazilian rock, ye-ye, organ, retro guitar',
  rapnacional:'brazilian rap, boom bap beat, sample, rap vocals',
  anos90:     '90s eurodance pop, retro synths, dance beat, catchy chorus, 1990s',
  zoeira:     'comedy song, funny parody, upbeat, playful, humorous brazilian',
  natal:      'christmas song, jingle bells, sleigh bells, piano, strings, choir, festive holiday'
};
const CLIMA_PT = {
  alegre:'alegre e contagiante', emocionante:'emocionante, de arrepiar',
  romantica:'romântico e apaixonado', calma:'calmo e suave',
  nostalgica:'nostálgico, de saudade', festiva:'festivo, de celebração',
  energetica:'energético e vibrante', divertida:'divertido e bem-humorado',
  inspiradora:'inspirador, de superação', melancolica:'melancólico',
  triste:'triste e emocionante', zoeira:'engraçado e debochado, de zoeira'
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
  melancolica:'andamento lento, arranjo contido e sentido',
  triste:'andamento lento, piano e cordas, arranjo triste e emocionado',
  zoeira:'andamento animado, arranjo cômico e exagerado, com efeitos engraçados'
};
const CLIMAS = {
  alegre:'joyful', emocionante:'emotional', romantica:'romantic', calma:'gentle',
  nostalgica:'nostalgic', festiva:'celebratory', energetica:'energetic',
  divertida:'playful', inspiradora:'uplifting', melancolica:'melancholic',
  triste:'sad, emotional', zoeira:'funny, comedic, humorous'
};
const VOZES = { masculina:'male vocals', feminina:'female vocals', dueto:'male and female duet vocals' };

// Relação e ocasião viram tag de estilo — orientam o clima da música
// sem virar texto cantado.
// Como tratar cada nicho dentro do briefing da letra
const NICHO_TEXTO = {
  namorada:'a namorada', namorado:'o namorado', esposa:'a esposa', marido:'o marido',
  mae:'a mãe', pai:'o pai', irma:'a irmã', irmao:'o irmão',
  amiga:'a melhor amiga', amigo:'o melhor amigo', filho:'o filho ou filha',
  avo:'a avó ou avô', tio:'a tia ou tio', sogro:'a sogra ou sogro', padrinho:'a madrinha ou padrinho',
  comercial:'uma empresa (propaganda)'
};
// O que a letra NUNCA pode fazer em cada nicho — evita constrangimento
const NICHO_EVITAR = {
  mae:'A letra é de filho para mãe: nunca use linguagem romântica ou de casal.',
  pai:'A letra é de filho para pai: nunca use linguagem romântica ou de casal.',
  irma:'A letra é entre irmãos: nunca use linguagem romântica.',
  irmao:'A letra é entre irmãos: nunca use linguagem romântica.',
  amiga:'A letra é sobre amizade: nunca use linguagem romântica ou de paixão.',
  amigo:'A letra é sobre amizade: nunca use linguagem romântica ou de paixão.',
  filho:'A letra é de pai/mãe para filho: nunca use linguagem romântica.',
  avo:'Para avó/avô: nunca use linguagem romântica.',
  tio:'Para tia/tio: nunca use linguagem romântica.',
  sogro:'Para sogra/sogro: nunca use linguagem romântica.',
  padrinho:'Para madrinha/padrinho: nunca use linguagem romântica.',
  comercial:'É um jingle de propaganda: cite a marca no refrão, nada romântico.'
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
    const estiloOutro = String((body && body.estiloOutro) || '').trim().slice(0, 100);
    const gen = (estilo === 'outro' && estiloOutro) ? estiloOutro : (GENEROS[estilo] || GENEROS.romantica);
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
    var genPT = (estilo === 'outro' && estiloOutro) ? estiloOutro : (GENERO_PT[estilo] || GENERO_PT.romantica);
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
        estiloOutro: estilo === 'outro' ? estiloOutro : null,
        clima: clima,
        relacao: relacao,
        ocasiao: ocasiao,
        nomes: nomesLetra,
        historia: texto.slice(0, 400),
        letraAprovada: usarLetraLiteral ? inputSuno.prompt : null,
        whatsapp: String((body && body.whatsapp) || '').trim(),
        // Gerada pelo painel (ajuste de letra) → fica ligada ao pedido original
        // e não aparece como "nova cliente" na lista.
        origem: (body && body.origem) === 'painel' ? 'painel' : 'site',
        pedidoId: String((body && body.pedidoId) || '').trim() || null,
        refTaskId: String((body && body.refTaskId) || '').trim() || null,
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
