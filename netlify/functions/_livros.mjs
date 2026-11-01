// LIVRO MÁGICO — núcleo compartilhado (histórias, IA de imagem/música, andamento do pedido)
//
// Como funciona:
//  • Prévia (antes de pagar): gera só a CAPA (com o rosto da criança) + a MÚSICA do tema.
//  • Depois do Pix: gera as 5 ilustrações. As páginas de texto são montadas pelo próprio site (custo zero).
//  • A foto da criança é apagada assim que o livro fica pronto (e as não pagas, em até 3 dias).
//
// Tudo fica no Netlify Blobs, loja "livros":
//   temas                 → lista de histórias (se não existir, usa TEMAS_PADRAO abaixo)
//   img/<pedido>/capa     → capa gerada        img/<pedido>/p1..p5 → ilustrações
//   img/tema/<id>         → capa de vitrine do tema (página inicial)
//   foto/<pedido>         → foto enviada (temporária)
//   mus/<tema>/<nome>     → música já gerada pra esse nome + tema (reaproveita, custo zero)
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { enviarTexto, enviarImagem, enviarDocumento, conversaAberta, registrar, SITE } from './_zap.mjs';
import { indexar } from './_indice.mjs';

export const PRECO_LIVRO = 37;
export const PRECO_LIVRO_PROPRIO = 67;
// pacotes na hora de desbloquear: 1 livro, 2 livros (a criança em mais uma aventura) ou a coleção completa
export const PACOTES_LIVRO = { um: { valor: 37, nome: '1 livro' }, dois: { valor: 49, nome: '2 livros' }, todos: { valor: 129, nome: 'coleção completa' } };
// modelos de imagem, em ordem. Dá pra trocar sem mexer no código: variável LIVRO_MODELOS_IMAGEM no Netlify
// (separados por vírgula, ex.: google/nano-banana-2.1,google/nano-banana-2)
// Só o Nano Banana 2.1 (Google): o mais barato (US$ 0,03 a imagem em 2K) e ótimo pra manter o rosto.
export const MODELO_IMAGEM = String(process.env.LIVRO_MODELOS_IMAGEM || 'google/nano-banana-2.1').split(',').map((x) => x.trim()).filter(Boolean);
const API = 'https://api.unifically.com/v1/tasks';

export function loja() { return getStore('livros'); }
export function chaveApi() { return (process.env.UNIFICALLY_API_KEY || '').trim(); }
export function baseSite(req) {
  const env = (process.env.URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try { return new URL(req.url).origin; } catch (e) { return ''; }
}
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function novoId() { return 'L' + crypto.randomBytes(7).toString('hex'); }
export function novoToken() { return crypto.randomBytes(12).toString('hex'); }
export function normNome(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// "[o|a]" → "o" pra menino, "a" pra menina.  {nome} → nome da criança.
export function flex(txt, nome, genero) {
  const menina = genero === 'menina';
  return String(txt || '')
    .replace(/\[([^\]|]*)\|([^\]]*)\]/g, (m, a, b) => (menina ? b : a))
    .replace(/\{nome\}/g, nome || '');
}

