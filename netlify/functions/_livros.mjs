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
// QUEM VAI JUNTO NA HISTÓRIA (até 3: família, amigo ou bichinho), cada um com foto e nome.
// pt = como aparece no texto ("a mamãe Ana"); en = como a IA desenha.
// ---------------------------------------------------------------------------
export const MAX_EXTRAS = 3;
export const TIPOS_EXTRA = {
  mae: { pt: 'a mamãe', en: "the child's mother, an adult woman" },
  pai: { pt: 'o papai', en: "the child's father, an adult man" },
  irmao: { pt: 'o irmão', en: "the child's brother" },
  irma: { pt: 'a irmã', en: "the child's sister" },
  avo_f: { pt: 'a vovó', en: "the child's grandmother, an older woman" },
  avo_m: { pt: 'o vovô', en: "the child's grandfather, an older man" },
  tio: { pt: 'o tio', en: "the child's uncle, an adult man" },
  tia: { pt: 'a tia', en: "the child's aunt, an adult woman" },
  primo: { pt: 'o primo', en: "the child's cousin, a boy" },
  prima: { pt: 'a prima', en: "the child's cousin, a girl" },
  amigo: { pt: 'o amigo', en: "the child's best friend, a boy" },
  amiga: { pt: 'a amiga', en: "the child's best friend, a girl" },
  pessoa: { pt: '', en: 'a person very close to the child' },
  cachorro: { pt: 'o cachorrinho', en: 'the family pet dog', pet: true },
  gato: { pt: 'o gatinho', en: 'the family pet cat', pet: true },
  coelho: { pt: 'o coelhinho', en: 'the family pet rabbit', pet: true },
  passaro: { pt: 'o passarinho', en: 'the family pet bird', pet: true },
  pet: { pt: 'o bichinho de estimação', en: 'the family pet animal', pet: true }
};
const PAPEIS = ['mae', 'mamae', 'mainha', 'pai', 'papai', 'painho', 'vovo', 'vo', 'avo', 'tio', 'tia', 'titio', 'titia', 'irmao', 'irma', 'primo', 'prima', 'dinda', 'dindo', 'madrinha', 'padrinho'];
function semAcento(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
// "Papai", "Mamãe", "Vovó"… no lugar do nome: usa o próprio apelido ("o papai", "a vovó")
export function nomeExtra(x) {
  const t = TIPOS_EXTRA[x && x.tipo] || TIPOS_EXTRA.pessoa, n = String((x && x.nome) || '');
  if (PAPEIS.indexOf(semAcento(n)) >= 0) {
    const art = /^(a|as)\b/.test(t.pt) ? 'a ' : 'o ';
    return art + n.toLowerCase();
  }
  return (t.pt ? t.pt + ' ' : '') + n;
}
function listaExtras(extras) {
  const ns = (extras || []).filter((x) => x && x.nome).map(nomeExtra);
  if (ns.length <= 1) return ns[0] || '';
  return ns.slice(0, -1).join(', ') + ' e ' + ns[ns.length - 1];
}
// frase que entra na 1ª página (quem foi junto) e na última (quem estava lá no final)
export function fraseExtras(livro) {
  const ex = (livro && livro.extras) || [];
  const lista = listaExtras(ex);
  if (!lista) return null;
  return {
    ini: 'E sabe quem foi junto nessa aventura? ' + lista.charAt(0).toUpperCase() + lista.slice(1) + '!',
    fim: 'E ' + lista + (ex.length > 1 ? ' estavam' : ' estava') + ' ali, pertinho, vibrando junto.'
  };
}
// MÚSICA com quem vai junto: entra uma ponte cantando o nome de cada um (antes do final)
export function letraComJunto(letra, livro, tema) {
  const ex = ((livro && livro.extras) || []).filter((x) => x && x.nome);
  if (!ex.length || (tema && tema.propria)) return letra;
  const lista = listaExtras(ex);
  const ponte = '[Bridge]\nE quem foi junto nessa aventura?\n' + lista.charAt(0).toUpperCase() + lista.slice(1) + '!\n' +
    'De mãos dadas, que alegria pura\n' + livro.nome + ' e ' + (ex.length > 1 ? 'quem mais ama' : nomeExtra(ex[0])) + ', juntinhos na vida!\n\n';
  const i = String(letra).search(/\[Outro\]/i);
  return i >= 0 ? letra.slice(0, i) + ponte + letra.slice(i) : String(letra).replace(/\s*$/, '') + '\n\n' + ponte.trim();
}
// texto pronto de uma página da história (nome, menino/menina e quem foi junto)
export function textoPagina(tema, livro, i) {
  const ps = (tema && tema.paginas) || [];
  let tx = flex((ps[i] || {}).texto || '', livro.nome, livro.genero);
  const f = tema && tema.propria ? null : fraseExtras(livro);
  if (f && tx) {
    if (i === 0) tx = tx + ' ' + f.ini;
    else if (i === ps.length - 1) tx = f.fim + ' ' + tx;
  }
  return tx;
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
  if (id === 'propria') return lerPropria();
  const ts = await lerTemas();
  return ts.find((t) => t.id === id) || null;
}

// ---------------------------------------------------------------------------
// "CRIE SUA PRÓPRIA HISTÓRIA": a pessoa conta como quer a história e a IA escreve
// (10 a 12 páginas, 5 ilustradas). A vitrine (capa, vendas, publicar) fica no painel.
// O livro guarda a história escrita em livro.temaProprio.
// ---------------------------------------------------------------------------
export const PROPRIA_PADRAO = {
  id: 'propria', propria: true, emoji: '✨', status: 'publicado', ordem: 1,
  nome: 'Crie sua própria história',
  titulo: 'Crie sua própria história',
  descricao: 'Você conta como quer a história e a gente escreve e ilustra com o rostinho da criança e de quem você quiser junto: família, amigos ou o bichinho de estimação.',
  cores: ['#FFF1D6', '#F4C35A', '#6B4BC4'],
  roupa: 'colorful comfortable clothes',
  capa: 'standing in the middle of a giant open magical storybook, little scenes rising from the pages around (a castle, a beach, a forest with animals, a rocket in the stars), floating golden letters and sparkles, warm magical light',
  vitrineEm: null, vitrineGenero: 'menina', vendasFora: 0
};
export async function lerPropria() {
  let c = null; try { c = await loja().get('propria', { type: 'json' }); } catch (e) {}
  return Object.assign({}, PROPRIA_PADRAO, c || {}, { id: 'propria', propria: true });
}
export async function salvarPropria(c) {
  const atual = await lerPropria();
  const n = Object.assign(atual, {
    status: c.status === 'rascunho' ? 'rascunho' : (c.status === 'publicado' ? 'publicado' : atual.status),
    descricao: c.descricao != null ? String(c.descricao).slice(0, 300) : atual.descricao,
    capa: c.capa != null && String(c.capa).trim() ? String(c.capa).slice(0, 900) : atual.capa,
    ordem: c.ordem != null ? (Number(c.ordem) || 1) : atual.ordem,
    vendasFora: c.vendasFora != null ? Math.max(0, Math.min(1000000, parseInt(c.vendasFora, 10) || 0)) : atual.vendasFora
  });
  if (c.vitrineEm) { n.vitrineEm = c.vitrineEm; n.vitrineGenero = c.vitrineGenero === 'menino' ? 'menino' : 'menina'; }
  await loja().setJSON('propria', n);
  return n;
}
// a história do livro: a escrita pela IA (própria) ou a do catálogo
export async function temaDoLivro(L) {
  if (L && L.tema === 'propria') return L.temaProprio || null;
  return acharTema(L && L.tema);
}

const MODELOS_HIST = ['openai/gpt-5.4-mini', 'google/gemini-3.8-flash', 'anthropic/claude-haiku-4-5'];
function pedidoHistoria(L) {
  const menina = L.genero === 'menina';
  const idade = Number(L.idade) === 0 ? 'bebê de ' + (L.idadeMeses || 0) + ' meses' : (L.idade || 4) + ' anos';
  const ex = (L.extras || []).filter((x) => x && x.nome);
  const juntos = ex.length ? ex.map((x) => '- ' + nomeExtra(x) + ' (' + ((TIPOS_EXTRA[x.tipo] || {}).en || 'a person') + ')').join('\n') : '(ninguém: só a criança e os personagens que a família citar)';
  const relato = String(L.pedidoHistoria || '').replace(/\s+/g, ' ').trim().slice(0, 2500);
  const tituloPedido = String(L.tituloPedido || '').trim();
  return 'Escreva um livro infantil personalizado em português do Brasil, A PARTIR DO RELATO DA FAMÍLIA abaixo.\n\n' +
    'Protagonista: ' + L.nome + ', ' + (menina ? 'menina' : 'menino') + ', ' + idade + '.\n' +
    'Quem vai junto na história (use exatamente esses nomes e papéis, e faça cada um participar de verdade):\n' + juntos + '\n\n' +
    '=== RELATO DA FAMÍLIA (é a base de TUDO) ===\n' + relato + '\n=== FIM DO RELATO ===\n\n' +
    'REGRA MAIS IMPORTANTE: a história TEM que ser a que a família contou. Antes de escrever, liste em "elementos" tudo o que o relato cita: ' +
    'o lugar, as pessoas, os bichos, os objetos, as brincadeiras, as comidas, os acontecimentos e o momento marcante. ' +
    'Depois escreva a história usando TODOS esses elementos, na ordem que fizer sentido, e NÃO troque o tema, o lugar nem os acontecimentos por outros. ' +
    'Você pode (e deve) deixar mais divertido e emocionante: diálogos, humor leve, detalhes bonitos e um pouquinho de magia, mas sempre em volta do que a família contou. ' +
    'Se o relato for curto, aprofunde o que foi dito, sem inventar outro assunto.\n\n' +
    'Regras:\n' +
    '- 12 páginas. Cada "texto" tem de 35 a 60 palavras, linguagem de livro infantil, com começo, meio e fim. Use o nome ' + L.nome + ' e os nomes de quem vai junto direto no texto. Escreva ' + (menina ? 'no feminino' : 'no masculino') + ' para a criança.\n' +
    '- A última página termina com uma LIÇÃO bonita e educativa que nasce da própria história (ex.: cuidar, compartilhar, coragem, gratidão, amor pela família).\n' +
    '- EXATAMENTE 5 páginas com "ilustrada": true: a 1ª, a 3ª, a 6ª, a 9ª e a 12ª. As outras são só texto ("ilustrada": false).\n' +
    '- Para cada página ilustrada, "cena" é uma descrição em INGLÊS do momento DAQUELA página, mostrando os elementos do relato (o lugar, os bichos, os objetos citados), começando com um verbo de ação, cheia de detalhes de cenário e cores, e dizendo quem de quem vai junto aparece (ex.: "with her mom and the dog Thor"). Use "the child" para a criança.\n' +
    '- Tudo fofo, seguro e adequado para crianças: sem violência, sem medo, sem marcas, sem personagens famosos de desenho ou filme (troque por personagens originais parecidos). Se o relato tiver algo impróprio, adapte com delicadeza.\n' +
    (tituloPedido
      ? '- "titulo": use EXATAMENTE este título escolhido pela família: "' + tituloPedido.replace(/"/g, "'") + '".\n'
      : '- "titulo": título da capa com o nome da criança, ligado ao relato (ex.: "' + L.nome + ' e o Sítio do Vovô"), até 45 letras.\n') +
    '- "capa": cena da capa em INGLÊS que mostra o LUGAR e os elementos principais do relato, com a criança na frente e quem vai junto ao lado. "roupa": a roupa da criança em INGLÊS (sempre a mesma, combinando com o relato).\n' +
    '- "letra": letra de uma música infantil curta em português sobre ESSA história (cantando também o nome de cada um que vai junto), com [Intro] "Era uma vez… ' + L.nome + '…", [Verse], [Chorus] repetindo o nome ' + L.nome + ', [Verse], [Chorus] e [Outro]. "estiloMusica": estilo em inglês terminando com "portuguese vocals".\n' +
    'Responda SOMENTE com JSON válido neste formato:\n' +
    '{"elementos":["..."],"titulo":"...","emoji":"🎈","cores":["#hex claro","#hex médio","#hex escuro"],"roupa":"...","capa":"...","paginas":[{"texto":"...","ilustrada":true,"cena":"..."},{"texto":"...","ilustrada":false}],"letra":"...","estiloMusica":"children\'s song, ..., portuguese vocals"}';
}
// transforma a resposta da IA numa "história" igual às do catálogo (texto + cena; páginas só de texto)
function montarTemaProprio(o, L) {
  const brutas = (Array.isArray(o && o.paginas) ? o.paginas : []).map((p) => ({
    texto: String((p && p.texto) || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    cena: String((p && p.cena) || '').replace(/\s+/g, ' ').trim().slice(0, 700),
    ilu: !!(p && p.ilustrada)
  })).filter((p) => p.texto).slice(0, 12);
  if (brutas.length < 8) return null;
  // exatamente 5 ilustradas (a 1ª sempre); se a IA errou, espalha pelas páginas
  let ilus = brutas.map((p, i) => (p.ilu && p.cena ? i : -1)).filter((i) => i >= 0);
  if (ilus.indexOf(0) < 0 && brutas[0].cena) ilus.unshift(0);
  if (ilus.length !== 5 || ilus[0] !== 0) {
    const n = brutas.length, alvo = [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1];
    ilus = [...new Set(alvo)].slice(0, 5);
  }
  const fallbackCena = String((o && o.capa) || 'smiling in a magical colorful landscape').slice(0, 700);
  const paginas = brutas.map((p, i) => (ilus.indexOf(i) >= 0 ? { texto: p.texto, cena: p.cena || fallbackCena } : { texto: p.texto, so: true }));
  const cores = Array.isArray(o.cores) && o.cores.length === 3 && o.cores.every((c) => /^#[0-9a-f]{3,8}$/i.test(String(c))) ? o.cores : PROPRIA_PADRAO.cores;
  const letra = String(o.letra || '').slice(0, 2500);
  return {
    id: 'propria', propria: true, emoji: String(o.emoji || '✨').slice(0, 4), status: 'publicado',
    nome: 'História de ' + L.nome, titulo: String((L.tituloPedido && String(L.tituloPedido).trim()) || o.titulo || (L.nome + ' e a Grande Aventura')).slice(0, 60),
    cores, roupa: String(o.roupa || 'colorful comfortable clothes').slice(0, 300),
    capa: String(o.capa || PROPRIA_PADRAO.capa).slice(0, 900), paginas,
    letra: letra.length > 80 ? letra : '[Intro]\nEra uma vez… ' + L.nome + '!\n\n[Verse]\nUma história só minha, cheia de magia\nCom gente que eu amo e muita alegria\n\n[Chorus]\n' + L.nome + ', ' + L.nome + ', que aventura linda\nA nossa história mais bonita ainda!\n\n[Outro]\nFim… e começa de novo, ' + L.nome + '!',
    estiloMusica: String(o.estiloMusica || "children's song, cheerful, warm vocals, catchy chorus, portuguese vocals").slice(0, 300)
  };
}
// pede a história a 3 IAs ao mesmo tempo e usa a primeira que vier certinha
export async function escreverHistoriaPropria(L) {
  const sistema = 'Você é um autor premiado de livros infantis personalizados. Você transforma o relato de cada família num livro fiel ao que ela contou: mesmo lugar, mesmas pessoas, mesmos bichos, mesmos acontecimentos, só que mais divertido, emocionante e educativo. Escreve em português do Brasil. Responda SOMENTE com JSON válido, sem comentários.';
  const pedido = pedidoHistoria(L);
  const ctrls = [];
  async function chamar(m) {
    const ctl = new AbortController(); ctrls.push(ctl);
    try {
      const r = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST', signal: ctl.signal,
        headers: { Authorization: 'Bearer ' + chaveApi(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 6000, temperature: 0.7, messages: [{ role: 'system', content: sistema }, { role: 'user', content: pedido }] })
      });
      const d = await r.json().catch(() => null);
      const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!r.ok || !txt) { console.log('história própria FALHA ' + m + ' ' + r.status); return null; }
      const ini = txt.indexOf('{'), fim = txt.lastIndexOf('}');
      const t = montarTemaProprio(JSON.parse(txt.slice(ini, fim + 1)), L);
      if (t) console.log('história própria OK ' + m);
      return t;
    } catch (e) { console.log('história própria erro ' + m + ': ' + (e && e.message)); return null; }
  }
  const tema = await new Promise((resolve) => {
    let faltam = MODELOS_HIST.length;
    const tm = setTimeout(() => resolve(null), 90 * 1000);
    MODELOS_HIST.forEach((m) => chamar(m).then((v) => { if (v) { clearTimeout(tm); resolve(v); } else if (--faltam === 0) { clearTimeout(tm); resolve(null); } }));
  });
  ctrls.forEach((c) => { try { c.abort(); } catch (e) {} });
  return tema;
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

// FILTRO DO GOOGLE: com foto de criança, algumas palavras fazem o Google recusar a imagem
// (pijama, cama, dormindo, abraço, ajoelhado, chorando, nadando…). Aqui elas são trocadas por
// versões neutras SEMPRE, em todas as histórias (inclusive as que você cria no painel).
// A partir da 3ª recusa da mesma imagem, troca também água/rio/mar e "fazendo carinho".
const TROCAS_SEMPRE = [
  [/\b(is |are )?asleep cuddled together\b/gi, 'is sitting together'], [/\bin a (sparkling )?(shallow )?stream with feet in the water\b/gi, 'on the dry bank of a small stream'],
  [/\b(red |cozy |warm )?(christmas )?pajamas?\b/gi, 'cozy clothes'],
  [/\btucked in bed\b/gi, 'sitting in a cozy armchair'], [/\bin bed\b/gi, 'in a cozy armchair'], [/\bbedroom\b/gi, 'room'], [/\bbed\b/gi, 'armchair'],
  [/\bwaking up\b/gi, 'smiling'], [/\b(is |are )?(fast )?asleep\b/gi, 'resting'], [/\bsleeping\b/gi, 'resting'],
  [/\bcuddled together\b/gi, 'sitting together'], [/\bcuddl\w*\b/gi, 'sitting close'], [/\bunder blankets?\b/gi, 'with soft cushions'], [/\bblankets?\b/gi, 'cushions'],
  [/\bbath(tub|ing|e)?\b/gi, 'playtime'], [/\btowel\b/gi, 'scarf'], [/\bdiapers?\b/gi, 'clothes'], [/\b(shirtless|naked|undress\w*)\b/gi, 'dressed'],
  [/\bhugging\b/gi, 'celebrating with'], [/\b(a |an )?(warm |big |tight )?(goodbye )?hugs?\b/gi, ' a warm goodbye wave'], [/\bembracing\b/gi, 'next to'], [/\bkiss(es|ing)?\b/gi, 'wave'],
  [/\bkneels down\b/gi, 'bends down'], [/\bkneeling\b/gi, 'standing'], [/\bkneels?\b/gi, 'stands'],
  [/\bcrying\b/gi, 'slightly sad'], [/\bcries\b|\bcry\b/gi, 'looks sad'], [/\btears?\b/gi, 'a sad face'],
  [/\bscared|afraid|frightened\b/gi, 'surprised'], [/\b(hurt|injur\w*|wounded|blood\w*)\b/gi, 'tired'],
  [/\bwith feet in the water\b/gi, 'on the dry bank'], [/\bswimming\b/gi, 'floating'], [/\bswims?\b/gi, 'floats'], [/\bwet\b/gi, 'sparkling'],
  [/\blying\b/gi, 'sitting'], [/\blap\b/gi, 'side']
];
const TROCAS_DEPOIS = [
  [/\b(sparkling |shallow |flowing |calm |blue )?(river|stream|lake|pond|waterfall)\b/gi, 'meadow'],
  [/\b(sea|ocean|beach|shore|lakeshore|water edge|water)\b/gi, 'magical meadow'], [/\bunderwater\b/gi, 'in a magical world'],
  [/gently petting its head|petting|stroking/gi, 'smiling kindly at']
];
export function cenaSegura(cena, recusas) {
  let c = String(cena || '');
  TROCAS_SEMPRE.forEach(([re, por]) => { c = c.replace(re, por); });
  if ((recusas || 0) >= 3) TROCAS_DEPOIS.forEach(([re, por]) => { c = c.replace(re, por); });
  return c.replace(/\s{2,}/g, ' ').replace(/\ba a\b/gi, 'a').trim();
}
// quem vai junto: a foto de cada um vem logo depois da foto da criança (referências 2, 3, 4)
function promptExtras(livro, ehCapa) {
  const ex = ((livro && livro.extras) || []).filter((x) => x && x.nome);
  if (!ex.length) return '';
  const ord = ['SECOND', 'THIRD', 'FOURTH'];
  const quem = ex.map((x, i) => {
    const t = TIPOS_EXTRA[x.tipo] || TIPOS_EXTRA.pessoa;
    return 'the ' + ord[i] + ' reference photo is ' + t.en + ' (named ' + x.nome + ')' +
      (t.pet ? ': draw this exact animal, same species, breed, size, fur color and markings, friendly and cute'
        : ': draw this exact person with the same face, age, skin tone, hair and look as in the photo, fully dressed in casual clothes that match the scene');
  }).join('; ');
  return 'Companions in this story: ' + quem + '. ' +
    (ehCapa ? 'Show the companions on the cover around the child, slightly behind the child, ' : 'The companions take part in this scene together with the child, ') +
    'everyone happy and natural, all in the same illustration style. The main child is always the hero, in the center and in front. ';
}
// ROSTO IDÊNTICO: a instrução do rosto vem PRIMEIRO (a IA dá mais peso ao começo), é repetida no final,
// e a capa (quando vai junto) serve só pra roupa e cores — o rosto vem SEMPRE da foto real.
const ROSTO =
  'MOST IMPORTANT RULE, ABOVE EVERYTHING ELSE: the main child must have EXACTLY the same face as the child in the FIRST reference photo. ' +
  'This is a personalized gift: the parents must look at the picture and instantly say "that is my child". ' +
  'Copy precisely, feature by feature: face shape and width, cheeks, jaw and chin; the eyes (shape, size, distance between them, eyelids and eye color); eyebrows (shape and thickness); ' +
  'nose (width, bridge and tip); mouth, lips and smile; ears; skin tone and undertone; freckles, moles, dimples or birthmarks; ' +
  'hair color, hair texture (straight, wavy, curly or coily), length, hairline, part, bangs and hairstyle. Keep the same age, ethnicity and gender appearance. ' +
  'Keep the REAL proportions of this face: do not enlarge the eyes, do not shrink the nose, do not slim or round the face, do not lighten or darken the skin, do not beautify, never use a generic cartoon face. ' +
  'Only the rendering is illustrated (soft 3D picture-book shading and lighting); the facial structure stays a faithful portrait of the photo. ';
export function promptImagem(tema, livro, cena, ehCapa, semFoto) {
  const nEx = semFoto ? 0 : (((livro && livro.extras) || []).filter((x) => x && x.nome).length);
  return (semFoto ? '' : ROSTO) + ESTILO_BASE +
    (semFoto ? 'The main character is an adorable, expressive Brazilian child with a big smile. '
      : 'The main character is the child from the FIRST reference photo. ') +
    'The child is ' + idadeIA(livro) + ', wearing ' + (tema.roupa || 'colorful comfortable clothes') + '. ' +
    (nEx ? promptExtras(livro, ehCapa) : '') +
    (ehCapa || semFoto ? '' : (nEx
      ? 'If there is one more reference image after the companion photos (the LAST one), it is the book cover: use it ONLY for the outfit, colors and art style. '
      : 'If a SECOND reference image is given, it is the book cover: use it ONLY for the outfit, colors and art style. ') +
      'Never copy the face from the cover: the face always comes from the FIRST photo. ') +
    'The child is fully dressed in the outfit described and is the clear hero of the scene, happy and expressive, with the face clearly visible (not hidden, not turned away, not too small). ' +
    'Scene: the child ' + cena + '. ' +
    (ehCapa ? 'Book cover composition: keep the top quarter of the image calm and uncluttered (sky or soft background) because the title will be placed there; the child is large in the frame with the face well lit. ' : '') +
    'CORRECT ANATOMY FOR EVERY PERSON AND ANIMAL: each person has exactly two arms, two hands and two legs, five fingers on each hand, and every arm clearly connected to the shoulder; no extra or missing arms, hands, legs, fingers or heads, no merged or floating limbs. ' +
    'Each hand does only ONE thing: if the child is holding someone\'s hand, only the OTHER hand can touch or hold something else (or rests naturally). ' +
    'Animals have the right number of legs, ears, eyes and one tail. ' +
    'Absolutely no text, letters, words, numbers on clothing except as described, logos or watermarks. Safe, wholesome, age-appropriate. ' +
    (semFoto ? '' : 'Final check before finishing: count the arms and hands of every character (exactly two each); the child\'s face must be identical to the FIRST reference photo' + (nEx ? ', and each companion must look like their own photo' : '') + '.');
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
// fotos de quem vai junto (mãe, pai, bichinho…): /lv-foto/<pedido>/x1-<token>.jpg
function linksExtras(base, g) {
  return ((g.livro && g.livro.extras) || []).filter((x) => x && x.nome).map((x, i) => base + '/lv-foto/' + g.id + '/x' + (i + 1) + '-' + g.livro.token + '.jpg');
}
function refsPagina(base, g, p) {
  // SEMPRE a foto real da criança (é ela que garante o rosto), depois as fotos de quem vai junto.
  // Com a capa pronta, ela vai por último, só como modelo de visual.
  // Se o Google recusar, NÃO troca nada: só insiste de novo, quantas vezes precisar.
  const L = g.livro, fotos = [linkFoto(base, g, false)].concat(linksExtras(base, g));
  if (!L.capa.ok) return fotos;
  return fotos.concat([L.capa.url || linkImg(base, g, 'capa')]);
}
function linkImg(base, g, nome) { return base + '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + g.id + '/' + nome) + '&t=' + g.livro.token; }

// histórico de cada tentativa (só o painel vê): pediu / falhou / erro / ok / recomeçou
function hist(item, ev, msg) {
  item.hist = (item.hist || []).concat([{ em: Date.now(), ev, n: item.tent || 0, msg: msg ? String(msg).slice(0, 220) : undefined }]).slice(-60);
}
async function andarImagem(item, chave, criar, limite) {
  // item: { task, ok, tent }
  if (item.ok) return false;
  // pedidos que demoraram e foram deixados de lado: o Google pode terminar depois. Continua conferindo
  // (até 30 min) e, se algum ficar pronto, usa ele — nada do que o Google fez é jogado fora.
  if ((item.velhas || []).length && limite.downloads > 0) {
    const vivas = [];
    for (const v of item.velhas) {
      if (Date.now() - (v.em || 0) > 30 * 60 * 1000) continue;
      const sv = await verTarefa(v.task, 'imagem');
      if (sv.estado === 'pronto' && !item.ok) {
        limite.downloads--;
        try { await guardarImagem(sv.urls[0], chave); item.ok = true; item.erro = false; item.url = sv.urls[0]; item.task = null; item.okEm = Date.now(); item.velhas = []; hist(item, 'ok', 'saiu o pedido que tinha demorado'); return true; }
        catch (e) { console.error('guardar imagem (velha)', chave, e.message); }
      } else if (sv.estado === 'rodando') vivas.push(v);
    }
    item.velhas = vivas;
  }
  if (!item.task) {
    const tent = item.tent || 0;
    // NUNCA DESISTE (cliente pagou, o livro tem que sair):
    //  - as 3 primeiras tentativas são na hora;
    //  - depois, tenta de novo a cada 30 s durante 30 min (troca de modelo/link quando o Google recusa a foto);
    //  - passou de 30 min: marca no painel como "com problema", mas CONTINUA tentando a cada 5 min (até 24 h).
    item.ini = item.ini || Date.now();
    const idade = Date.now() - item.ini;
    // tenta ATÉ O FINAL: não existe limite de tentativas
    let marcou = false;
    if (idade > 30 * 60 * 1000 && !item.erro) { item.erro = true; marcou = true; }
    // recusa do Google: insiste a cada ~5 s; outros erros: a cada 30 s. SEM diminuir o ritmo, até sair.
    const recusou = /refused|cannot read|upload/i.test(item.msg || '');
    const espera = tent < 3 ? 0 : (recusou ? 5 * 1000 : 30 * 1000);
    if (Date.now() - (item.em || 0) < espera) return marcou;
    try { item.task = await criar(item); }
    catch (e) { item.msg = String(e && e.message || e).slice(0, 300); item.tent = tent + 1; item.em = Date.now(); hist(item, 'erro', item.msg); console.error('livro imagem (criar):', chave, item.msg); return true; }
    item.tent = tent + 1; item.em = Date.now(); hist(item, 'pediu');
    return true;
  }
  if (limite.downloads <= 0) return false;
  const st = await verTarefa(item.task, 'imagem');
  if (st.estado === 'falhou' || (st.estado === 'rodando' && Date.now() - (item.em || 0) > 5 * 60 * 1000)) {
    item.msg = st.estado === 'falhou' ? (st.msg || 'a IA recusou ou falhou ao gerar') : 'demorou mais de 5 min: pedi outra, mas continuo esperando esta também';
    // demorou: NÃO cancela. Guarda pra continuar conferindo e, ao mesmo tempo, pede outra.
    if (st.estado === 'rodando') item.velhas = (item.velhas || []).concat([{ task: item.task, em: item.em }]).slice(-3);
    if (/refused|cannot read|upload/i.test(item.msg)) { item.recusas = (item.recusas || 0) + 1; }
    hist(item, 'falhou', item.msg);
    console.error('livro imagem falhou:', chave, item.msg);
    item.task = null; return true; // tenta de novo na próxima volta
  }
  if (st.estado === 'pronto') {
    limite.downloads--;
    try { await guardarImagem(st.urls[0], chave); item.ok = true; item.erro = false; item.url = st.urls[0]; item.task = null; item.okEm = Date.now(); hist(item, 'ok'); return true; }
    catch (e) { console.error('guardar imagem', chave, e.message); item.msg = 'não consegui baixar a imagem: ' + e.message; item.task = null; hist(item, 'falhou', item.msg); return true; }
  }
  return false;
}

export async function avancarLivro(id, base, opts) {
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || g.produto !== 'livro' || !g.livro) return null;
  const L = g.livro;
  if (L.status === 'pronto' && g.pago) return g;
  // quem faz o livro andar é o "motor" (a cada 3 s). Os outros (tela, agendador, webhook) só ligam o motor,
  // pra duas partes do sistema não pedirem a mesma imagem ao mesmo tempo.
  if (!(opts && opts.motor)) {
    if (await motorRodando(id)) return g;
    const falta = g.pago ? true : !(previaPronta(g) && g.musicaPreviewUrl);
    if (falta && await ligarMotor(id, base)) return g;
  }
  // CRIE SUA PRÓPRIA HISTÓRIA: primeiro a IA escreve a história (uns 10 a 30 s), depois segue igual às outras
  if (L.tema === 'propria' && !L.temaProprio) {
    L.escrita = L.escrita || {};
    if (Date.now() - (L.escrita.em || 0) < (L.escrita.tent ? 20 * 1000 : 0)) return g;
    L.escrita.em = Date.now(); L.escrita.tent = (L.escrita.tent || 0) + 1;
    const tp = await escreverHistoriaPropria(L).catch(() => null);
    if (tp) { L.temaProprio = tp; L.escrita.ok = Date.now(); L.historiaEm = Date.now(); }
    else { L.escrita.erro = 'a IA não escreveu a história (tentativa ' + L.escrita.tent + '), tentando de novo'; }
    await presentes.setJSON(g.id, g);
    if (!tp) return g;
  }
  const tema = await temaDoLivro(L);
  if (!tema) return g;
  const nome = L.nome;
  let mudou = false;
  const limite = { downloads: 5 };
  L.capa = L.capa || {};
  L.musica = L.musica || {};

  // 1) capa (prévia)
  try {
    mudou = (await andarImagem(L.capa, 'img/' + g.id + '/capa',
      (it) => criarImagem(promptImagem(tema, L, cenaSegura(tema.capa, it.recusas), true), [linkFoto(base, g, Math.floor((it.recusas || 0) / 3) % 2 === 1)].concat(linksExtras(base, g)), '3:4', '2K', it.recusas || 0), limite)) || mudou;
  } catch (e) { console.error('livro capa', id, e.message); }

  // 2) música (prévia) — reaproveita se já existir pra esse nome + tema
  try {
    if (!g.musicaPreviewUrl) {
      // com gente junto (mãe, pai, bichinho…) a música é só deste livro: leva os nomes deles também
      const temJunto = (L.extras || []).some((x) => x && x.nome);
      const chaveMus = tema.propria ? 'mus/propria/' + g.id : temJunto ? 'mus/junto/' + g.id : 'mus/' + tema.id + '/' + normNome(nome);
      if (!L.musica.task) {
        const pronta = await loja().get(chaveMus, { type: 'json' }).catch(() => null);
        if (pronta && pronta.url) {
          g.musicaPreviewUrl = pronta.url; g.musicaPreviewUrl2 = pronta.url2 || null; g.musicaPreviewId = pronta.taskId || null;
          L.musica.reaproveitada = true; mudou = true;
        } else if ((L.musica.tent || 0) < MAX_TENTATIVAS) {
          L.musica.task = await criarMusica(letraComJunto(flex(tema.letra, nome, L.genero), L, tema), tema.estiloMusica, flex(tema.titulo, nome, L.genero));
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

  // página com "usa": repete a ilustração de outra cena (não gera imagem nova)
  // "so": página só de texto (sem ilustração, custo zero)
  const montarPaginas = () => { if (!(L.paginas && L.paginas.length)) { L.paginas = (tema.paginas || []).map((tp) => (tp && tp.so ? { so: true } : usaDe(tp) != null ? { usa: usaDe(tp) } : {})); mudou = true; } };

  // 2c) PRÉVIA (antes de pagar): só a 1ª ilustração da história, pra pessoa ver que é de verdade.
  // Começa JUNTO com a capa (usa a foto como referência), pra prévia sair em menos de 1 minuto.
  if (!g.pago) {
    montarPaginas();
    const i0 = indiceAmostra(L.paginas);
    if (i0 >= 0) {
      try {
        mudou = (await andarImagem(L.paginas[i0], 'img/' + g.id + '/p' + (i0 + 1), (it) =>
          criarImagem(promptImagem(tema, L, cenaSegura(tema.paginas[i0].cena, it.recusas), false), refsPagina(base, g, it), '3:4', '2K', it.recusas || 0), limite)) || mudou;
      } catch (e) { console.error('livro amostra', id, e.message); }
    }
  }

  // 3) depois do Pix: as outras ilustrações (a da amostra já está pronta e é aproveitada)
  if (g.pago && (L.capa.ok || L.capa.erro || (L.capa.tent || 0) >= 3)) {
    montarPaginas();
    if (L.status !== 'gerando' && L.status !== 'pronto') { L.status = 'gerando'; L.gerandoEm = Date.now(); mudou = true; }
    // as ilustrações andam todas ao mesmo tempo (antes era uma de cada vez e a tela pulava de 2 pra 4)
    const res = await Promise.all(L.paginas.map(async (p, i) => {
      if (p.usa != null || p.so) return false;
      try {
        return await andarImagem(p, 'img/' + g.id + '/p' + (i + 1), (it) =>
          criarImagem(promptImagem(tema, L, cenaSegura(tema.paginas[i].cena, it.recusas), false), refsPagina(base, g, it), '3:4', '2K', it.recusas || 0), limite);
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
      for (let i = 1; i <= (L.extras || []).length; i++) { try { await loja().delete('foto/' + g.id + '/x' + i); } catch (e) {} }
      if (L.autoExemplo) { L.autoExemplo = false; await presentes.setJSON(g.id, g); try { await adicionarExemplo(g.id); L.virouExemplo = true; } catch (e) { console.error('exemplo automático', e && e.message); } }
    } else if (acabou && L.status !== 'problema') {
      // alguma imagem não saiu depois de todas as tentativas: guarda a foto e avisa no painel (botão "Refazer imagens")
      L.status = 'problema'; mudou = true;
    }
  } else if (!g.pago && L.capa.ok && g.musicaPreviewUrl && L.status !== 'previa') {
    L.status = 'previa'; mudou = true;
  }
  // relatório: quando a prévia ficou pronta (capa + 1ª ilustração)
  if (!g.pago && !L.previaEm && previaPronta(g)) { L.previaEm = Date.now(); mudou = true;
  }

  if (mudou) await presentes.setJSON(g.id, g);
  return g;
}

// prévia pronta pra mandar = capa + 1ª ilustração (se a ilustração falhar de vez, vai sem ela)
// + música (se a música ainda estiver terminando depois de 40 s, manda assim mesmo: no link ela aparece quando ficar pronta)
export function previaPronta(x) {
  if (!(x && x.livro && x.livro.capa && x.livro.capa.ok)) return false;
  const ps = x.livro.paginas || [];
  if (!ps.length) return false;
  const i0 = indiceAmostra(ps);
  // a 1ª ilustração: espera ela, mas se travar mais de 3 min manda a prévia sem ela (ela continua sendo feita e aparece no link)
  if (i0 >= 0 && !(ps[i0].ok || ps[i0].erro) && Date.now() - (x.criadoEm || 0) < 3 * 60 * 1000) return false;
  return !!x.musicaPreviewUrl || Date.now() - (x.criadoEm || 0) > 40 * 1000;
}
// liga o "motor" rápido do livro (segundo plano). Se já tiver um rodando, ele mesmo ignora.
export async function ligarMotor(id, base) {
  try {
    const r = await fetch((base || SITE) + '/.netlify/functions/livro-andar-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    return !!(r && (r.ok || r.status === 202));
  } catch (e) { return false; }
}
export async function motorRodando(id) {
  const t = await loja().get('andar/' + id, { type: 'json' }).catch(() => null);
  return !!(t && t.ate > Date.now());
}
// RESERVA: só UMA parte do sistema manda cada mensagem (evita mensagens repetidas no WhatsApp).
// Grava "é minha", espera um instante e confere se continua sendo minha.
export async function reservar(chave, ttl) {
  const zl = getStore({ name: 'whatsapp', consistency: 'strong' });
  const ja = await zl.get(chave, { type: 'json' }).catch(() => null);
  if (ja && Date.now() - (ja.em || 0) < ttl) return false;
  const eu = Math.random().toString(36).slice(2);
  await zl.setJSON(chave, { em: Date.now(), eu }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 400)));
  const v = await zl.get(chave, { type: 'json' }).catch(() => null);
  return !!(v && v.eu === eu);
}
// AMOSTRA GRÁTIS: a 1ª ilustração da história (não é a capa) sai já na prévia, antes de pagar
export function indiceAmostra(paginas) { const ps = paginas || []; for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (p && !p.so && p.usa == null) return i; } return -1; }
// índice da cena cuja ilustração esta página repete (ou null = ilustração nova)
export function usaDe(tp) { const n = tp && tp.usa; return (n === 0 || (n && Number.isInteger(+n))) && +n >= 0 ? +n : null; }
// diagnóstico (só o administrador vê)
export function diagLivro(g) {
  const L = g.livro || {}, it = (x) => ({ ok: !!(x && x.ok), tent: (x && x.tent) || 0, erro: !!(x && x.erro), msg: (x && x.msg) || '', rodando: !!(x && x.task),
    recusas: (x && x.recusas) || 0, em: (x && x.em) || 0, ini: (x && x.ini) || 0, okEm: (x && x.okEm) || 0, hist: (x && x.hist) || [] });
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
    extras: (L.extras || []).map((x) => ({ tipo: x.tipo, nome: x.nome })),
    txExtra: L.tema === 'propria' ? null : fraseExtras(L),
    escrevendo: L.tema === 'propria' && !L.temaProprio,
    temaProprio: L.temaProprio ? { id: 'propria', propria: true, emoji: L.temaProprio.emoji, nome: L.temaProprio.nome, titulo: L.temaProprio.titulo, cores: L.temaProprio.cores,
      paginas: (L.temaProprio.paginas || []).map((p) => (p.so ? { texto: p.texto, so: true } : { texto: p.texto })) } : null,
    paginas: g.pago ? (L.paginas || []).map((p, i) => {
      if (p.so) return 'so';
      if (p.usa != null) { const o = (L.paginas || [])[p.usa]; return o && o.ok ? img('p' + (p.usa + 1)) : null; }
      return p.ok ? img('p' + (i + 1)) : null;
    }) : (L.paginas || []).map((p, i) => (i === indiceAmostra(L.paginas) && p.ok ? img('p' + (i + 1)) : null)),
    amostra: indiceAmostra(L.paginas) >= 0 ? indiceAmostra(L.paginas) : null,
    amostraErro: !!(indiceAmostra(L.paginas) >= 0 && L.paginas[indiceAmostra(L.paginas)].erro),
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
  const pronto = previaPronta;
  if (!pronto(g)) {
    try { g = (await avancarLivro(id, base || SITE)) || g; } catch (e) { console.error('previa livro zap', id, e && e.message); }
    if (!pronto(g)) return 'esperando';
  }
  const para = await conversaAberta(num);
  if (!para) return 'semjanela';
  // a prévia vai UMA vez só pra este número (se pedir de novo em 10 min, não repete)
  if (!(await reservar('lvenv_' + id + '_' + num, 10 * 60 * 1000))) return 'enviado';
  const nome = g.livro.nome;
  let tema = null; try { tema = await temaDoLivro(g.livro); } catch (e) {}
  const titulo = tema ? flex(tema.titulo, nome, g.livro.genero) : 'Livro Mágico';
  // 1) a capa + o link da prévia (no site ele lê o comecinho da história e ouve a música)
  const texto = '📖✨ *A prévia do livro de ' + nome + ' ficou pronta!*\n*' + titulo + '*\n\n' +
    '🎵 Ouça a música e veja o começo da história:\n' + linkPreviaLivro(g);
  const capa = SITE + '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/' + id + '/capa') + '&t=' + g.livro.token;
  let ok = await enviarImagem(para, capa, texto);
  if (!ok) ok = await enviarTexto(para, texto);
  if (!ok) return 'erro';
  await registrar('enviou', { para, pedido: id, nome, via: 'livro' }).catch(() => {});
  // 2) o PDF da prévia + o que libera + os exemplos: monta em segundo plano (leva uns segundos)
  const primeira = !g.livro.exemplosZap;
  try { const atual = await presentes.get(id, { type: 'json' }).catch(() => null) || g; atual.livro.exemplosZap = atual.livro.exemplosZap || Date.now(); await presentes.setJSON(id, atual); } catch (e) {}
  const r = await fetch((base || SITE) + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, previa: true, para, info: primeira }) }).catch(() => null);
  if (!r && primeira) await enviarInfoPrevia(para, g);
  return 'enviado';
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// depois do PDF da prévia: o que libera + valores, 1 exemplo (PDF pra ler + PDF pra imprimir) e o link pra desbloquear
export async function enviarInfoPrevia(para, g) {
  const nome = g.livro.nome, P = PACOTES_LIVRO;
  await esperar(1500);
  await enviarTexto(para,
    '👆 Essa é só uma *amostra*, com 1 ilustração.\n\n' +
    '🔓 *Desbloqueando, você recebe:*\n' +
    '📖 O livro completo, ilustrado com o rostinho de ' + nome + '\n' +
    '🎵 2 músicas personalizadas completas\n' +
    '📱 Versão digital + 🖨️ PDF pra imprimir\n\n' +
    '💛 1 livro R$ ' + P.um.valor + ' · 2 livros R$ ' + P.dois.valor + ' · coleção R$ ' + P.todos.valor).catch(() => {});
  try { await enviarExemploZap(para, g.livro.tema); } catch (e) { console.error('exemplo zap', e && e.message); }
  await esperar(2500);
  await enviarTexto(para, '🔓 *Ouça sua música e desbloqueie o livro de ' + nome + ':*\n' + linkPreviaLivro(g)).catch(() => {});
}
// PDF da prévia (capa, "este livro pertence a", título, o começo da história e a 1ª ilustração)
export function linkPdfPrevia(g, tipo) { return SITE + '/lv-pdf/' + g.id + '/' + (tipo || 'previa') + '-' + g.livro.token + '.pdf'; }
export async function enviarPdfPrevia(para, g) {
  const n = String(g.livro.nome || 'Livro').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return enviarDocumento(para, linkPdfPrevia(g, 'previa'), 'Previa-Livro-Magico-' + n + '.pdf',
    '📖 *Prévia do livro de ' + g.livro.nome + '*\nA capa, o começo da história e a primeira ilustração. ✨');
}
// 1 exemplo de livro pronto (o 1º marcado "📲 WhatsApp" no painel): o PDF pra ler e o PDF de folhas pra imprimir
export async function enviarExemploZap(para, temaPreferido) {
  let lista = []; try { lista = (await loja().get('exemplos', { type: 'json' })) || []; } catch (e) {}
  lista = lista.filter((x) => x && x.tipo === 'livro' && x.mostrar !== false && x.pedido);
  if (!lista.length) return 0;
  const x = lista.find((y) => y.zap) || lista.find((y) => y.tema === temaPreferido) || lista[0];
  const ge = await getStore('presentes').get(x.pedido, { type: 'json' }).catch(() => null);
  if (!(ge && ge.pago && ge.livro)) return 0;
  if (!ge.livro.pdf) { await fetch(SITE + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.pedido }) }).catch(() => {}); return 0; }
  const n = String(ge.livro.nome || 'Livro').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await esperar(1500);
  await enviarTexto(para, '✨ *Veja um livro pronto, de outra criança* 👇');
  await enviarDocumento(para, linkPdf(ge, 'ler'), 'Exemplo-Livro-Magico-' + n + '.pdf', '📱 *Exemplo: livro completo pra ler*\nA história inteira ilustrada, página por página.');
  await esperar(1500);
  await enviarDocumento(para, linkPdf(ge, 'folhas'), 'Exemplo-Livro-Magico-' + n + '-imprimir.pdf', '🖨️ *Exemplo: jeito de imprimir*\nCada folha A4 vira 2 páginas do livro. É só imprimir, empilhar e grampear.');
  return 1;
}
// compatibilidade com o nome antigo
export const enviarExemplosZap = enviarExemploZap;

// PAINEL: refaz as imagens que falharam (zera as tentativas). A foto precisa ainda existir.
export async function refazerImagens(id) {
  const presentes = getStore('presentes');
  const g = await presentes.get(id, { type: 'json' }).catch(() => null);
  if (!g || !g.livro) return { erro: 'Livro não encontrado.' };
  const foto = loja().getMetadata ? await loja().getMetadata('foto/' + id).catch(() => null) : await loja().get('foto/' + id, { type: 'arrayBuffer' }).catch(() => null);
  if (!foto) return { erro: 'A foto da criança já foi apagada. Peça uma foto nova pro cliente e crie o livro de novo.' };
  const L = g.livro;
  // se alguma imagem está sendo pedida agora, NÃO recomeça (senão estraga a tentativa que está rodando)
  const todas = [L.capa].concat((L.paginas || []).filter((p) => p && !p.so && p.usa == null));
  if (todas.some((it) => it && !it.ok && it.task)) return { erro: 'Uma imagem está sendo gerada agora. O sistema já está tentando sozinho: espere essa tentativa terminar.' };
  const zera = (it) => { if (it && !it.ok) { it.tent = 0; it.erro = false; it.task = null; it.msg = ''; it.em = 0; it.recusas = 0; it.ini = 0; hist(it, 'recomecou'); } };
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
  const t = L.temaProprio || (await lerTemas()).find((x) => x.id === L.tema) || {};
  const ex = {
    id, tipo: 'livro', pedido: id, nome: L.nome, genero: L.genero, tema: L.tema, n: pags.length, em: Date.now(), mostrar: true,
    mapa: pags.map((p, i) => (p.so ? -1 : p.usa != null ? p.usa : i)),
    titulo: flex(t.titulo || '{nome}', L.nome, L.genero), textos: (t.paginas || []).map((p, i) => textoPagina(t, L, i))
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
  await getStore('whatsapp').setJSON('lvent_' + g.id, { em: Date.now(), para }).catch(() => {}); // relatório: entregue
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
    // quem vai junto (mãe, pai, bichinho…) também entra nos outros livros do pacote
    for (let k = 1; k <= (L.extras || []).length; k++) {
      const fx = await loja().getWithMetadata('foto/' + g.id + '/x' + k, { type: 'arrayBuffer' }).catch(() => null);
      if (fx && fx.data) await loja().set('foto/' + id + '/x' + k, fx.data, { metadata: fx.metadata || { tipo: 'image/jpeg' } });
    }
    const n = {
      id, produto: 'livro', duracao: 'vitalicio', criadoEm: Date.now(), pago: true, pagoEm: Date.now(), cortesia: true, pacoteDe: g.id,
      meuNome: '', parceiroNome: L.nome, musicaParaNome: L.nome, musicaWhatsapp: g.musicaWhatsapp || g.whatsapp || '', whatsapp: g.whatsapp || '',
      livro: { tema: t.id, nome: L.nome, genero: L.genero, idade: L.idade, idadeMeses: L.idadeMeses, extras: L.extras || [], token, status: 'criando', capa: {}, musica: {}, paginas: [], zapEntrega: L.zapEntrega || '' },
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