// ---------------------------------------------------------------------------
// HISTÓRIAS PRONTAS (o painel pode editar, criar novas e publicar)
// Cada tema: 5 cenas. Cada cena vira 2 páginas no livro (texto à esquerda + ilustração à direita).
// "cena" e "capa" são as instruções da ilustração (em inglês: a IA entende melhor).
// ---------------------------------------------------------------------------
export const TEMAS_PADRAO = [
  {
    id: 'fazenda', emoji: '🐄', status: 'publicado', ordem: 1,
    nome: 'A Fazenda dos Sonhos',
    titulo: '{nome} e a Fazenda dos Sonhos',
    descricao: 'Para quem ama bichinhos: vira fazendeir[o|a] por um dia, conhece a vaquinha, o cavalinho e descobre de onde vêm o leite, o ovo e o mel.',
    cores: ['#FFE8B8', '#F6B86B', '#7BAE5A'],
    roupa: 'denim overalls over a red-and-white gingham shirt, small yellow rain boots and a straw hat',
    capa: 'standing proudly on a dirt path in front of a big red barn with a white X door, a tall silver silo, a gentle brown-and-white cow, a fluffy white sheep and a little chestnut horse around, green rolling hills, sunflowers, a wooden fence, golden morning light, butterflies in the air',
    paginas: [
      { texto: 'Era uma vez {nome}, [um|uma] pequen[o|a] aventureir[o|a] que acordou com o canto do galo: cocoricóóó! Pela janela, o sol pintava de dourado a Fazenda dos Sonhos. Lá fora, o celeiro vermelho, o silo prateado e um monte de bichinhos esperavam por [ele|ela].',
        cena: 'waking up in a cozy farmhouse bedroom, stretching happily next to an open wooden window, outside a rooster on the fence sings at sunrise, a red barn and a silver silo glowing in the golden morning light' },
      { texto: 'A primeira amiga foi a Vaquinha Mimosa. "Muuu! Bom dia, {nome}!" Juntos, encheram um baldinho de leite quentinho, que vira queijo, iogurte e o leitinho do café da manhã. {nome} fez carinho na Mimosa, e ela abanou o rabo de felicidade.',
        cena: 'gently petting a friendly brown-and-white cow named Mimosa inside a warm wooden barn with hay bales, a small shiny milk bucket on the floor, a curious kitten watching, warm light through the barn door' },
      { texto: 'No galinheiro, a Dona Galinha Pintadinha mostrou um segredo: um ninho cheio de ovos! {nome} pegou um por um, com todo o cuidado do mundo. Os pintinhos amarelinhos piavam em volta: piu, piu, piu! Parecia até que estavam batendo palminhas.',
        cena: 'kneeling in a colorful chicken coop holding a little wicker basket full of eggs, a speckled hen and many fluffy yellow chicks around, a small red-roofed henhouse, flowers and a wooden ladder' },
      { texto: 'Depois veio o passeio mais esperado: montar no Trovão, o cavalinho mais manso da fazenda! Trotando pela trilha, {nome} viu a horta cheia de cenouras, as abelhinhas fazendo mel e um campo inteiro de girassóis sorrindo para [ele|ela].',
        cena: 'riding a gentle little chestnut pony on a sunny trail (safe and calm), passing a vegetable garden with carrots and pumpkins, beehives with tiny bees, a huge field of sunflowers, a silver silo in the distance' },
      { texto: 'Quando o céu ficou cor-de-rosa, todos os bichinhos se juntaram para dar boa-noite. "Obrigado por cuidar da gente, {nome}!" E [ele|ela] entendeu que o mais gostoso da fazenda é o amor que a gente dá e recebe. Fim… até a próxima aventura!',
        cena: 'sitting on a wooden fence at sunset hugging a fluffy sheep, the cow, the pony, the hen and chicks gathered happily around, pink and orange sky, fireflies starting to glow, the red barn behind' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} na fazenda!\n\n[Verse]\nO galo cantou, o sol apareceu\nA vaquinha Mimosa já disse: bom dia, muuu!\nO cavalinho Trovão quer passear\nE a galinha Pintadinha vem cantar\n\n[Chorus]\n{nome}, {nome}, na Fazenda dos Sonhos\nCom os bichinhos todos, que dia risonho!\nÉ muu, é piu, é cocoricó\n{nome} é a alegria da fazenda inteirinha!\n\n[Verse]\nTem ovo no ninho, tem mel na colmeia\nGirassol sorrindo, cenoura na horta\nO pôr do sol pinta o céu de cor\nE a fazenda inteira canta com amor\n\n[Chorus]\n{nome}, {nome}, na Fazenda dos Sonhos\nCom os bichinhos todos, que dia risonho!\n\n[Outro]\nBoa noite, fazenda… boa noite, {nome}!',
    estiloMusica: "children's song, cheerful farm sing-along, ukulele, xylophone, hand claps, animal sounds, warm female vocals, playful, catchy chorus, portuguese vocals"
  },
  {
    id: 'futebol', emoji: '⚽', status: 'publicado', ordem: 2,
    nome: 'O Craque do Coração',
    titulo: '{nome}, o Craque do Coração',
    descricao: 'Para quem ama futebol: uma história de garra, amizade e confiança, com [ele|ela] brilhando no gramado como [o|a] grande craque do time.',
    cores: ['#D9F2C8', '#3FA34D', '#FFD23F'],
    roupa: 'a bright yellow soccer jersey with green trim and the number 10, blue shorts, white socks and soccer cleats',
    capa: 'standing in the center of a huge stadium full of cheering fans, holding a soccer ball, green pitch with white lines, colorful confetti and stadium lights, flags waving, a golden trophy glowing nearby',
    paginas: [
      { texto: '{nome} tinha um sonho do tamanho de um estádio: jogar com a camisa 10! Todo dia, [ele|ela] treinava no quintal, chutando a bola contra o muro. Tum, tum, tum! E sempre dizia baixinho: "Um dia, eu vou fazer um golaço!"',
        cena: 'practicing soccer in a cozy backyard, kicking a ball toward a small goal made of a chalk drawing on a wall, a happy dog chasing the ball, laundry line and flowers, warm afternoon light' },
      { texto: 'Certo dia, chegou uma carta especial: "{nome}, você foi convidad[o|a] para o Time das Estrelas!" No vestiário, cada amigo tinha um talento. Um corria rápido, outro defendia tudo, e {nome} tinha o mais importante de todos: um coração que nunca desiste.',
        cena: 'in a bright colorful locker room with teammates of different kids smiling, holding up a yellow number 10 jersey proudly, cleats and balls around, a coach with a whistle giving a thumbs up' },
      { texto: 'O jogo começou! O outro time era forte, e o placar ficou 0 a 0. Mas {nome} lembrou do que aprendeu: jogar junto é melhor que jogar sozinho. [Ele|Ela] tocou a bola para o amigo, que devolveu de calcanhar. Que jogada linda!',
        cena: 'running on a green soccer field during a match, passing the ball to a teammate, crowd cheering in the stands, a big scoreboard showing 0 x 0, dynamic but friendly, sunny day' },
      { texto: 'Faltando um minuto, a bola veio no pé de {nome}. A torcida prendeu a respiração… {nome} respirou fundo, olhou para o gol e chutou com toda a força do coração. GOOOOOL! O estádio inteiro gritou o nome [dele|dela]!',
        cena: 'kicking the ball into the goal net with a joyful expression, the goalkeeper diving, confetti exploding, fans jumping with flags, stadium lights shining, magical golden sparkles around the ball' },
      { texto: 'Com a medalha no peito e a taça nas mãos, {nome} abraçou o time inteiro. Naquela noite, antes de dormir, [ele|ela] entendeu: [um|uma] verdadeir[o|a] craque é quem joga com alegria, respeita os amigos e acredita nos próprios sonhos. Fim!',
        cena: 'lifting a shiny golden trophy with teammates hugging around, wearing a medal, golden confetti falling, night stadium lights, everyone smiling, a big moon in the sky' }
    ],
    letra: '[Intro]\nEra uma vez… {nome}, o craque do coração!\n\n[Verse]\nBola no pé, chuteira no chão\nCamisa dez e muita emoção\nTreina no quintal, sonha alto demais\nNinguém segura {nome}, ninguém faz igual!\n\n[Chorus]\nÉ gol, é gol, é gol de {nome}!\nA torcida canta, o estádio inteiro chama!\nDribla, passa e chuta com o coração\n{nome} é campeão, campeão!\n\n[Verse]\nJogando junto o time é mais forte\nCom alegria a gente tem mais sorte\nO apito final, a taça na mão\nE um abraço gigante de campeão!\n\n[Chorus]\nÉ gol, é gol, é gol de {nome}!\n\n[Outro]\nOlê, olê, olê… {nome}!',
    estiloMusica: "children's song, upbeat stadium chant, energetic drums, claps, crowd cheers, brazilian kids anthem, joyful vocals, catchy chorus, portuguese vocals"
  },
  {
    id: 'mar', emoji: '🐬', status: 'publicado', ordem: 3,
    nome: 'O Reino do Fundo do Mar',
    titulo: '{nome} no Reino do Fundo do Mar',
    descricao: 'Para quem ama o mar: um mergulho mágico com golfinhos, tartarugas e um castelo de corais, numa aventura de amizade e coragem.',
    cores: ['#C8F1F5', '#3BB6C9', '#2A5BA8'],
    roupa: 'a turquoise wetsuit with little starfish patches and a clear magical bubble diving helmet that shows the whole face',
    capa: 'swimming happily underwater inside a magical shimmering bubble, a smiling dolphin and a big sea turtle beside, colorful coral castle behind, tropical fish, seahorses, rays of sunlight coming from the surface, glowing pearls',
    paginas: [
      { texto: 'Era uma vez {nome}, que adorava a praia. Um dia, encontrou na areia uma concha brilhante que sussurrou: "Venha conhecer o Reino do Fundo do Mar!" {nome} sorriu, segurou a concha e… plim! Uma bolha mágica envolveu [ele|ela] inteirinh[o|a].',
        cena: 'on a sunny beach at the water edge holding a glowing magical seashell, a shimmering bubble starting to surround the child, seagulls, palm trees, gentle turquoise waves, sparkles' },
      { texto: 'Lá embaixo, quem deu as boas-vindas foi Lila, a golfinha mais simpática do oceano. "Segure na minha nadadeira, {nome}!" E lá foram os dois, rodopiando entre peixinhos coloridos, que pareciam um arco-íris nadando.',
        cena: 'underwater holding the fin of a smiling dolphin, swimming through a school of rainbow-colored fish, sunbeams from the surface, bubbles, coral reef below, joyful and magical' },
      { texto: 'No caminho, {nome} conheceu o Vovô Tartaruga, que já tinha cem anos e muitas histórias. "O mar é a casa de todos nós", ele ensinou. "Por isso a gente cuida dele com carinho." {nome} prometeu nunca deixar lixo na praia.',
        cena: 'sitting on soft sand under the sea listening to a wise old sea turtle with glasses, seahorses and a little octopus listening too, glowing anemones, treasure chest half buried, peaceful blue light' },
      { texto: 'De repente, um polvinho chorava: tinha perdido o caminho de casa! {nome} não pensou duas vezes. Com coragem e a ajuda de Lila, seguiu as pérolas brilhantes até a toca do polvinho. A mamãe polvo deu oito abraços de agradecimento!',
        cena: 'helping a little orange octopus find its home, following a trail of glowing pearls through a coral cave, the dolphin beside, mother octopus waving happily from a cozy rock home' },
      { texto: 'Para comemorar, o Rei Netuno fez uma festa no Castelo de Corais, com música de cavalos-marinhos e dança de águas-vivas. Quando a bolha levou {nome} de volta à praia, [ele|ela] guardou a concha no coração: o mar seria para sempre seu amigo. Fim!',
        cena: 'celebrating at a magnificent coral castle under the sea, glowing jellyfish dancing, seahorses playing tiny instruments, the dolphin, turtle and octopus friends around, a kind sea king with a crown, sparkles everywhere' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no fundo do mar!\n\n[Verse]\nUma concha mágica brilhou na areia\nUma bolha azul, uma onda que passeia\nA golfinha Lila veio me buscar\nVamos mergulhar, vamos mergulhar!\n\n[Chorus]\n{nome}, {nome}, no fundo do mar\nPeixinho colorido vem brincar\nTartaruga, polvo, cavalo-marinho\nTodo mundo nada junto, bem juntinho!\n\n[Verse]\nNo castelo de corais tem festa e canção\nÁguas-vivas dançando com o coração\nCuidar do oceano é coisa de quem ama\nO mar é nossa casa, o mar é nossa cama\n\n[Chorus]\n{nome}, {nome}, no fundo do mar\n\n[Outro]\nTchau, oceano… {nome} vai voltar!',
    estiloMusica: "children's song, dreamy underwater pop, marimba, soft synth bubbles, gentle percussion, sweet female vocals, magical, catchy, portuguese vocals"
  },
  {
    id: 'espaco', emoji: '🚀', status: 'publicado', ordem: 4,
    nome: 'A Viagem às Estrelas',
    titulo: '{nome} e a Viagem às Estrelas',
    descricao: 'Para [o|a] pequen[o|a] astronauta: um foguete, planetas coloridos e um amigo de outro mundo, numa aventura que desperta a curiosidade.',
    cores: ['#D9D2FF', '#5B4BC4', '#1B1A4A'],
    roupa: 'a white astronaut suit with orange details and a little star patch, holding a round helmet under the arm (face always visible)',
    capa: 'standing on the surface of a colorful little planet next to a cute red-and-white rocket, Saturn-like rings and colorful planets in a purple starry sky, a shooting star, a friendly little green alien waving',
    paginas: [
      { texto: 'Toda noite, {nome} olhava as estrelas pela janela e perguntava: "O que será que tem lá em cima?" Até que, numa noite bem especial, uma estrela cadente desceu no quintal e virou um foguete vermelho e branco, só esperando por [ele|ela]!',
        cena: 'in pajamas at a bedroom window at night pointing at the sky, a shooting star landing in the backyard turning into a cute red-and-white rocket, glowing stars, a teddy bear on the windowsill' },
      { texto: '"Contagem regressiva! Cinco, quatro, três, dois, um… decolar!" O foguete subiu, subiu, subiu, deixando um rastro de purpurina no céu. Lá de cima, {nome} viu a Terra azulzinha, redonda e linda, como uma bolinha de gude.',
        cena: 'inside a cozy rocket cockpit wearing the astronaut suit, looking through a round window at planet Earth, colorful buttons and lights, sparkly trail outside, stars all around' },
      { texto: 'A primeira parada foi a Lua! Lá, tudo era leve: {nome} pulava tão alto que parecia voar. Deixou pegadas na poeira prateada e fincou uma bandeirinha com o próprio nome. A Lua sorriu: era a primeira vez que recebia uma visita tão especial.',
        cena: 'jumping high on the moon surface in low gravity, footprints in silver dust, a small flag planted, Earth glowing in the black starry sky, joyful expression' },
      { texto: 'No planeta dos anéis coloridos, {nome} conheceu Zuzu, um alienzinho verde de três olhos que estava sozinho. "Quer ser meu amigo?", perguntou {nome}. Zuzu ficou tão feliz que começou a brilhar! Juntos, escorregaram pelos anéis do planeta.',
        cena: 'sliding happily down the colorful rings of a giant planet together with a cute little green three-eyed alien, candy-colored planets and stars around, magical glow' },
      { texto: 'Era hora de voltar. Zuzu deu de presente uma estrelinha que brilha no escuro. Em casa, quentinh[o|a] na cama, {nome} olhou para o céu e a estrela piscou de volta. Porque quem tem curiosidade e coração aberto faz amigos até nas estrelas. Fim!',
        cena: 'tucked in bed at night holding a small glowing star, the rocket parked outside the window, the little alien waving from a distant planet in the starry sky, cozy bedroom with soft night light' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no espaço!\n\n[Verse]\nCinco, quatro, três, dois, um\nO foguete vai subir, não tem medo nenhum\nPassa pela Lua, dá um pulo e voa\nO universo inteiro é uma coisa boa!\n\n[Chorus]\n{nome}, {nome}, viajando nas estrelas\nPlanetas coloridos, cada um mais belo\nTem um amiguinho verde lá no céu\n{nome} é astronauta, chapéu de papel!\n\n[Verse]\nUma estrela cadente veio pra brincar\nOs anéis do planeta pra escorregar\nE quando a noite chega, volta pro colchão\nCom uma estrela acesa dentro do coração\n\n[Outro]\nBoa noite, universo… boa noite, {nome}!',
    estiloMusica: "children's song, dreamy space pop, twinkling synths, music box, soft beat, warm vocals, wonder, catchy chorus, portuguese vocals"
  },
  {
    id: 'reino', emoji: '🦄', status: 'publicado', ordem: 5,
    nome: 'O Castelo das Nuvens',
    titulo: '{nome} no Castelo das Nuvens',
    descricao: 'Para quem ama magia: um unicórnio, um dragãozinho amigo e um castelo nas nuvens, numa aventura que desenvolve a imaginação e a bondade.',
    cores: ['#FFE0F0', '#E77BB5', '#8C6BD8'],
    roupa: 'a soft lilac royal outfit with a short golden cape and a small sparkly golden crown',
    capa: 'standing on a cloud bridge in front of a pastel fairytale castle floating on clouds, a white unicorn with a rainbow mane and a cute small purple baby dragon beside, rainbow in the sky, sparkles and tiny fairies with glowing wings',
    paginas: [
      { texto: 'Era uma vez {nome}, que tinha um livro de contos de fada preferido. Numa tarde de chuva, uma luz saiu das páginas e um arco-íris apareceu no quarto. Na ponta dele, um convite dourado: "Sua Majestade {nome} é esperad[o|a] no Castelo das Nuvens!"',
        cena: 'sitting on a bedroom floor with an open glowing storybook, a rainbow coming out of the pages, a golden invitation floating in the air, rain on the window, sparkles' },
      { texto: 'Quem veio buscar foi Estrela, um unicórnio de crina colorida. "Suba, {nome}! Segure firme!" E os dois galoparam pelo arco-íris, passando por nuvens fofinhas que tinham gosto de algodão-doce. {nome} ria de felicidade.',
        cena: 'riding a gentle white unicorn with a rainbow mane galloping along a rainbow bridge in the sky, fluffy pink and white clouds, sparkles, joyful expression, sunset colors' },
      { texto: 'No castelo, as fadinhas fizeram uma festa de boas-vindas. Mas havia alguém triste no cantinho: Fagulha, um dragãozinho que soltava faíscas sem querer e achava que ninguém gostava dele. {nome} se aproximou e disse: "Quer brincar comigo?"',
        cena: 'inside a pastel fairytale castle hall with tiny glowing fairies, kneeling and offering a hand to a shy little purple baby dragon sitting in a corner, warm candlelight, balloons and flowers' },
      { texto: 'Fagulha ficou tão feliz que suas faíscas viraram fogos de artifício coloridos! O castelo inteiro aplaudiu. {nome} tinha descoberto o feitiço mais poderoso de todos: a gentileza. Uma palavra carinhosa pode iluminar o coração de alguém.',
        cena: 'laughing together with the baby dragon whose sparks turn into colorful fireworks over the cloud castle, fairies and the unicorn cheering, magical night sky, glowing lights' },
      { texto: 'Antes de voltar, a Rainha das Nuvens colocou uma coroa brilhante na cabeça de {nome}. "Você será sempre [o|a] guardi[ão|ã] da bondade deste reino." E, toda vez que um arco-íris aparece no céu, {nome} sabe que seus amigos estão dando oi. Fim!',
        cena: 'being crowned with a sparkly golden crown by a kind cloud queen, the unicorn, the baby dragon and fairies celebrating, pastel castle balcony, rainbow and golden sparkles' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no Castelo das Nuvens!\n\n[Verse]\nUm arco-íris brilhou no meu quarto\nUm unicórnio veio, pulou de um salto\nNas nuvens fofinhas de algodão-doce\nUm castelo encantado, que lindo que fosse!\n\n[Chorus]\n{nome}, {nome}, no reino encantado\nCom fadas, dragão e unicórnio do lado\nA magia mais forte é ser gentil\n{nome} brilha como estrela no céu anil!\n\n[Verse]\nO dragãozinho soltou faísca de cor\nVirou fogos de artifício, virou flor\nUma coroa dourada pra quem tem bondade\nNo Castelo das Nuvens tem felicidade\n\n[Outro]\nBoa noite, castelo… boa noite, {nome}!',
    estiloMusica: "children's song, magical fairytale pop, harp, glockenspiel, soft strings, sweet vocals, enchanting, catchy chorus, portuguese vocals"
  }
];

export async function lerTemas() {
  try {
    const t = await loja().get('temas', { type: 'json' });
    if (Array.isArray(t) && t.length) return t;
  } catch (e) {}
  return TEMAS_PADRAO;
}
export async function acharTema(id) {
  const ts = await lerTemas();
  return ts.find((t) => t.id === id) || null;
}

// Descrição da idade pra ilustração
export function idadeIA(livro) {
  const m = Number(livro.idadeMeses);
  const a = Number(livro.idade);
  const menina = livro.genero === 'menina';
  if (a === 0 || (!a && m >= 0)) {
    const meses = Math.max(0, m || 0);
    return (meses <= 1 ? 'a newborn baby' : 'a ' + meses + '-month-old baby') + (menina ? ' girl' : ' boy') +
      ' (show the baby sitting, lying on a soft blanket or held safely in a loving way; adapt every action to a baby)';
  }
  if (a <= 2) return 'a ' + a + '-year-old toddler ' + (menina ? 'girl' : 'boy') + ' (adapt actions to a toddler: sitting, crawling, small steps)';
  return 'a ' + (a >= 10 ? '10-year-old' : a + '-year-old') + ' ' + (menina ? 'girl' : 'boy');
}

const ESTILO_BASE =
  "Premium children's picture book illustration, soft 3D animated feature film style, warm cinematic lighting, " +
  'rich and detailed magical background, vibrant yet soft colors, cozy, joyful, high detail, professional quality. ';

export function promptImagem(tema, livro, cena, ehCapa, semFoto) {
  return ESTILO_BASE +
    (semFoto ? 'The main character is an adorable, expressive Brazilian child with a big smile. '
      : 'The main character is the child from the FIRST reference photo: keep the exact same face, facial features, skin tone, eye color, hair color and hairstyle, so the parents instantly recognize their child. ') +
    'The child is ' + idadeIA(livro) + ', wearing ' + (tema.roupa || 'colorful comfortable clothes') + '. ' +
    (ehCapa ? '' : 'If a SECOND reference image is given, keep the same character design and outfit as in it. ') +
    'The child is the clear hero of the scene, happy and expressive. ' +
    'Scene: the child ' + cena + '. ' +
    (ehCapa ? 'Book cover composition: keep the top quarter of the image calm and uncluttered (sky or soft background) because the title will be placed there. ' : '') +
    'Absolutely no text, letters, words, numbers on clothing except as described, logos or watermarks. Safe, wholesome, age-appropriate.';
}

// ---------------------------------------------------------------------------
// Unifically (mesma conta das músicas)
// ---------------------------------------------------------------------------
export async function criarTarefa(model, input) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + chaveApi(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input })
  });
  const d = await r.json().catch(() => null);
  const c = (d && d.data) || d || {};
  const id = c.task_id || c.id;
  if (!r.ok || !id) throw new Error('tarefa ' + model + ': ' + r.status + ' ' + JSON.stringify(d).slice(0, 300));
  return id;
}
export async function criarImagem(prompt, refs, proporcao, resolucao, inicio) {
  let ultimoErro = null;
  const n = MODELO_IMAGEM.length, ini = ((inicio || 0) % n + n) % n;
  const ordem = MODELO_IMAGEM.slice(ini).concat(MODELO_IMAGEM.slice(0, ini));
  for (const model of ordem) {
    try {
      const input = { prompt, aspect_ratio: proporcao || '3:4' };
      if (!/seedream/i.test(model)) input.resolution = resolucao || '2K'; // Seedream já sai em 2K por padrão
      if (refs && refs.length) input.image_urls = refs;
      return await criarTarefa(model, input);
    } catch (e) { ultimoErro = e; console.error('livro imagem:', e.message); }
  }
  throw ultimoErro || new Error('sem modelo de imagem');
}
export async function criarMusica(letra, estilo, titulo) {
  return criarTarefa('suno-ai/music', { mv: 'chirp-bluejay', custom: true, prompt: String(letra).slice(0, 5000), tags: estilo, title: String(titulo || 'Livro Mágico').slice(0, 80) });
}

function coletar(obj, urls, prof) {
  if (!obj || prof > 7) return;
  if (typeof obj === 'string') { if (/^https?:\/\//.test(obj)) urls.push(obj); return; }
  if (Array.isArray(obj)) { obj.forEach((x) => coletar(x, urls, prof + 1)); return; }
  if (typeof obj === 'object') Object.keys(obj).forEach((k) => coletar(obj[k], urls, prof + 1));
}
// { estado: 'pronto'|'rodando'|'falhou', urls:[...] }
export async function verTarefa(taskId, tipo) {
  try {
    const r = await fetch(API + '/' + encodeURIComponent(taskId), { headers: { Authorization: 'Bearer ' + chaveApi() } });
    const d = await r.json().catch(() => null);
    const c = (d && d.data) || d || {};
    const st = String(c.status || '').toLowerCase();
    if (/fail|error|cancel/.test(st)) return { estado: 'falhou', urls: [], msg: String(c.message || c.error || '') };
    const urls = [];
    coletar(c.output || c.result || c.outputs || c, urls, 0);
    const filtro = tipo === 'audio'
      ? (u) => /\.(mp3|m4a|wav)(\?|$)|audiopipe|cdn\d*\.suno/i.test(u)
      : (u) => /\.(png|jpe?g|webp)(\?|$)|image|img|cdn|storage|output/i.test(u) && !/\.(mp3|m4a|wav|mp4)(\?|$)/i.test(u);
    const boas = [...new Set(urls.filter(filtro))];
    if (tipo === 'audio') {
      const a1 = c.audio_url1 || c.audio_url, a2 = c.audio_url2;
      if (a1 && boas.indexOf(a1) < 0) boas.unshift(a1);
      if (a2 && boas.indexOf(a2) < 0) boas.push(a2);
    }
    const pronto = /complete|succe|done|finish/.test(st) || (tipo !== 'audio' && boas.length > 0 && !/pend|queue|process|run|start/.test(st));
    if (pronto && boas.length) return { estado: 'pronto', urls: boas };
    if (tipo === 'audio' && boas.length >= 1 && /stream|first/.test(st)) return { estado: 'rodando', urls: boas };
    return { estado: 'rodando', urls: [] };
  } catch (e) { return { estado: 'rodando', urls: [] }; }
}

// descobre o tipo real pelos primeiros bytes (o servidor de origem às vezes manda "octet-stream",
// e aí o Google não consegue ler a imagem quando ela volta como referência)
export function tipoImagem(buf, padrao) {
  if (buf && buf.length > 12) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
    if (buf.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  }
  return padrao || 'image/png';
}
export async function guardarImagem(url, chave) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('baixar imagem ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const tipo = tipoImagem(buf, (r.headers.get('content-type') || '').startsWith('image/') ? r.headers.get('content-type') : 'image/png');
  if (buf.length < 2000) throw new Error('imagem vazia');
  await loja().set(chave, buf, { metadata: { tipo } });
  return true;
}

// ---------------------------------------------------------------------------
// Andamento de um pedido de livro (chamado pela tela do cliente e pelo agendador)
// ---------------------------------------------------------------------------
const MAX_TENTATIVAS = 3;      // música
const MAX_IMG = 8;             // imagem: 3 tentativas seguidas, depois 1 a cada 10 min, até 8
const ESPERA_IMG = 10 * 60 * 1000;

function linkFoto(base, g, alt) {
  // alterna entre o link "de arquivo" (.jpg) e o link antigo, caso um deles não seja lido
  return alt ? base + '/.netlify/functions/livro-img?k=' + encodeURIComponent('foto/' + g.id) + '&t=' + g.livro.token
    : base + '/lv-foto/' + g.id + '/foto-' + g.livro.token + '.jpg';
}
// referências pra ilustração: foto + capa (pra manter o mesmo personagem). Se o Google recusar
// uma referência, a próxima tentativa vai só com a foto (que é o que importa pro rosto).
function refsPagina(base, g, p) {
  const L = g.livro, foto = linkFoto(base, g, Math.floor(((p && p.recusas) || 0) / 3) % 2 === 1);
  const recusou = /refused|cannot read|upload/i.test((p && p.msg) || '');
  if (!L.capa.ok || recusou || ((p && p.tent) || 0) >= 2) return [foto];
  return [foto, L.capa.url || linkImg(base, g, 'capa')];
}
function linkImg(base, g, nome) { return base + '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + g.id + '/' + nome) + '&t=' + g.livro.token; }

async function andarImagem(item, chave, criar, limite) {
  // item: { task, ok, tent }
  if (item.ok) return false;
  if (!item.task) {
    const tent = item.tent || 0;
    const recusada = /refused|cannot read|upload/i.test(item.msg || '');
    // foto recusada: tenta logo de novo (outro modelo / outro link); outros erros: dá um tempo
    // erro passageiro (Google sobrecarregado, sistema de cobrança da Unifically fora do ar…):
    // tenta de novo a cada 1 minuto e não desiste rápido (até ~30 tentativas, uns 30 min)
    const passageiro = /unavailable|overload|try again|timeout|demorou|503|502|500|429|rate|pricing|internal/i.test(item.msg || '');
    if (tent >= (passageiro ? 30 : MAX_IMG)) { if (!item.erro) { item.erro = true; return true; } return false; }
    if (tent >= 3 && Date.now() - (item.em || 0) < (recusada || passageiro ? 60 * 1000 : ESPERA_IMG)) return false;
    item.erro = false;
    try { item.task = await criar(item); }
    catch (e) { item.msg = String(e && e.message || e).slice(0, 300); item.tent = tent + 1; item.em = Date.now(); console.error('livro imagem (criar):', chave, item.msg); return true; }
    item.tent = tent + 1; item.em = Date.now();
    return true;
  }
  if (limite.downloads <= 0) return false;
  const st = await verTarefa(item.task, 'imagem');
  if (st.estado === 'falhou' || (st.estado === 'rodando' && Date.now() - (item.em || 0) > 6 * 60 * 1000)) {
    item.msg = st.estado === 'falhou' ? (st.msg || 'a IA recusou ou falhou ao gerar') : 'demorou demais (mais de 6 min)';
    if (/refused|cannot read|upload/i.test(item.msg)) { item.recusas = (item.recusas || 0) + 1; }
    console.error('livro imagem falhou:', chave, item.msg);
    item.task = null; return true; // tenta de novo na próxima volta
  }
  if (st.estado === 'pronto') {
    limite.downloads--;
    try { await guardarImagem(st.urls[0], chave); item.ok = true; item.url = st.urls[0]; item.task = null; return true; }
    catch (e) { console.error('guardar imagem', chave, e.message); item.msg = 'não consegui baixar a imagem: ' + e.message; item.task = null; return true; }
  }
  return false;
}

export async function avancarLivro(id, base) {
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || g.produto !== 'livro' || !g.livro) return null;
  const L = g.livro;
  if (L.status === 'pronto' && g.pago) return g;
  const tema = await acharTema(L.tema);
  if (!tema) return g;
  const nome = L.nome;
  let mudou = false;
  const limite = { downloads: 5 };
  L.capa = L.capa || {};
  L.musica = L.musica || {};

  // 1) capa (prévia)
  try {
    mudou = (await andarImagem(L.capa, 'img/' + g.id + '/capa',
      (it) => criarImagem(promptImagem(tema, L, tema.capa, true), [linkFoto(base, g, Math.floor((it.recusas || 0) / 3) % 2 === 1)], '3:4', '2K', it.recusas || 0), limite)) || mudou;
  } catch (e) { console.error('livro capa', id, e.message); }

  // 2) música (prévia) — reaproveita se já existir pra esse nome + tema
  try {
    if (!g.musicaPreviewUrl) {
      const chaveMus = 'mus/' + tema.id + '/' + normNome(nome);
      if (!L.musica.task) {
        const pronta = await loja().get(chaveMus, { type: 'json' }).catch(() => null);
        if (pronta && pronta.url) {
          g.musicaPreviewUrl = pronta.url; g.musicaPreviewUrl2 = pronta.url2 || null; g.musicaPreviewId = pronta.taskId || null;
          L.musica.reaproveitada = true; mudou = true;
        } else if ((L.musica.tent || 0) < MAX_TENTATIVAS) {
          L.musica.task = await criarMusica(flex(tema.letra, nome, L.genero), tema.estiloMusica, flex(tema.titulo, nome, L.genero));
          L.musica.tent = (L.musica.tent || 0) + 1; L.musica.em = Date.now(); mudou = true;
        }
      } else {
        const st = await verTarefa(L.musica.task, 'audio');
        if (st.estado === 'pronto' || (st.urls.length >= 2)) {
          g.musicaPreviewUrl = st.urls[0]; g.musicaPreviewUrl2 = st.urls[1] || null; g.musicaPreviewId = L.musica.task;
          await loja().setJSON(chaveMus, { url: g.musicaPreviewUrl, url2: g.musicaPreviewUrl2, taskId: L.musica.task, em: Date.now() }).catch(() => {});
          try { await getStore('musicas').setJSON(L.musica.task, { taskId: L.musica.task, criadoEm: Date.now(), estilo: 'infantil', nomes: nome, historia: 'Livro Mágico: ' + tema.nome, origem: 'livro', pedidoId: g.id, url: g.musicaPreviewUrl, url2: g.musicaPreviewUrl2, pago: !!g.pago }); } catch (e) {}
          mudou = true;
        } else if (st.estado === 'falhou' || Date.now() - (L.musica.em || 0) > 8 * 60 * 1000) {
          L.musica.task = null; mudou = true;
        }
      }
    }
  } catch (e) { console.error('livro música', id, e.message); }

  // 2b) pacote (2 livros ou coleção): cria os outros livros da mesma criança, já pagos, com a mesma foto
  if (g.pago && g.pacote && g.pacote.tipo !== 'um' && !g.pacote.criados) {
    try { await criarLivrosDoPacote(g); mudou = true; } catch (e) { console.error('pacote livro', id, e && e.message); }
  }

  // 3) depois do Pix: as 5 ilustrações
  if (g.pago && (L.capa.ok || L.capa.erro || (L.capa.tent || 0) >= 3)) {
    // página com "usa": repete a ilustração de outra cena (não gera imagem nova)
    // "so": página só de texto (sem ilustração, custo zero)
    L.paginas = L.paginas && L.paginas.length ? L.paginas : (tema.paginas || []).map((tp) => (tp && tp.so ? { so: true } : usaDe(tp) != null ? { usa: usaDe(tp) } : {}));
    if (L.status !== 'gerando' && L.status !== 'pronto') { L.status = 'gerando'; L.gerandoEm = Date.now(); mudou = true; }
    // as ilustrações andam todas ao mesmo tempo (antes era uma de cada vez e a tela pulava de 2 pra 4)
    const res = await Promise.all(L.paginas.map(async (p, i) => {
      if (p.usa != null || p.so) return false;
      try {
        return await andarImagem(p, 'img/' + g.id + '/p' + (i + 1), (it) =>
          criarImagem(promptImagem(tema, L, tema.paginas[i].cena, false), refsPagina(base, g, it), '3:4', '2K', it.recusas || 0), limite);
      } catch (e) { console.error('livro página', id, i + 1, e.message); return false; }
    }));
    if (res.some(Boolean)) mudou = true;
    const okTodas = L.capa.ok && L.paginas.every((p) => p.usa != null || p.so || p.ok);
    const acabou = L.paginas.every((p) => p.usa != null || p.so || p.ok || p.erro) && (L.capa.ok || L.capa.erro);
    if (okTodas && g.musicaPreviewUrl) {
      L.status = 'pronto'; L.prontoEm = Date.now(); mudou = true;
      // conta a venda dessa história (livros liberados por você no painel não contam)
      if (!L.contado && !(g.pagamento && g.pagamento.provedor === 'admin')) { L.contado = true; await somarVenda(L.tema); }
      try { await loja().delete('foto/' + g.id); L.fotoApagada = true; } catch (e) {}
      if (L.autoExemplo) { L.autoExemplo = false; await presentes.setJSON(g.id, g); try { await adicionarExemplo(g.id); L.virouExemplo = true; } catch (e) { console.error('exemplo automático', e && e.message); } }
    } else if (acabou && L.status !== 'problema') {
      // alguma imagem não saiu depois de todas as tentativas: guarda a foto e avisa no painel (botão "Refazer imagens")
      L.status = 'problema'; mudou = true;
    }
  } else if (!g.pago && L.capa.ok && g.musicaPreviewUrl && L.status !== 'previa') {
    L.status = 'previa'; mudou = true;
  }

  if (mudou) await presentes.setJSON(g.id, g);
  return g;
}

// índice da cena cuja ilustração esta página repete (ou null = ilustração nova)
export function usaDe(tp) { const n = tp && tp.usa; return (n === 0 || (n && Number.isInteger(+n))) && +n >= 0 ? +n : null; }
// diagnóstico (só o administrador vê)
export function diagLivro(g) {
  const L = g.livro || {}, it = (x) => ({ ok: !!(x && x.ok), tent: (x && x.tent) || 0, erro: !!(x && x.erro), msg: (x && x.msg) || '', rodando: !!(x && x.task) });
  return { capa: it(L.capa), musica: { ok: !!g.musicaPreviewUrl, tent: (L.musica && L.musica.tent) || 0, rodando: !!(L.musica && L.musica.task) }, paginas: (L.paginas || []).filter((p) => !p.so && p.usa == null).map(it), fotoApagada: !!L.fotoApagada, status: L.status };
}

// O que o site pode ver (sem dados internos)
export function resumoPublico(g, base) {
  const L = g.livro || {};
  const img = (n) => '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + g.id + '/' + n) + '&t=' + (L.token || '');
  return {
    id: g.id, pago: !!g.pago, tema: L.tema, nome: L.nome, genero: L.genero, idade: L.idade, idadeMeses: L.idadeMeses,
    status: L.status || 'criando',
    capa: L.capa && L.capa.ok ? img('capa') : null,
    capaErro: !!(L.capa && L.capa.erro),
    fotoRecusada: !!(L.capa && !L.capa.ok && (L.capa.recusas || 0) >= 4),
    musica: !!g.musicaPreviewUrl, musica2: !!g.musicaPreviewUrl2,
    nIlus: (L.paginas || []).filter((p) => !p.so && p.usa == null).length || null,
    paginas: g.pago ? (L.paginas || []).map((p, i) => {
      if (p.so) return 'so';
      if (p.usa != null) { const o = (L.paginas || [])[p.usa]; return o && o.ok ? img('p' + (p.usa + 1)) : null; }
      return p.ok ? img('p' + (i + 1)) : null;
    }) : [],
    valor: (g.pagamento && g.pagamento.valor) || PRECO_LIVRO,
    pacote: g.pacote ? { tipo: g.pacote.tipo, livros: g.pacote.criados || [] } : null,
    pacoteDe: g.pacoteDe || null
  };
}

// WHATSAPP: cliente tocou em "Receber minha prévia no WhatsApp" (mensagem com "L.<pedido>.<token>").
// Manda a capa + o link da prévia (onde ele ouve a música e desbloqueia a história).
// Volta: 'enviado' | 'esperando' | 'pago' | 'naoachei' | 'semjanela' | 'erro'
export function linkPreviaLivro(g) { return SITE + '/#/livro/' + g.id + '.' + g.livro.token; }
export async function entregarPreviaLivro(id, token, numero, base) {
  const presentes = getStore('presentes');
  let g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || g.produto !== 'livro' || !g.livro || (token && token !== g.livro.token)) return 'naoachei';
  const num = String(numero || '').replace(/\D/g, '');
  // guarda o WhatsApp no pedido (assim o aviso de "livro pronto" depois do Pix também chega)
  if (num && !String(g.whatsapp || '').replace(/\D/g, '')) {
    g.whatsapp = num; g.musicaWhatsapp = g.musicaWhatsapp || num;
    await presentes.setJSON(id, g).catch(() => {});
    try { await indexar(num, 'p', id); } catch (e) {}
  }
  if (g.pago) {
    const para = await conversaAberta(num);
    if (!para) return 'semjanela';
    // guarda este número pra entrega (vale também pros outros livros do pacote)
    const atual = await presentes.get(id, { type: 'json' }).catch(() => null) || g;
    atual.livro.zapEntrega = num; await presentes.setJSON(id, atual).catch(() => {});
    for (const x of ((atual.pacote && atual.pacote.criados) || [])) {
      const gx = await presentes.get(x.id, { type: 'json' }).catch(() => null);
      if (gx && gx.livro) { gx.livro.zapEntrega = num; await presentes.setJSON(x.id, gx).catch(() => {}); }
    }
    const extra = ((atual.pacote && atual.pacote.criados) || []).length;
    if (atual.livro.status === 'pronto') {
      await entregarLivroZap(para, atual, base);
      await getStore('whatsapp').setJSON('pago_' + id, { em: Date.now(), livro: true, via: 'botao' }).catch(() => {}); // o agendador não manda de novo
    }
    else await enviarTexto(para, '✅ Recebi! O Livro Mágico de *' + atual.livro.nome + '* está sendo ilustrado agora 🎨\n\nAssim que ficar pronto eu te mando aqui o link e os PDFs pra imprimir. Pode fechar o site tranquilo(a). 💛');
    if (extra) await enviarTexto(para, '📚 Os outros ' + extra + ' livro' + (extra > 1 ? 's' : '') + ' do seu pacote também chegam aqui, um por um, conforme ficarem prontos.');
    return 'pago';
  }
  const pronto = (x) => !!(x && x.livro && x.livro.capa && x.livro.capa.ok && x.musicaPreviewUrl);
  if (!pronto(g)) {
    try { g = (await avancarLivro(id, base || SITE)) || g; } catch (e) { console.error('previa livro zap', id, e && e.message); }
    if (!pronto(g)) return 'esperando';
  }
  const para = await conversaAberta(num);
  if (!para) return 'semjanela';
  const nome = g.livro.nome;
  const texto = '📖✨ *A prévia do Livro Mágico de ' + nome + ' ficou pronta!*\n\n' +
    'Toque no link pra abrir o livro, ver a capa e ouvir a música com o nome ' + nome + ' 🎵\n\n' +
    linkPreviaLivro(g) + '\n\n🔓 Lá mesmo você desbloqueia a história completa.';
  const capa = SITE + '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + id + '/capa') + '&t=' + g.livro.token;
  let ok = await enviarImagem(para, capa, texto);
  if (!ok) ok = await enviarTexto(para, texto);
  if (!ok) return 'erro';
  await registrar('enviou', { para, pedido: id, nome, via: 'livro' }).catch(() => {});
  // junto com a prévia: 2 exemplos de livros prontos (um de menino e um de menina), só na primeira vez
  try {
    const atual = await presentes.get(id, { type: 'json' }).catch(() => null) || g;
    if (!atual.livro.exemplosZap) { await enviarExemplosZap(para, g.livro.tema); atual.livro.exemplosZap = Date.now(); await presentes.setJSON(id, atual); }
  } catch (e) { console.error('exemplos zap', e && e.message); }
  return 'enviado';
}
export async function enviarExemplosZap(para, temaPreferido) {
  let lista = []; try { lista = (await loja().get('exemplos', { type: 'json' })) || []; } catch (e) {}
  lista = lista.filter((x) => x && x.tipo === 'livro' && x.mostrar !== false);
  if (!lista.length) return 0;
  const ordem = lista.filter((x) => x.tema === temaPreferido).concat(lista.filter((x) => x.tema !== temaPreferido));
  const esc = [];
  const menino = ordem.find((x) => x.genero === 'menino'), menina = ordem.find((x) => x.genero === 'menina');
  if (menino) esc.push(menino); if (menina) esc.push(menina);
  if (!esc.length) esc.push(ordem[0]);
  for (const x of esc.slice(0, 2)) {
    const capa = SITE + '/.netlify/functions/livro-img?k=' + encodeURIComponent('ex/' + x.id + '/capa') + '&v=' + (x.em || 1);
    await enviarImagem(para, capa, '✨ Exemplo de livro pronto: *' + (x.titulo || 'Livro Mágico') + '*');
  }
  await enviarTexto(para, '👆 Assim fica o livro completo, com o rostinho da criança em cada aventura.\n\nQuer ver por dentro? Abra ' + SITE + '/#/livro e toque em *"Folhear um livro de exemplo"*. 📖');
  return esc.length;
}

// PAINEL: refaz as imagens que falharam (zera as tentativas). A foto precisa ainda existir.
export async function refazerImagens(id) {
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || !g.livro) return { erro: 'Livro não encontrado.' };
  const foto = loja().getMetadata ? await loja().getMetadata('foto/' + id).catch(() => null) : await loja().get('foto/' + id, { type: 'arrayBuffer' }).catch(() => null);
  if (!foto) return { erro: 'A foto da criança já foi apagada. Peça uma foto nova pro cliente e crie o livro de novo.' };
  const L = g.livro, zera = (it) => { if (it && !it.ok) { it.tent = 0; it.erro = false; it.task = null; it.msg = ''; it.em = 0; it.recusas = 0; } };
  zera(L.capa); (L.paginas || []).forEach(zera);
  if (L.musica && !g.musicaPreviewUrl) { L.musica.tent = 0; L.musica.task = null; }
  if (L.status === 'problema') L.status = g.pago ? 'gerando' : 'criando';
  await presentes.setJSON(id, g);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// EXEMPLOS da vitrine (página do livro): copia capa + ilustrações pra uma pasta pública
// ---------------------------------------------------------------------------
async function copiarBlobLv(de, para) {
  const r = await loja().getWithMetadata(de, { type: 'arrayBuffer' }).catch(() => null);
  if (!r || !r.data) return false;
  await loja().set(para, r.data, { metadata: r.metadata || {} });
  return true;
}
export async function adicionarExemplo(id) {
  if (!/^L[0-9a-f]{14}$/.test(id)) return { erro: 'Código do livro inválido (começa com L).' };
  const g = await getStore('presentes').get(id, { type: 'json' }).catch(() => null);
  if (!g || !g.livro) return { erro: 'Livro não encontrado.' };
  if (!g.pago) return { erro: 'Só dá pra usar como exemplo um livro liberado (pago ou liberado por você).' };
  const L = g.livro, pags = L.paginas || [];
  if (!(L.capa && L.capa.ok) || !pags.length || pags.some((p) => !p || (p.usa == null && !p.so && !p.ok))) return { erro: 'Esse livro ainda não terminou de ficar pronto. Tente daqui a pouco.' };
  if (!(await copiarBlobLv('img/' + id + '/capa', 'ex/' + id + '/capa'))) return { erro: 'Não achei a capa desse livro.' };
  for (let i = 1; i <= pags.length; i++) if (pags[i - 1].usa == null && !pags[i - 1].so) await copiarBlobLv('img/' + id + '/p' + i, 'ex/' + id + '/p' + i);
  const temas = await lerTemas(), t = temas.find((x) => x.id === L.tema) || {};
  const ex = {
    id, tipo: 'livro', pedido: id, nome: L.nome, genero: L.genero, tema: L.tema, n: pags.length, em: Date.now(), mostrar: true,
    mapa: pags.map((p, i) => (p.so ? -1 : p.usa != null ? p.usa : i)),
    titulo: flex(t.titulo || '{nome}', L.nome, L.genero), textos: (t.paginas || []).map((p) => flex(p.texto || '', L.nome, L.genero))
  };
  let lista = []; try { lista = (await loja().get('exemplos', { type: 'json' })) || []; } catch (e) {}
  lista = lista.filter((x) => x.id !== id); lista.unshift(ex);
  await loja().setJSON('exemplos', lista);
  return { ok: true, lista };
}

// ---------------------------------------------------------------------------
// WHATSAPP: livro pronto → link do livro + os 3 PDFs (com legenda explicando cada um, sem link)
// ---------------------------------------------------------------------------
export function linkPdf(g, tipo) { return SITE + '/lv-pdf/' + g.id + '/' + tipo + '-' + g.livro.token + '.pdf'; }
function nomePdf(g, tipo) {
  const n = String(g.livro.nome || 'Livro').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'Livro-Magico-' + n + ({ ler: '', folhas: '-imprimir-folhas', livreto: '-imprimir-livreto' }[tipo]) + '.pdf';
}
const LEGENDA_PDF = {
  ler: '📱 *Para ler no celular*\nO livro inteiro, uma página por vez, com as ilustrações em alta qualidade. É só abrir e ir passando. 💛',
  folhas: '🖨️ *Para imprimir (o jeito mais fácil)*\nImprima só a frente, em folha A4 deitada. Cada folha vira duas páginas do livro. Depois é só empilhar na ordem e grampear do lado esquerdo.',
  livreto: '📖 *Para imprimir como livrinho*\nImprima frente e verso, escolhendo "virar pela borda curta". Empilhe as folhas, dobre ao meio e grampeie na dobra: vira um livrinho de verdade! Dica: papel A4 de 150 a 180 g fica lindo.'
};
// manda só os PDFs (os arquivos precisam já existir)
export async function enviarPdfsLivro(para, g) {
  let ok = 0;
  for (const tipo of ['ler', 'folhas', 'livreto']) {
    if (await enviarDocumento(para, linkPdf(g, tipo), nomePdf(g, tipo), LEGENDA_PDF[tipo])) ok++;
  }
  if (ok) await registrar('livro_pdf', { para, pedido: g.id, n: ok }).catch(() => {});
  return ok;
}
export async function pdfsProntos(g) {
  const atual = await getStore('presentes').get(g.id, { type: 'json' }).catch(() => null);
  return !!((atual && atual.livro && atual.livro.pdf) || (g.livro && g.livro.pdf));
}
// texto com o link + PDFs. Se os PDFs ainda não existem, pede pra fazer (segundo plano) e eles chegam logo depois.
export async function entregarLivroZap(para, g, base) {
  const nome = g.livro.nome;
  await enviarTexto(para, '📖✨ *O Livro Mágico de ' + nome + ' ficou pronto!*\n\nAqui você lê virando as páginas e ouve as 2 músicas com o nome de ' + nome + ':\n' + SITE + '/#/livro/' + g.id +
    '\n\nAbaixo vão os arquivos em PDF, pra guardar e imprimir do jeito que preferir 👇');
  if (await pdfsProntos(g)) return enviarPdfsLivro(para, g);
  await fetch((base || process.env.URL || SITE) + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, para }) }).catch(() => {});
  return 0;
}

// ---------------------------------------------------------------------------
// PACOTE: depois do Pix, cria os outros livros (mesma criança, mesma foto), já pagos
// ---------------------------------------------------------------------------
export async function criarLivrosDoPacote(g) {
  const L = g.livro, temas = (await lerTemas()).filter((t) => t.status === 'publicado' && t.id !== L.tema);
  const escolhidos = g.pacote.tipo === 'todos' ? temas : temas.filter((t) => t.id === g.pacote.tema2).slice(0, 1);
  const foto = await loja().getWithMetadata('foto/' + g.id, { type: 'arrayBuffer' }).catch(() => null);
  const criados = [];
  const { indexar, indexarDia } = await import('./_indice.mjs');
  for (const t of escolhidos) {
    const id = novoId(), token = novoToken();
    if (foto && foto.data) await loja().set('foto/' + id, foto.data, { metadata: foto.metadata || { tipo: 'image/jpeg' } });
    const n = {
      id, produto: 'livro', duracao: 'vitalicio', criadoEm: Date.now(), pago: true, pagoEm: Date.now(), cortesia: true, pacoteDe: g.id,
      meuNome: '', parceiroNome: L.nome, musicaParaNome: L.nome, musicaWhatsapp: g.musicaWhatsapp || g.whatsapp || '', whatsapp: g.whatsapp || '',
      livro: { tema: t.id, nome: L.nome, genero: L.genero, idade: L.idade, idadeMeses: L.idadeMeses, token, status: 'criando', capa: {}, musica: {}, paginas: [], zapEntrega: L.zapEntrega || '' },
      pagamento: { valor: 0, provedor: 'pacote', pacoteDe: g.id }
    };
    await getStore('presentes').setJSON(id, n);
    try { await indexarDia('p', id); await indexarDia('pg', id); if (n.whatsapp) await indexar(n.whatsapp, 'p', id); } catch (e) {}
    criados.push({ id, t: token, tema: t.id });
  }
  g.pacote.criados = criados;
  return criados;
}

// vendas por história (contadas pelo site). O painel soma as vendas feitas fora do site.
export async function lerVendas() { try { return (await loja().get('vendas', { type: 'json' })) || {}; } catch (e) { return {}; } }
export async function somarVenda(tema) {
  try { const v = await lerVendas(); v[tema] = (v[tema] || 0) + 1; await loja().setJSON('vendas', v); } catch (e) {}
}
