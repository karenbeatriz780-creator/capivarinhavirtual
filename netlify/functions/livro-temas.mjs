// LIVRO MÁGICO — histórias (temas)
// GET                         → histórias publicadas (pra página do livro)
// GET  ?admin=1 (x-admin-key) → todas, com tudo (painel)
// POST (x-admin-key) { acao: 'salvar', temas:[...] }
//                    { acao: 'rascunho', ideia }        → a IA escreve uma história nova (rascunho)
//                    { acao: 'vitrine', id }            → gera a capa de vitrine (exemplo da página inicial)
//                    { acao: 'vitrine-status', id }
//                    { acao: 'exemplo-add', id }        → usa um livro PAGO como exemplo na página (copia capa + ilustrações)
//                    { acao: 'exemplo-foto', foto }     → foto sua (ex.: livro impresso) pra girar na página
//                    { acao: 'exemplos-salvar', exemplos:[{id,mostrar}] } → ordem / mostrar / tirar
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { lerDias, idsDosDiasTudo, diaBR } from './_indice.mjs';
import { HISTORIAS_20 } from './_historias20.mjs';
import { json, loja, lerTemas, TEMAS_PADRAO, criarImagem, verTarefa, guardarImagem, promptImagem, chaveApi, flex, refazerImagens, avancarLivro, usaDe, diagLivro, motorRodando, adicionarExemplo, linkPdf, lerVendas, lerPropria, salvarPropria } from './_livros.mjs';

// ---------- exemplos (vitrine da página) ----------
async function lerExemplos() { try { return (await loja().get('exemplos', { type: 'json' })) || []; } catch (e) { return []; } }
function urlEx(id, nome, v) { return '/.netlify/functions/livro-img?k=' + encodeURIComponent('ex/' + id + '/' + nome) + '&v=' + (v || 1); }
function exPublico(x) {
  const o = { id: x.id, tipo: x.tipo, mostrar: x.mostrar !== false, zap: !!x.zap, capa: urlEx(x.id, 'capa', x.em), legenda: x.legenda || '' };
  if (x.tipo === 'livro') {
    Object.assign(o, { nome: x.nome, genero: x.genero, tema: x.tema, titulo: x.titulo, textos: x.textos || [], pedido: x.pedido,
      paginas: Array.from({ length: x.n || 0 }, (_, i) => { const m = (x.mapa && x.mapa[i] != null) ? x.mapa[i] : i; return m < 0 ? 'so' : urlEx(x.id, 'p' + (m + 1), x.em); }) });
  }
  return o;
}
async function copiarBlob(de, para) {
  const r = await loja().getWithMetadata(de, { type: 'arrayBuffer' }).catch(() => null);
  if (!r || !r.data) return false;
  await loja().set(para, r.data, { metadata: r.metadata || {} });
  return true;
}

// HISTÓRIAS NOVAS (painel: "Adicionar as histórias novas"). Cada uma: 5 ilustrações + páginas só de texto.
// Ordem das páginas no livro aberto: [texto | ilustração], [texto | texto], ... (assim nunca fica ilustração na esquerda)
const NOVAS_HISTORIAS = [
  {
    id: 'davi-golias', emoji: '🛡️', ordem: 1,
    nome: 'A Coragem de Davi',
    titulo: '{nome} e a Coragem de Davi',
    descricao: 'Ao lado do Menino Jesus, [ele|ela] viaja até o tempo do pastorzinho Davi e vê de pertinho como a fé vence o gigante Golias.',
    cores: ['#FFF1D6', '#E8A85C', '#5B7FB8'],
    roupa: 'a simple cream linen tunic with a light blue sash and brown leather sandals, in the style of ancient Israel',
    capa: 'standing on a sunny green hill beside a kind smiling boy Jesus (around the same age, gentle face, simple white robe, soft warm glow, no halo) and the young shepherd David holding a sling, fluffy sheep around them, a clear stream below, distant tents and blue mountains, golden light, peaceful and brave mood',
    paginas: [
      { texto: 'Era uma vez {nome}, que adormeceu ouvindo uma história da Bíblia. Num piscar de olhos, [ele|ela] acordou numa colina verdinha, cheia de ovelhas. Ao lado, um menino de sorriso bondoso estendeu a mão: "Oi, {nome}! Eu sou Jesus. Quer conhecer um amigo muito corajoso?"',
        cena: 'waking up on a green hill full of fluffy sheep, a kind smiling boy Jesus (same age, simple white robe, gentle warm glow, no halo) offering a hand, morning sun over ancient Israel landscape, olive trees' },
      { texto: 'Lá embaixo, perto do riacho, estava Davi, um pastorzinho de cabelo cacheado. Ele tocava harpa para as ovelhas dormirem e cuidava de cada uma com carinho. "Quando um leão chegou perto do rebanho", contou Davi, "Deus me deu força para proteger as minhas ovelhinhas."', so: true },
      { texto: '{nome} ficou de olhos arregalados. "Você não teve medo?" Davi sorriu: "Tive, sim. Mas coragem não é não sentir medo. Coragem é confiar em Deus e fazer o que é certo mesmo assim." Jesus piscou para {nome}: "Guarda bem isso no coração."', so: true },
      { texto: 'Do alto do morro, eles viram dois exércitos frente a frente. De um lado, o povo de Israel, tremendo. Do outro, um gigante enorme chamado Golias, com armadura brilhante, que gritava todos os dias: "Quem tem coragem de lutar comigo?" Ninguém respondia.',
        cena: 'standing safely on a hilltop next to boy Jesus and young David, looking far across a valley at a huge armored giant warrior (seen from far away, not scary, storybook style), two camps of tents on opposite hills, dramatic but child-friendly sky' },
      { texto: 'Davi tinha ido levar pão e queijo para os irmãos mais velhos, que eram soldados. Quando ouviu o gigante zombando de Deus, ele disse firme: "Eu vou!" Os soldados riram. "Você? Tão pequeno?" Mas Davi não estava sozinho, e sabia disso.', so: true },
      { texto: '{nome} segurou a mão de Jesus. "Ele é tão pequeno quanto eu…" Jesus sorriu: "Deus não olha o tamanho de fora, olha o tamanho da fé que a gente tem dentro. E a fé de Davi é gigante." {nome} sentiu o coração ficar quentinho e forte.', so: true },
      { texto: 'O rei Saul emprestou sua armadura para Davi. Mas o capacete caía nos olhos, a espada arrastava no chão e Davi mal conseguia andar! {nome} e Jesus deram risada junto com ele. "Não preciso disso", disse Davi, tirando tudo. "Vou do jeito que Deus me fez."',
        cena: 'laughing together with boy Jesus as young David wears a giant oversized royal armor and helmet that falls over his eyes, a kind bearded king watching amused, inside a royal tent with colorful fabrics' },
      { texto: 'No riacho, Davi escolheu cinco pedrinhas lisinhas. {nome} ajudou a procurar as mais redondinhas, com os pés na água fresquinha. Jesus explicou: "Davi não confia nas pedras, nem na força dele. Ele confia em Deus. É isso que faz dele um gigante de verdade."',
        cena: 'kneeling in a sparkling shallow stream with feet in the water, helping young David choose five smooth round stones, boy Jesus smiling beside them, reeds, butterflies, sunlight reflections' },
      { texto: 'Davi correu até o gigante e disse: "Você vem com espada, mas eu venho em nome do Senhor!" Girou a funda, lançou uma pedrinha e… Golias caiu no chão, com um baque que levantou poeira! O povo comemorou. {nome} pulou de alegria nos braços de Jesus. "Com Deus, ninguém é pequeno demais!" Fim.',
        cena: 'jumping with joy and hugging boy Jesus on a hillside while young David raises his sling in victory, the giant lying far away in a cloud of dust (non-violent, no injury shown), soldiers cheering with raised arms, golden sunset sky' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} e a coragem de Davi!\n\n[Verse]\nNuma colina verde, com as ovelhinhas\nJesus segurou a minha mãozinha\nDavi, pastorzinho, com a harpa a cantar\nMe ensinou que a fé faz a gente avançar\n\n[Chorus]\n{nome}, {nome}, coração valente\nCom Deus do lado, a gente vai em frente\nNão importa o tamanho, o gigante cai\nQuem confia em Deus nunca sozinho vai!\n\n[Verse]\nCinco pedrinhas lá do riachinho\nDavi foi firme, foi bem pequenininho\nGolias caiu, o povo cantou\nE o meu coração de alegria pulou\n\n[Chorus]\n{nome}, {nome}, coração valente\nCom Deus do lado, a gente vai em frente!\n\n[Outro]\nCom Deus ninguém é pequeno demais… {nome}!',
    estiloMusica: "children's gospel song, joyful worship, acoustic guitar, hand claps, light percussion, warm vocals, uplifting and brave, catchy chorus, portuguese vocals"
  },
  {
    id: 'fazenda', emoji: '🐄', ordem: 2,
    nome: 'A Fazenda dos Sonhos',
    titulo: '{nome} e a Fazenda dos Sonhos',
    descricao: 'Para quem ama bichinhos: vira fazendeir[o|a] por um dia, cuida da vaquinha, do cavalinho e descobre de onde vêm o leite, o ovo e o mel.',
    cores: ['#FFE8B8', '#F6B86B', '#7BAE5A'],
    roupa: 'denim overalls over a red-and-white gingham shirt, small yellow rain boots and a straw hat',
    capa: 'standing proudly on a dirt path in front of a big red barn with a white X door, a tall silver silo, a gentle brown-and-white cow, a fluffy white sheep and a little chestnut pony around, green rolling hills, sunflowers, a wooden fence, golden morning light, butterflies',
    paginas: [
      { texto: 'Era uma vez {nome}, [um|uma] pequen[o|a] aventureir[o|a] que acordou com o canto do galo: cocoricóóó! Pela janela, o sol pintava de dourado a Fazenda dos Sonhos. Lá fora, o celeiro vermelho, o silo prateado e um monte de bichinhos esperavam por [ele|ela].',
        cena: 'waking up in a cozy farmhouse bedroom, stretching happily next to an open wooden window, outside a rooster on the fence sings at sunrise, a red barn and a silver silo glowing in golden light' },
      { texto: 'O vovô fazendeiro entregou um chapéu de palha: "Hoje, {nome}, você é [o|a] fazendeir[o|a] mais importante daqui!" Na cozinha, tinha bolo de fubá quentinho e suco de laranja. "Pra cuidar dos bichinhos, primeiro a gente cuida da barriguinha", disse a vovó, sorrindo.', so: true },
      { texto: 'No caminho até o celeiro, {nome} aprendeu que cada bichinho tem seu jeitinho de falar. A vaca faz muuu, a ovelha faz béééé, o porquinho faz óinc, o pato faz quá-quá. E o cachorrinho Pipoca? Au, au! Ele foi correndo na frente, abanando o rabo.', so: true },
      { texto: 'A primeira amiga foi a Vaquinha Mimosa. "Muuu! Bom dia, {nome}!" Juntos, encheram um baldinho de leite quentinho, que vira queijo, iogurte e o leitinho do café da manhã. {nome} fez carinho na Mimosa, e ela abanou o rabo de felicidade.',
        cena: 'gently petting a friendly brown-and-white cow inside a warm wooden barn with hay bales, a small shiny milk bucket, a curious kitten watching, a little dog wagging its tail, warm light through the barn door' },
      { texto: 'No galinheiro, a Dona Galinha Pintadinha mostrou um segredo: um ninho cheio de ovos! {nome} pegou um por um, com todo o cuidado do mundo, e colocou na cestinha. Os pintinhos amarelinhos piavam em volta: piu, piu, piu! Parecia até que batiam palminhas.', so: true },
      { texto: 'Depois foi a hora da horta. {nome} arrancou uma cenoura laranjinha da terra, regou os pés de alface e achou uma abóbora gigante! "Tudo que a gente planta com carinho cresce bonito", ensinou o vovô. Até a minhoca saiu da terra pra dar oi.', so: true },
      { texto: 'Perto das flores, as abelhinhas trabalhavam sem parar: zum, zum, zum! Elas levavam o pólen das flores para a colmeia e faziam o mel mais docinho do mundo. {nome} provou uma colherinha com a vovó e fechou os olhos: "Hummm, que delícia!"',
        cena: 'tasting a little wooden spoon of golden honey next to a smiling grandmother, colorful wooden beehives with tiny friendly bees, a garden full of flowers, carrots and a giant pumpkin, sunny afternoon' },
      { texto: 'Veio o passeio mais esperado: montar no Trovão, o cavalinho mais manso da fazenda! Trotando devagarinho pela trilha, com o vovô segurando a rédea, {nome} viu um campo inteiro de girassóis virando o rostinho para o sol, como se dissessem: "Oi!"',
        cena: 'riding a gentle little chestnut pony on a sunny trail while a smiling grandfather holds the reins safely, a huge field of sunflowers, a silver silo and red barn in the distance' },
      { texto: 'Quando o céu ficou cor-de-rosa, todos os bichinhos se juntaram para dar boa-noite. "Obrigado por cuidar da gente, {nome}!" E [ele|ela] entendeu que o mais gostoso da fazenda é o amor que a gente dá e recebe. Fim… até a próxima aventura!',
        cena: 'sitting on a wooden fence at sunset hugging a fluffy sheep, the cow, the pony, a hen with chicks and a little dog gathered happily around, pink and orange sky, fireflies starting to glow, the red barn behind' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} na fazenda!\n\n[Verse]\nO galo cantou, o sol apareceu\nA vaquinha Mimosa já disse: bom dia, muuu!\nO cavalinho Trovão quer passear\nE a galinha Pintadinha vem cantar\n\n[Chorus]\n{nome}, {nome}, na Fazenda dos Sonhos\nCom os bichinhos todos, que dia risonho!\nÉ muu, é piu, é cocoricó\n{nome} é a alegria da fazenda inteirinha!\n\n[Verse]\nTem ovo no ninho, tem mel na colmeia\nGirassol sorrindo, cenoura na horta\nO pôr do sol pinta o céu de cor\nE a fazenda inteira canta com amor\n\n[Chorus]\n{nome}, {nome}, na Fazenda dos Sonhos\nCom os bichinhos todos, que dia risonho!\n\n[Outro]\nBoa noite, fazenda… boa noite, {nome}!',
    estiloMusica: "children's song, cheerful farm sing-along, ukulele, xylophone, hand claps, animal sounds, warm female vocals, playful, catchy chorus, portuguese vocals"
  },
  {
    id: 'futebol', emoji: '⚽', ordem: 3,
    nome: 'O Craque do Coração',
    titulo: '{nome}, [o|a] Craque do Coração',
    descricao: 'Do treino na pracinha até a grande final: uma história de garra, amizade e trabalho em equipe, com [ele|ela] levantando a taça do campeonato.',
    cores: ['#E3F6D8', '#4CAF50', '#1E5AA8'],
    roupa: 'a bright yellow football jersey with green trim and the number 10, blue shorts, white socks and green football boots',
    capa: 'running with a football on a lush green stadium pitch under bright floodlights, a cheering colorful crowd in the stands, confetti in the air, a golden trophy shining on a podium in the background, joyful and energetic',
    paginas: [
      { texto: 'Era uma vez {nome}, que dormia abraçad[o|a] com a bola e sonhava com gols. Todo fim de tarde, [ele|ela] corria até a pracinha para treinar: chute, drible, passe e muita risada. "Um dia eu vou jogar a grande final", dizia, olhando para o céu.',
        cena: 'practicing football in a colorful neighborhood park at sunset, kicking a ball toward a small goal made of two backpacks, friends cheering, trees and a little ice cream cart nearby' },
      { texto: 'Um dia chegou a notícia: o time do bairro, os Leõezinhos, ia disputar o Campeonato da Cidade! O treinador Zé apitou: "Quero ver garra, mas quero ver amizade também. Aqui ninguém joga sozinho." {nome} vestiu a camisa 10 com o coração batendo forte.', so: true },
      { texto: 'Nos treinos, nem tudo deu certo. {nome} chutou longe, escorregou na lama e até errou um passe fácil. Mas o treinador Zé ensinou: "Quem cai e levanta já está ganhando. Errar faz parte de aprender." E {nome} levantava, sacudia a poeira e tentava de novo.', so: true },
      { texto: 'No primeiro jogo, o time estava perdendo. {nome} viu a amiga Lia livre e, em vez de chutar sozinh[o|a], passou a bola. Gooool! Os Leõezinhos se abraçaram no meio do campo. {nome} descobriu que um passe bonito vale tanto quanto um gol.',
        cena: 'hugging teammates in a happy group celebration in the middle of a green field, all wearing yellow jerseys, a smiling coach with a whistle clapping on the sideline, a small crowd of families cheering' },
      { texto: 'O time foi vencendo, jogo após jogo. Na semifinal, um menino do outro time caiu e machucou o joelho. {nome} parou a jogada e estendeu a mão para ajudar. A torcida inteira aplaudiu de pé. "Isso é ser craque de verdade", disse o juiz, sorrindo.', so: true },
      { texto: 'Na noite antes da final, {nome} não conseguia dormir. "E se eu errar?" A família veio para perto: "Joga com alegria, do jeito que você ama. A gente já tem orgulho de você, ganhando ou perdendo." {nome} fechou os olhos e sonhou com o estádio cheio.', so: true },
      { texto: 'Chegou o grande dia! O estádio estava lotado de bandeirinhas, balões e cantoria. Os Leõezinhos entraram de mãos dadas. Faltando um minuto para acabar, o jogo estava empatado. A bola veio para {nome}, que respirou fundo e olhou para o gol…',
        cena: 'walking onto a big stadium pitch holding hands with teammates in yellow jerseys, the stands full of colorful flags, balloons and cheering families, floodlights glowing, excitement in the air' },
      { texto: '…e chutou com toda a força e todo o carinho do mundo. A bola fez uma curva no ar e… GOOOOOL! O estádio inteiro gritou o nome de {nome}! O apito final soou: os Leõezinhos eram os campeões da cidade!',
        cena: 'kicking the ball in a powerful dynamic shot, the ball curving into the net past a diving goalkeeper, the crowd jumping and cheering in the stands, confetti starting to fly' },
      { texto: 'Na hora de levantar a taça, {nome} chamou o time inteiro, o treinador Zé e até o menino do outro time para a foto. "Ninguém ganha sozinho!" A taça brilhou, os confetes voaram, e {nome} soube: o maior troféu é ter amigos de verdade. Fim.',
        cena: 'lifting a shiny golden trophy high above the head surrounded by the whole team, the coach and a smiling player from the other team, confetti and streamers falling, a happy crowd and fireworks in the night sky' }
    ],
    letra: '[Intro]\nEra uma vez… {nome}, o craque do coração!\n\n[Verse]\nNa pracinha eu treino, chute e driblar\nCaio e levanto, nunca vou parar\nCom os meus amigos a gente é um time\nPasse bonito também é gol, imagine!\n\n[Chorus]\n{nome}, {nome}, camisa dez\nA torcida canta, bate os pés\nOlê, olê, olá, é gol, é gol!\n{nome} é campeão, brilha como o sol!\n\n[Verse]\nNa grande final o estádio a cantar\nUm minuto pro fim e eu vou chutar\nA bola fez curva, entrou no gol\nE a taça brilhou que nem farol\n\n[Chorus]\n{nome}, {nome}, camisa dez\nA torcida canta, bate os pés!\n\n[Outro]\nNinguém ganha sozinho… olê, {nome}!',
    estiloMusica: "children's song, upbeat stadium anthem, samba percussion, crowd chants, brass hits, energetic vocals, festive, catchy chorus, portuguese vocals"
  },
  {
    id: 'cores', emoji: '🌈', ordem: 4,
    nome: 'O Mundo das Cores',
    titulo: '{nome} no Mundo das Cores',
    descricao: 'Uma aventura educativa e cheia de cor: [ele|ela] ajuda a devolver as cores ao mundo e aprende o vermelho, o amarelo, o azul e as misturas mágicas.',
    cores: ['#FFF4FB', '#FF8FB1', '#6C63FF'],
    roupa: 'a white t-shirt with small rainbow paint splashes, denim shorts and colorful sneakers, holding a magic paintbrush',
    capa: 'flying over a magical land on a rainbow, holding a giant glowing paintbrush, half of the world below is gray and the other half bursts into vivid colors where the brush passes, floating paint drops, happy colorful creatures waving',
    paginas: [
      { texto: 'Era uma vez {nome}, que acordou e levou um susto: o mundo inteiro estava cinza! O céu, as flores, até o picolé. De repente, um pincel mágico flutuou até [ele|ela] e falou: "{nome}, o Ladrão de Cores levou tudo! Só você pode devolver as cores ao mundo."',
        cena: 'standing in a completely gray town in wonder as a glowing magic paintbrush with sparkles floats toward them, the only colorful thing in the scene is the child and the brush, gray trees and gray houses around' },
      { texto: 'O pincel explicou o segredo: "Existem três cores mágicas, as cores primárias: VERMELHO, AMARELO e AZUL. Misturando essas três, a gente consegue pintar quase tudo!" {nome} segurou o pincel com firmeza: "Então vamos começar pelo vermelho!"', so: true },
      { texto: 'VERMELHO é a cor do morango, da maçã, do caminhão de bombeiros e do coração. {nome} passou o pincel e, plim!, as maçãs ficaram vermelhinhas e brilhantes. Um passarinho cantou de alegria. "Qual outra coisa vermelha você conhece?", perguntou o pincel.', so: true },
      { texto: 'AMARELO é a cor do sol, da banana, do girassol e do pintinho. {nome} pintou o céu e o sol abriu um sorrisão quentinho. Depois foi a vez do AZUL: o azul do céu, do mar e da baleia. A baleia ficou tão feliz que jogou um jato de água colorida!',
        cena: 'painting a huge smiling sun yellow with the magic brush while a big friendly blue whale splashes a fountain of water in a now-blue sea, half of the scene still gray, vivid red apples on a tree' },
      { texto: 'Agora vinha a parte mais mágica: misturar! AMARELO com AZUL… vira VERDE! {nome} pintou as árvores, a grama e um sapinho que pulou de felicidade: croac! "Verde é a cor da natureza", disse o pincel. "Das folhas, do limão e do brócolis!"', so: true },
      { texto: 'VERMELHO com AMARELO… vira LARANJA! A cor da cenoura, da laranja e da abóbora. E VERMELHO com AZUL… vira ROXO! A cor da uva, da berinjela e da lavanda. {nome} pintava e cantava, e o mundo ia acordando, cor por cor.', so: true },
      { texto: 'No alto da montanha, {nome} encontrou o Ladrão de Cores. Mas ele não era malvado: era só um bichinho cinza e tristinho. "Eu pegava as cores porque não tinha nenhuma", soluçou. {nome} sorriu: "Cor boa é cor dividida!" E pintou o bichinho com todas as cores.',
        cena: 'kindly painting a small sad gray fluffy creature with stripes of every color on a mountaintop, the creature starting to smile, scattered paint pots in red, yellow and blue, a valley of rainbow trees below' },
      { texto: 'O bichinho, agora colorido, deu um abraço apertado em {nome}. Juntos, eles pintaram o maior arco-íris que o mundo já viu: vermelho, laranja, amarelo, verde, azul, anil e violeta. Sete cores, uma em cima da outra, de um lado ao outro do céu.',
        cena: 'painting a giant rainbow across the sky together with a now-colorful happy fluffy creature, both standing on a cloud, vivid seven-color rainbow arching over a colorful town with flowers, birds and balloons' },
      { texto: 'O mundo voltou a brilhar, mais bonito do que antes. E {nome} aprendeu que cada cor tem seu lugar, e que juntas elas fazem a vida mais alegre, igualzinho às pessoas. Agora é sua vez: quais cores você vê ao seu redor? Fim.',
        cena: 'dancing happily in a vibrant colorful town square full of flowers, fruit stands and balloons of every color, the friendly colorful creature and the magic paintbrush dancing too, families smiling' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no mundo das cores!\n\n[Verse]\nVermelho é o morango, o coração\nAmarelo é o sol na minha mão\nAzul é o mar, a baleia a nadar\nTrês cores mágicas pra misturar!\n\n[Chorus]\n{nome}, {nome}, pinta o mundo inteiro\nAmarelo e azul fazem verde ligeiro\nVermelho e amarelo, laranja brilhou\nVermelho e azul, o roxo chegou!\n\n[Verse]\nSete cores juntas no arco-íris\nVermelho, laranja, amarelo, feliz\nVerde, azul, anil e violeta\nO mundo colorido é uma festa!\n\n[Chorus]\n{nome}, {nome}, pinta o mundo inteiro!\n\n[Outro]\nCor boa é cor dividida… obrigado, {nome}!',
    estiloMusica: "children's educational song, bright pop, marimba, glockenspiel, claps, cheerful kids choir, playful, easy to sing along, portuguese vocals"
  },
  {
    id: 'amigo-jesus', emoji: '🕊️', ordem: 5,
    nome: 'Um Dia com Jesus',
    titulo: '{nome} e o Amigo Jesus',
    descricao: 'Um passeio emocionante ao lado de Jesus: [ele|ela] divide os pães e peixes, vê o mar se acalmar e aprende o que é amar de verdade.',
    cores: ['#FFF8E7', '#F2C46D', '#4A7FB5'],
    roupa: 'a simple soft beige linen tunic with a small woven belt and brown sandals, in the style of ancient Galilee',
    capa: 'walking hand in hand with a kind smiling Jesus (gentle bearded man, simple white and soft blue robe, warm light, no halo) along the shore of a calm blue lake at sunrise, fishing boats, doves flying, green hills and wildflowers, peaceful and joyful',
    paginas: [
      { texto: 'Era uma vez {nome}, que sempre fazia uma oração antes de dormir. Naquela noite, um brilho suave encheu o quarto, e [ele|ela] se viu à beira de um lago azul. Um homem de sorriso bondoso se abaixou: "Oi, {nome}. Eu sou Jesus. Quer passar o dia comigo?"',
        cena: 'meeting a kind smiling Jesus (gentle bearded man, white and soft blue robe, warm light, no halo) who kneels down to the child height on the shore of a calm blue lake at dawn, fishing boats, doves' },
      { texto: 'Algumas pessoas tentaram afastar as crianças: "Jesus está ocupado!" Mas Jesus disse: "Deixem as crianças virem a mim, porque o Reino de Deus é de quem tem um coração como o delas." {nome} correu e ganhou o abraço mais quentinho do mundo.', so: true },
      { texto: 'Jesus explicou: "Sabe por que eu gosto tanto das crianças, {nome}? Porque vocês perdoam rápido, confiam de verdade e amam sem medir. Nunca deixe ninguém dizer que você é pequen[o|a] demais para fazer o bem."', so: true },
      { texto: 'Mais tarde, uma multidão enorme ouvia Jesus no campo, e todos estavam com fome. {nome} tinha uma cestinha com cinco pães e dois peixinhos. Sem pensar duas vezes, entregou tudo para Jesus: "Pode dividir o meu lanche."',
        cena: 'offering a small woven basket with five round breads and two little fish up to a smiling Jesus on a green grassy hillside, a large crowd of families sitting on the grass in the background, warm afternoon light' },
      { texto: 'Jesus agradeceu a Deus e começou a repartir. E o pão não acabava! Passava de mão em mão, de família em família, e todo mundo comeu até ficar satisfeito. Ainda sobraram doze cestos cheios! {nome} ficou de boca aberta.', so: true },
      { texto: '"Foi o seu sim que começou o milagre", disse Jesus, sorrindo. "Quando a gente divide o pouco que tem com amor, Deus multiplica." {nome} sentiu o coração tão cheio que parecia que ia transbordar de alegria.', so: true },
      { texto: 'À tarde, entraram num barco. De repente, o vento soprou forte e as ondas ficaram altas. Os amigos de Jesus ficaram com medo, e {nome} também. Jesus se levantou com calma e disse: "Silêncio! Aquiete-se!" E o mar ficou lisinho como um espelho.',
        cena: 'sitting safely in a wooden fishing boat holding onto the edge as Jesus stands calmly with an open hand, the dark storm clouds opening to golden light and the waves becoming calm, amazed fishermen in the boat' },
      { texto: 'Caminhando de volta, Jesus contou a história de um pastor que tinha cem ovelhas. Uma se perdeu, e ele deixou as noventa e nove para procurar a perdidinha. Quando achou, carregou nos ombros, todo feliz. "É assim que Deus ama você, {nome}: sem desistir nunca."',
        cena: 'walking beside Jesus who carries a small lost lamb on his shoulders across a green hill at golden hour, the child petting the lamb happily, a flock of sheep and a shepherd hut in the distance' },
      { texto: 'Quando as estrelas apareceram, Jesus deu um abraço de despedida: "Lembre sempre: ame a Deus e ame as pessoas. Eu estou com você todos os dias." {nome} acordou na própria cama, sorrindo, com o coração quentinho. E nunca mais se sentiu sozinh[o|a]. Fim.',
        cena: 'receiving a warm goodbye hug from Jesus under a sky full of stars on the lakeshore, gentle glowing light, fireflies, a peaceful village with lanterns behind them' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} e o amigo Jesus!\n\n[Verse]\nNa beira do lago Jesus me chamou\nDeixa as crianças, ele falou\nCinco pãezinhos e dois peixinhos\nDividi com amor e alimentou os vizinhos\n\n[Chorus]\n{nome}, {nome}, Jesus é meu amigo\nNa calmaria e no perigo\nAma a Deus, ama o irmão\nJesus mora no meu coração!\n\n[Verse]\nO vento soprou, o mar se acalmou\nA ovelhinha perdida ele encontrou\nNunca desiste, nunca vai deixar\nTodo dia comigo ele vai estar\n\n[Chorus]\n{nome}, {nome}, Jesus é meu amigo!\n\n[Outro]\nEu estou com você todos os dias… {nome}.',
    estiloMusica: "children's gospel song, gentle and joyful, acoustic guitar, piano, soft strings, warm vocals, heartfelt, singalong chorus, portuguese vocals"
  },
  {
    id: 'dinossauros', emoji: '🦕', ordem: 6,
    nome: 'O Vale dos Dinossauros',
    titulo: '{nome} no Vale dos Dinossauros',
    descricao: 'Uma porta secreta leva [ele|ela] ao tempo dos dinossauros: ajudar um filhote a achar a mamãe, voar com o pterossauro e fazer amizade com o T-Rex.',
    cores: ['#EAF7E1', '#8BC34A', '#E07A2E'],
    roupa: 'a khaki explorer vest with many pockets, a green t-shirt, cargo shorts, hiking boots and a small explorer hat with binoculars around the neck',
    capa: 'standing in a lush prehistoric jungle valley beside a huge gentle long-neck dinosaur and a cute baby triceratops, giant ferns, a smoking volcano far away, pterosaurs flying in an orange sky, sense of wonder',
    paginas: [
      { texto: 'Era uma vez {nome}, [um|uma] explorador[|a] que adorava dinossauros. No museu, enquanto olhava um esqueleto gigante, viu uma portinha escondida brilhando. Abriu devagarinho e… plof! Caiu numa floresta de samambaias enormes, quentinha e cheia de sons estranhos.',
        cena: 'stepping through a glowing secret door from a museum hall into a lush prehistoric jungle with giant ferns, a dinosaur skeleton visible behind the door, wonder on the face, colorful dragonflies' },
      { texto: 'BUM. BUM. BUM. O chão tremeu. Por entre as árvores apareceu um pescoço comprido, comprido… era um braquiossauro! "Não tenha medo", disse ele com uma voz grossa e calma. "Eu só como folhinhas. Meu nome é Seu Pescoção. Bem-vind[o|a] ao Vale dos Dinossauros!"', so: true },
      { texto: 'Seu Pescoção ensinou: "Aqui tem dinossauro que come plantas, os herbívoros, e dinossauro que come carne, os carnívoros. Uns são grandes como prédios, outros pequenos como galinhas." {nome} anotava tudo no caderninho de explorador[|a], de olhos arregalados.', so: true },
      { texto: 'Perto do rio, {nome} ouviu um choro fininho. Era um filhote de tricerátops, com três chifrinhos e um ovo quebrado ao lado. "Perdi minha mamãe", fungou ele. {nome} fez carinho na cabeça dele: "Calma, Tritri. Eu vou te ajudar a encontrar."',
        cena: 'kneeling beside a crying cute baby triceratops next to a cracked dinosaur egg by a sparkling river, gently petting its head, big ferns and colorful flowers around, a long-neck dinosaur watching from the trees' },
      { texto: 'Para ver o vale de cima, {nome} e Tritri pediram ajuda a uma pterossaura chamada Asa Linda. Ela abaixou as asas enormes: "Subam!" Lá do alto, viram vulcões soltando fumacinha, lagos azuis e manadas de dinossauros de todas as cores.', so: true },
      { texto: 'De repente, um rugido sacudiu tudo: ROOOAAR! Era o T-Rex! Todo mundo correu, mas {nome} percebeu uma coisa: o T-Rex estava com um espinho enorme preso no pé. "Ele não está bravo", disse {nome}. "Ele está com dor!"', so: true },
      { texto: 'Com coragem e cuidado, {nome} se aproximou devagarinho e puxou o espinho. O T-Rex suspirou aliviado e abaixou a cabeçona: "Obrigado, pequen[o|a] amig[o|a]." Daquele dia em diante, ele virou o maior protetor do vale e de {nome}.',
        cena: 'carefully pulling a big thorn out of the foot of a huge but friendly T-Rex who lowers its head gratefully, the baby triceratops peeking from behind a fern, warm jungle light, a smoking volcano far away' },
      { texto: 'Lá do alto, montad[o|a] na Asa Linda, {nome} finalmente viu: uma mamãe tricerátops procurando por toda parte! O voo desceu rapidinho. Tritri correu e os dois se abraçaram com os chifrinhos. Até o T-Rex enxugou uma lagriminha.',
        cena: 'flying on the back of a friendly pterosaur over a prehistoric valley, pointing down at a mother triceratops reuniting with her baby in a meadow, volcanoes, blue lakes and herds of colorful dinosaurs below, sunset' },
      { texto: 'Era hora de voltar. Os novos amigos fizeram uma fila para dar tchau: Seu Pescoção, Asa Linda, Tritri, a mamãe e o T-Rex. {nome} passou pela portinha brilhante e voltou ao museu, com uma escaminha verde no bolso. Quem sabe amanhã a porta abre de novo? Fim.',
        cena: 'waving goodbye at the glowing door to a line of happy dinosaurs: a long-neck dinosaur, a pterosaur, a baby triceratops with its mother and a gentle T-Rex, warm golden light, ferns and flowers' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no vale dos dinossauros!\n\n[Verse]\nAbri a portinha, plof, fui parar\nNa terra dos gigantes, quero explorar\nSeu Pescoção come folha no céu\nE a Asa Linda voa feito um chapéu\n\n[Chorus]\n{nome}, {nome}, explorador do vale\nTricerátops, T-Rex, todo mundo é legal\nBum, bum, bum, o chão vai tremer\nCom coragem e carinho tudo pode acontecer!\n\n[Verse]\nTritri chorou, a mamãe sumiu\nLá do alto o vale inteiro a gente viu\nO T-Rex rugiu, mas era de dor\nTirei o espinho, virou meu protetor\n\n[Chorus]\n{nome}, {nome}, explorador do vale!\n\n[Outro]\nRoar… tchau, dinossauros! Tchau, {nome}!',
    estiloMusica: "children's adventure song, playful jungle drums, marimba, fun dinosaur roar sound effects, energetic kids vocals, catchy chorus, portuguese vocals"
  },
  {
    id: 'atelie', emoji: '👗', ordem: 7,
    nome: 'O Ateliê dos Sonhos',
    titulo: '{nome} e o Ateliê dos Sonhos',
    descricao: 'Um mundo cor-de-rosa de moda e brilho: [ele|ela] vira estilista, cria roupas mágicas para as amigas e brilha no grande desfile da Cidade Encantada.',
    cores: ['#FFF0F7', '#FF7EB9', '#9B5DE5'],
    roupa: 'a sparkly stylish pink and lilac outfit with a little shiny jacket and glittery silver shoes',
    capa: 'posing joyfully in front of a sparkling pink dream fashion house with heart-shaped windows, racks of colorful dresses, a convertible pink car, balloons, glitter and soft pastel sky, glamorous and sweet',
    paginas: [
      { texto: 'Era uma vez {nome}, que adorava desenhar roupas, combinar cores e inventar penteados. Um dia, chegou uma carta cor-de-rosa com cheirinho de morango: "Convite especial para {nome}: venha ser estilista no Ateliê dos Sonhos da Cidade Encantada!"',
        cena: 'opening a sparkling pink envelope with a heart seal in a pastel bedroom full of drawings of dresses on the wall, glitter floating from the letter, a dreamy pink castle-like city visible through the window' },
      { texto: 'A Cidade Encantada era toda em tons de rosa, lilás e dourado. As casas tinham janelas de coração, os carrinhos eram conversíveis e até as nuvens tinham formato de laço. Na porta do ateliê, a fada costureira Madame Lilás esperava com uma fita métrica brilhante.', so: true },
      { texto: '"Aqui, cada roupa nasce de um sonho", explicou Madame Lilás. "Mas a regra mais importante é: a roupa mais bonita é aquela que faz a pessoa se sentir ela mesma." {nome} sorriu, pegou o caderno de desenhos e começou a criar.', so: true },
      { texto: 'No ateliê havia tecidos de todas as cores, lantejoulas que brilhavam como estrelas e botões que cantavam! {nome} desenhou um vestido de arco-íris, uma jaqueta de purpurina e um chapéu cheio de flores. A máquina de costura mágica fazia tudo virar realidade: zum, zum, plim!',
        cena: 'designing clothes at a magical sewing table in a pink fashion studio, colorful fabrics, sparkling sequins and ribbons floating in the air, a magic sewing machine making a rainbow dress, a kind fairy seamstress with a glowing measuring tape' },
      { texto: 'Então chegou um problema: a amiga Bia estava triste, escondida num canto. "Eu não vou desfilar. Ninguém vai gostar de mim." {nome} sentou do lado dela: "Vamos criar uma roupa que tenha a sua cara? Do que você mais gosta?" Bia respondeu baixinho: "De girassóis…"', so: true },
      { texto: '{nome} desenhou um vestido amarelo com girassóis bordados, e uma tiara de pétalas douradas. Quando Bia se olhou no espelho, abriu o maior sorriso. "Sou eu!" {nome} aprendeu que ajudar alguém a brilhar é a coisa mais bonita que uma estilista pode fazer.', so: true },
      { texto: 'Chegou a noite do Grande Desfile! A passarela tinha luzes de todas as cores, pétalas caindo do teto e uma plateia animada. Uma por uma, as amigas desfilaram com as roupas que {nome} criou. Os aplausos não paravam!',
        cena: 'watching proudly from the side of a glamorous runway as friends walk in colorful handmade outfits, one wearing a yellow sunflower dress, colorful spotlights, falling rose petals, a cheering audience with sparkles' },
      { texto: 'No fim, a apresentadora chamou: "E agora, a estilista que fez tudo isso… {nome}!" {nome} entrou na passarela com o look que mais combinava com [ele|ela], girou, mandou beijos e a plateia ficou de pé. Confetes brilhantes caíram como chuva de estrelas.',
        cena: 'walking the runway in a sparkly signature outfit, spinning happily with arms open, glitter confetti falling like stars, spotlights and a standing applauding audience, friends cheering at the end of the runway' },
      { texto: 'Madame Lilás entregou um broche dourado em forma de coração: "Para a estilista que deixa todo mundo mais feliz." Na volta para casa, {nome} abraçou o caderno de desenhos. Ser lind[o|a] é ser gentil, ser você mesm[o|a] e ajudar os outros a brilhar. Fim.',
        cena: 'receiving a golden heart-shaped brooch from a kind fairy seamstress on a sparkling pink stage, friends hugging around, balloons and confetti, a pink fashion house glowing under the night sky' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} no ateliê dos sonhos!\n\n[Verse]\nUm convite rosa com cheiro de morango\nNa Cidade Encantada eu cheguei brilhando\nTecido colorido, botão que canta\nA máquina mágica faz plim e encanta\n\n[Chorus]\n{nome}, {nome}, estrela da passarela\nCada roupa linda, cada cor mais bela\nGira, gira, brilha sem parar\nQuem é gentil faz o mundo brilhar!\n\n[Verse]\nA Bia tava triste, eu fui ajudar\nVestido de girassol pra ela brilhar\nNo grande desfile todo mundo aplaudiu\nO coração mais lindo a plateia viu\n\n[Chorus]\n{nome}, {nome}, estrela da passarela!\n\n[Outro]\nSeja você mesma e brilhe… {nome}!',
    estiloMusica: "children's pop song, sparkly dance pop, synths, glitter bells, claps, sweet confident female vocals, catchy chorus, portuguese vocals"
  },
  {
    id: 'natal', emoji: '🎄', ordem: 8,
    nome: 'O Natal Mágico',
    titulo: 'O Natal Mágico de {nome}',
    descricao: 'Uma noite de Natal inesquecível com a família: [ele|ela] ajuda o Papai Noel na fábrica de brinquedos, voa no trenó e descobre o verdadeiro presente do Natal.',
    cores: ['#FFF5EE', '#D7263D', '#1B7F4B'],
    roupa: 'cozy red Christmas pajamas with white snowflakes, a green knitted scarf and fluffy slippers',
    capa: 'sitting in front of a glowing decorated Christmas tree in a cozy living room with a warm fireplace, wrapped presents, stockings, a big window showing snow falling and Santa sleigh with reindeer flying past the moon, magical golden light',
    paginas: [
      { texto: 'Era uma vez {nome}, que contava os dias para o Natal. A casa cheirava a biscoito de canela, a árvore piscava luzinhas coloridas e a família inteira estava reunida: vovó, vovô, os tios, os primos e muitas risadas. Era a noite mais esperada do ano!',
        cena: 'decorating a big Christmas tree with the family in a cozy warm living room, a smiling grandmother holding a tray of cinnamon cookies, cousins hanging ornaments, a fireplace with stockings, golden fairy lights' },
      { texto: 'Antes da ceia, a família fez um círculo de mãos dadas. O vovô contou por que o Natal existe: "Há muito tempo, numa noite estrelada, nasceu o Menino Jesus numa manjedoura simples. Ele trouxe para o mundo o maior presente de todos: o amor."', so: true },
      { texto: '{nome} escreveu uma cartinha e deixou na janela, ao lado de um copo de leite e três cenouras para as renas. "Querido Papai Noel, este ano eu não quero só brinquedo. Quero ajudar você a deixar mais crianças felizes." E foi dormir sorrindo.', so: true },
      { texto: 'À meia-noite, um sininho tocou: blim, blom! Na janela estava ele: o Papai Noel, de bochechas vermelhas e barba branquinha! "Ho, ho, ho! Recebi sua cartinha, {nome}. Que tal me ajudar esta noite?" Lá fora, as renas esperavam, com o trenó brilhando.',
        cena: 'standing in red Christmas pajamas at an open window as a jolly Santa Claus with rosy cheeks smiles and offers a hand, a shining sleigh with reindeer waiting on the snowy roof, snowflakes and stars' },
      { texto: 'O trenó subiu, subiu, e voou por cima das cidades iluminadas até o Polo Norte. Lá ficava a Fábrica de Brinquedos, onde duendes de gorro verde martelavam, pintavam e embrulhavam presentes cantando. "Bem-vind[o|a], ajudante especial!", gritaram todos.', so: true },
      { texto: '{nome} pintou carrinhos, costurou ursinhos e fez laços em caixas de todos os tamanhos. Mas notou uma coisa: uma pilha de cartinhas de crianças que pediam coisas simples. "Um abraço do meu pai." "Que minha avó melhore." "Um amigo novo." {nome} ficou pensativ[o|a].', so: true },
      { texto: 'Na hora da entrega, o trenó passou por casas de todo canto. Em cada uma, {nome} deixava um presente e, junto, um bilhetinho escrito à mão: "Você é muito amad[o|a]. Feliz Natal!" O Papai Noel sorriu: "Esse é o presente que mais aquece o coração."',
        cena: 'flying in Santa sleigh pulled by reindeer over a snowy town full of glowing houses at night, holding a gift with a handwritten note, Santa laughing beside, the moon and northern lights in the sky' },
      { texto: 'Quando o trenó trouxe {nome} de volta, já era madrugada. Na sala, a família inteira dormia abraçada no sofá, esperando por [ele|ela]. {nome} entendeu tudo: o melhor presente do Natal não fica embaixo da árvore. É a família, é o amor, é estar junto.',
        cena: 'tiptoeing into a cozy living room at dawn where the whole family is asleep cuddled together on a big sofa under blankets, the Christmas tree glowing, presents under the tree, snow outside the window' },
      { texto: 'De manhã, todos acordaram com um cheirinho de chocolate quente. Embaixo da árvore havia um presente com o nome de {nome} e um sininho dourado. Era um bilhete do Papai Noel: "Obrigado, ajudante! O amor que você espalhou foi a maior magia desta noite." Feliz Natal! Fim.',
        cena: 'opening a present with a small golden bell in front of the Christmas tree on Christmas morning, the whole family laughing together in pajamas, mugs of hot chocolate, wrapping paper everywhere, soft morning light and snow outside' }
    ],
    letra: '[Intro]\nEra uma vez… o Natal mágico de {nome}!\n\n[Verse]\nBiscoito de canela, a árvore a brilhar\nA família reunida pra comemorar\nNasceu o Menino numa noite de luz\nO amor é o presente que veio com Jesus\n\n[Chorus]\n{nome}, {nome}, é noite de Natal\nNo trenó do Papai Noel, que coisa sem igual\nBlim, blom, o sino vai tocar\nO amor da família é o melhor lugar!\n\n[Verse]\nNo Polo Norte duende a cantar\nCartinha de criança pra gente ajudar\nUm bilhete de carinho em cada portão\nNatal de verdade é no coração\n\n[Chorus]\n{nome}, {nome}, é noite de Natal!\n\n[Outro]\nHo, ho, ho… Feliz Natal, {nome}!',
    estiloMusica: "children's christmas song, festive, sleigh bells, glockenspiel, warm piano, soft strings, cozy joyful vocals, kids choir on chorus, portuguese vocals"
  },
  {
    id: 'espaco', emoji: '🚀', ordem: 9,
    nome: 'Astronauta da Galáxia',
    titulo: '{nome}, Astronauta da Galáxia',
    descricao: 'Contagem regressiva, foguete e decolagem! [Ele|Ela] visita a Lua, os planetas e uma galáxia de estrelas, e aprende coisas incríveis sobre o espaço.',
    cores: ['#E9E6FF', '#7A5CFA', '#1B1F4B'],
    roupa: 'a white and orange astronaut suit with a round glass helmet, a small mission patch with a star, white boots and gloves',
    capa: 'floating in an astronaut suit in front of a shiny red and white rocket in deep space, Saturn with its rings, a colorful swirling galaxy, the Moon and Earth glowing, stars and a friendly little alien waving',
    paginas: [
      { texto: 'Era uma vez {nome}, que olhava as estrelas pela janela todas as noites. Até que um foguete vermelho e branco pousou no quintal! A porta abriu e um robozinho piscou as luzes: "Comandante {nome}, a galáxia precisa de você. Vamos?"',
        cena: 'standing in a backyard at night in pajamas looking amazed at a shiny red and white rocket that just landed, a cute little round robot with blinking lights waving from the open hatch, starry sky' },
      { texto: '{nome} vestiu o traje de astronauta, colocou o capacete redondo e sentou na cadeira de comandante. O robozinho Bip começou a contagem: "Dez, nove, oito, sete, seis, cinco, quatro, três, dois, um… DECOLAR!" FUUUUSH! O foguete subiu riscando o céu.', so: true },
      { texto: 'Pela janelinha, {nome} viu a Terra ficando pequenininha: azul dos oceanos, verde das florestas e branco das nuvens. "A Terra é a nossa casa", explicou Bip. "É o único planeta que a gente conhece com água, plantas e pessoas. Por isso precisamos cuidar dela."', so: true },
      { texto: 'A primeira parada foi a Lua. Lá não tem vento nem chuva, e cada passo é um pulo gigante, porque tudo fica levinho! {nome} pulou, deu cambalhota e deixou a pegada da bota no chão cinzento. De lá, a Terra parecia uma bolinha azul brilhante.',
        cena: 'jumping happily in slow motion on the gray surface of the Moon in an astronaut suit, leaving boot prints, the little robot jumping too, planet Earth glowing blue in the black starry sky, the rocket parked nearby' },
      { texto: 'O foguete seguiu viagem. Passaram por Marte, o planeta vermelho, cheio de montanhas e poeira cor de ferrugem. Depois por Júpiter, o maior de todos, com uma mancha vermelha que é uma tempestade gigante! {nome} anotava tudo no diário de bordo.', so: true },
      { texto: '"Sabia que o Sol também é uma estrela?", perguntou Bip. "Ele é tão grande que caberia mais de um milhão de Terras dentro dele!" E os planetas giram em volta do Sol, cada um no seu caminho: Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano e Netuno.', so: true },
      { texto: 'Em Saturno, {nome} fez a coisa mais divertida da viagem: escorregou pelos anéis! Eles são feitos de pedacinhos de gelo e pedra que brilham. Lá, conheceu Zuzu, um alienzinho verde de três olhos, que só queria um amigo para brincar.',
        cena: 'sliding joyfully down the sparkling icy rings of Saturn in an astronaut suit together with a cute friendly green three-eyed little alien, the robot cheering, colorful planets and stars in the background' },
      { texto: 'Zuzu levou {nome} até o lugar mais bonito do universo: uma galáxia em espiral, com bilhões de estrelas coloridas girando como um redemoinho de purpurina. "Nossa galáxia se chama Via Láctea", disse Zuzu. "E você mora nela!"',
        cena: 'floating in space holding hands with a cute green alien in front of a huge colorful spiral galaxy swirling with pink, purple and blue stars, nebula clouds, the rocket and the robot nearby' },
      { texto: 'Era hora de voltar. {nome} e Zuzu prometeram ser amigos para sempre e se olhar pelas estrelas todas as noites. O foguete pousou no quintal antes do sol nascer. E, desde então, quando {nome} olha o céu, uma estrelinha pisca de volta. Fim.',
        cena: 'waving goodbye from the backyard at dawn in an astronaut suit, helmet under the arm, as the red and white rocket and the little robot fly up to the sky, a twinkling star shaped like a smile among the fading stars' }
    ],
    letra: '[Intro]\nEra uma vez… {nome}, astronauta da galáxia!\n\n[Verse]\nDez, nove, oito, contagem a contar\nSete, seis, cinco, vou decolar\nQuatro, três, dois, um, é pra já\nO foguete sobe e vai lá, vai lá!\n\n[Chorus]\n{nome}, {nome}, astronauta estelar\nNa Lua eu pulo, em Saturno vou escorregar\nMercúrio, Vênus, Terra, Marte, que emoção\nA galáxia inteira cabe no meu coração!\n\n[Verse]\nJúpiter gigante, Marte vermelhinho\nO Sol é estrela, brilha bem quentinho\nZuzu, meu amigo de três olhinhos\nNa Via Láctea a gente é vizinho\n\n[Chorus]\n{nome}, {nome}, astronauta estelar!\n\n[Outro]\nBoa noite, estrelas… boa noite, {nome}!',
    estiloMusica: "children's space song, dreamy electronic pop, twinkling synths, countdown voice, soft beat, wonder-filled vocals, catchy chorus, portuguese vocals"
  },
  {
    id: 'abc', emoji: '🔤', ordem: 10,
    nome: 'O ABC Encantado',
    titulo: '{nome} e o ABC Encantado',
    descricao: 'Livro educativo e divertido: [ele|ela] atravessa o Bosque do ABC e conhece de A a Z, com bichinhos, frutas e brincadeiras para aprender as letras.',
    cores: ['#FFF7E0', '#FFB703', '#219EBC'],
    roupa: 'a cozy orange hoodie, blue jeans with colorful patches, a small yellow backpack and bright sneakers',
    capa: 'walking into a magical sunny forest full of giant colorful fruits, friendly animals (a bee, an elephant, a giraffe, a lion, a turtle, a zebra) and floating soap bubbles, a winding path, cheerful and educational storybook style',
    paginas: [
      { texto: 'Era uma vez {nome}, que encontrou uma mochila mágica com um bilhete: "Atravesse o Bosque do ABC e conheça todas as letras. No final, um tesouro te espera!" {nome} colocou a mochila nas costas e entrou no bosque cantarolando: A, B, C…',
        cena: 'finding a small glowing yellow backpack at the entrance of a magical sunny forest, a winding path with giant colorful fruits and flowers, a friendly bee and a little turtle waving, soap bubbles floating' },
      { texto: 'A de ABELHA, que faz zum-zum e fabrica o mel. B de BALEIA, o maior animal do mar. C de CAVALO, que galopa pelo campo. D de DADO, que rola nas brincadeiras. E de ELEFANTE, com sua tromba comprida. {nome} repetia cada letra, batendo palminhas.', so: true },
      { texto: 'F de FOCA, que bate palmas na água. G de GIRAFA, que alcança as folhas mais altas. H de HIPOPÓTAMO, que adora um banho de lama. I de IGREJA, onde a gente agradece. J de JACARÉ, que sorri com muitos dentinhos. "Já sei dez letras!", comemorou {nome}.', so: true },
      { texto: 'No meio do bosque, a Girafa Gigi e o Elefante Elias estavam brincando de esconde-esconde. "Quer brincar com a gente, {nome}?" Cada vez que alguém era achado, tinha que falar uma palavra com a sua letra. Foi a brincadeira mais divertida de todas!',
        cena: 'playing hide and seek in a sunny forest clearing with a tall friendly giraffe peeking from behind a tree and a playful baby elephant hiding behind a giant bush, laughing, colorful flowers, butterflies, a little bee buzzing' },
      { texto: 'K de KIWI, uma fruta peludinha por fora e verdinha por dentro. L de LEÃO, o rei da floresta. M de MACACO, que pula de galho em galho. N de NINHO, a casinha do passarinho. O de OVELHA, fofinha como algodão.', so: true },
      { texto: 'P de PATO, que faz quá-quá no lago. Q de QUEIJO, que o ratinho adora. R de RÃ, que pula na folha de vitória-régia. S de SAPO, primo da rã, que coaxa à noite. T de TARTARUGA, devagar e sempre. {nome} já estava quase no fim do bosque!', so: true },
      { texto: 'Na beira do lago, o Leão Leléo deu um rugido animado e a Tartaruga Tita levantou a cabecinha: "Falta pouco, {nome}! Mas para passar pela ponte, você precisa dizer o seu nome, letra por letra." {nome} falou bem alto, e a ponte se acendeu de alegria!',
        cena: 'standing proudly at a little wooden bridge over a sparkling lake as a friendly lion cheers and a little turtle smiles, a duck and a frog on a lily pad, the bridge glowing with colorful lights, sunny forest' },
      { texto: 'U de UVA, docinha e roxinha. V de VACA, que dá o leite. W de WAFFLE, quadradinho e crocante. X de XÍCARA, do chocolate quente. Y de YAKISOBA, macarrão com legumes. Z de ZEBRA, de pijama listrado! {nome} conheceu todas as 26 letras!',
        cena: 'arriving at a sunny meadow full of happy animals and fruits: a zebra, a cow, a bunch of purple grapes, a cup of hot chocolate and waffles on a picnic blanket, the friends from the forest celebrating with balloons' },
      { texto: 'No fim do bosque, a mochila se abriu e o tesouro apareceu: um livro em branco e um lápis dourado. "Agora você sabe as letras", disse o bilhete. "Com elas, pode escrever qualquer história que quiser." E a primeira palavra que {nome} escreveu foi o próprio nome. Fim.',
        cena: 'sitting on a picnic blanket opening the glowing backpack to find a blank book and a golden pencil, all the forest animal friends gathered around smiling, golden afternoon light, balloons and butterflies' }
    ],
    letra: '[Intro]\nEra uma vez… {nome} e o ABC encantado!\n\n[Verse]\nA de abelha, B de baleia\nC de cavalo correndo na areia\nD de dado, E de elefante\nF de foca, G de girafa gigante\n\n[Chorus]\n{nome}, {nome}, A, B, C\nTodas as letras eu vou aprender\nDe A a Z vamos cantar\nCom o alfabeto eu vou brincar!\n\n[Verse]\nL de leão, M de macaco\nP de pato nadando no lago\nT de tartaruga, U de uva\nZ de zebra listrada na chuva\n\n[Chorus]\n{nome}, {nome}, A, B, C\nTodas as letras eu vou aprender!\n\n[Outro]\nE a primeira palavra que eu escrevi… {nome}!',
    estiloMusica: "children's educational alphabet song, bright and bouncy, ukulele, glockenspiel, claps, cheerful kids choir, easy to memorize, portuguese vocals"
  }
];

// "Crie sua própria história": 12 páginas, 5 ilustradas (só pra contar no site; o texto a IA escreve)
const PAGINAS_PROPRIA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ([0, 2, 5, 8, 11].indexOf(i) >= 0 ? { texto: '' } : { texto: '', so: true }));
const MAX_ILUS = 5; // ilustrações novas por história (custo por livro)
const MODELOS_TEXTO = ['openai/gpt-5.4-mini', 'google/gemini-3.8-flash', 'anthropic/claude-haiku-4-5'];

function publico(t) {
  return {
    id: t.id, emoji: t.emoji, nome: t.nome, titulo: t.titulo, descricao: t.descricao, cores: t.cores, ordem: t.ordem || 99,
    vitrine: t.vitrineEm ? '/.netlify/functions/livro-img?k=' + encodeURIComponent('img/tema/' + t.id) + '&v=' + t.vitrineEm : null,
    vitrineGenero: t.vitrineGenero || 'menino',
    paginas: (t.paginas || []).map((p) => (p.so ? { texto: p.texto, so: true } : { texto: p.texto }))
  };
}
function limparTema(t) {
  const id = String(t.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  if (!id) return null;
  const brutas = (Array.isArray(t.paginas) ? t.paginas : []).slice(0, 16).map((p) => ({
    texto: String((p && p.texto) || '').slice(0, 900), cena: String((p && p.cena) || '').slice(0, 900), usa: usaDe(p), so: !!(p && p.so)
  }));
  // tira páginas vazias, mas mantém as referências de "repete a ilustração da cena N" certas
  const novoIndice = []; const paginas = [];
  brutas.forEach((p, i) => { if (p.texto && (p.cena || p.usa != null || p.so)) { novoIndice[i] = paginas.length; paginas.push(p); } });
  paginas.forEach((p) => {
    if (p.so) { delete p.usa; p.cena = ''; return; }
    delete p.so;
    if (p.usa == null) { delete p.usa; return; }
    const alvo = novoIndice[p.usa];
    if (alvo == null || alvo === paginas.indexOf(p) || paginas[alvo].usa != null || paginas[alvo].so) { delete p.usa; if (!p.cena) p.cena = paginas[0] ? paginas[0].cena : ''; } else p.usa = alvo;
  });
  if (paginas.length < 3) return null;
  return {
    id, emoji: String(t.emoji || '📖').slice(0, 4), status: t.status === 'publicado' ? 'publicado' : 'rascunho',
    ordem: Number(t.ordem) || 99, nome: String(t.nome || '').slice(0, 60), titulo: String(t.titulo || '').slice(0, 80),
    descricao: String(t.descricao || '').slice(0, 300),
    cores: Array.isArray(t.cores) && t.cores.length === 3 ? t.cores.map((c) => String(c).slice(0, 9)) : ['#FFE8F0', '#E86A9E', '#6B4BC4'],
    roupa: String(t.roupa || '').slice(0, 300), capa: String(t.capa || '').slice(0, 900), paginas,
    letra: String(t.letra || '').slice(0, 2500), estiloMusica: String(t.estiloMusica || "children's song, cheerful, catchy chorus, portuguese vocals").slice(0, 300),
    vitrineEm: t.vitrineEm || null, vitrineGenero: t.vitrineGenero === 'menina' ? 'menina' : 'menino',
    vendasFora: Math.max(0, Math.min(1000000, parseInt(t.vendasFora, 10) || 0))
  };
}

async function rascunhoIA(ideia) {
  const sistema = 'Você escreve livros infantis personalizados em português do Brasil, encantadores, com muitos detalhes visuais. ' +
    'Responda SOMENTE com um JSON válido, sem comentários.';
  const pedido = 'Crie uma história nova para o "Livro Mágico" a partir desta ideia: "' + String(ideia).slice(0, 600) + '".\n' +
    'Regras: a criança protagonista se chama {nome}. Use [o|a] para palavras que mudam entre menino e menina (ex.: pequen[o|a], [ele|ela], [dele|dela]). ' +
    'Exatamente 5 cenas. Cada "texto" tem de 40 a 60 palavras, linguagem de livro infantil, com começo, meio e fim e uma lição bonita no final. ' +
    'Cada "cena" é uma descrição em INGLÊS do que aparece na ilustração, começando com um verbo de ação (ex.: "riding a pony through..."), cheia de detalhes de cenário, bichinhos e cores. ' +
    '"capa" é a cena da capa em inglês. "roupa" é a roupa da criança em inglês (sempre a mesma). "letra" é a letra de uma música infantil curta em português com [Intro] "Era uma vez… {nome} ..." , [Verse], [Chorus] repetindo {nome}, e [Outro]. ' +
    'Formato: {"id":"slug-curto","emoji":"🎈","nome":"Nome do tema","titulo":"{nome} e ...","descricao":"1 frase de venda","cores":["#hex claro","#hex médio","#hex escuro"],"roupa":"...","capa":"...","paginas":[{"texto":"...","cena":"..."}],"letra":"...","estiloMusica":"children\'s song, ..., portuguese vocals"}';
  for (const m of MODELOS_TEXTO) {
    try {
      const r = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + chaveApi(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, max_tokens: 3500, temperature: 0.8, messages: [{ role: 'system', content: sistema }, { role: 'user', content: pedido }] })
      });
      const d = await r.json().catch(() => null);
      const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!txt) continue;
      const ini = txt.indexOf('{'), fim = txt.lastIndexOf('}');
      const obj = JSON.parse(txt.slice(ini, fim + 1));
      obj.status = 'rascunho';
      const t = limparTema(obj);
      if (t) return t;
    } catch (e) { console.error('rascunho IA', m, e && e.message); }
  }
  return null;
}

export default async (req) => {
  try {
    const u = new URL(req.url);
    const senha = (process.env.ADMIN_SENHA || '').trim();
    const admin = !!senha && (req.headers.get('x-admin-key') || '') === senha;

    if (req.method === 'GET') {
      const temas = await lerTemas();
      if (u.searchParams.get('admin') === '1') {
        if (!admin) return json({ erro: 'Senha incorreta.' }, 401);
        return json({ temas, propria: await lerPropria(), exemplos: (await lerExemplos()).map(exPublico), vendasSite: await lerVendas() });
      }
      // mais vendidos primeiro (vendas do site + vendas de fora que você colocou no painel); empate: ordem do painel
      const vendas = await lerVendas();
      const total = (t) => (vendas[t.id] || 0) + (t.vendasFora || 0);
      // "Crie sua própria história" entra na lista como mais uma opção (ordenada pelas vendas, igual às outras)
      const prop = await lerPropria();
      const lista = temas.filter((t) => t.status === 'publicado');
      if (prop.status === 'publicado') lista.push(prop);
      const pubs = lista
        .sort((a, b) => (total(b) - total(a)) || ((a.ordem || 99) - (b.ordem || 99)))
        .map((t) => Object.assign(publico(t), { vendidos: total(t) }, t.propria ? { propria: true, paginas: PAGINAS_PROPRIA } : {}));
      const exemplos = (await lerExemplos()).filter((x) => x.mostrar !== false).map(exPublico);
      return new Response(JSON.stringify({ temas: pubs, exemplos }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
    if (!admin) return json({ erro: 'Senha incorreta.' }, 401);
    let b = {}; try { b = await req.json(); } catch (e) {}

    if (b.acao === 'salvar') {
      // avisa direitinho o que falta, em vez de sumir com a história
      for (const t of (Array.isArray(b.temas) ? b.temas : [])) {
        const nm = '"' + String(t.nome || t.id || 'sem nome') + '"';
        const pags = Array.isArray(t.paginas) ? t.paginas : [];
        for (let i = 0; i < pags.length; i++) {
          const tx = String((pags[i] && pags[i].texto) || '').trim(), ce = String((pags[i] && pags[i].cena) || '').trim();
          const repete = usaDe(pags[i]) != null || !!(pags[i] && pags[i].so);
          if (tx && !ce && !repete) return json({ erro: 'Na história ' + nm + ', a página ' + (i + 1) + ' está sem o campo "O que aparece na ilustração". Preencha (pode ser em português) ou escolha repetir a ilustração de outra página.' }, 400);
          if (!tx && (ce || repete)) return json({ erro: 'Na história ' + nm + ', a página ' + (i + 1) + ' está sem o texto.' }, 400);
        }
        const novas = pags.filter((p) => p && String(p.texto || '').trim() && String(p.cena || '').trim() && usaDe(p) == null && !p.so).length;
        if (novas < 3) return json({ erro: 'A história ' + nm + ' precisa de pelo menos 3 páginas com ilustração nova.' }, 400);
        if (novas > MAX_ILUS) return json({ erro: 'A história ' + nm + ' tem ' + novas + ' ilustrações novas. O máximo é ' + MAX_ILUS + ' (as outras páginas podem ser só de texto).' }, 400);
        if (!String(t.titulo || '').trim()) return json({ erro: 'A história ' + nm + ' está sem o título da capa.' }, 400);
      }
      const lista = (Array.isArray(b.temas) ? b.temas : []).map(limparTema).filter(Boolean);
      if (!lista.length) return json({ erro: 'Nenhuma história válida (cada uma precisa de pelo menos 3 cenas com texto e ilustração).' }, 400);
      const ids = {}; for (const t of lista) { if (ids[t.id]) return json({ erro: 'Duas histórias com o mesmo id: ' + t.id }, 400); ids[t.id] = 1; }
      await loja().setJSON('temas', lista);
      return json({ ok: true, temas: lista });
    }
    if (b.acao === 'propria-salvar') {
      const n = await salvarPropria(b.propria || {});
      return json({ ok: true, propria: n });
    }
    if (b.acao === 'livro-liberar') {
      // você libera um livro seu sem pagar (pra testar ou pra usar de exemplo). Não conta como venda.
      const id = String(b.id || '').trim();
      if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Código do livro inválido.' }, 400);
      const pres = getStore('presentes'), g = await pres.get(id, { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      if (!g.pago) { g.pago = true; g.cortesia = true; g.pagoEm = Date.now(); g.pagamento = Object.assign({}, g.pagamento, { valor: 0, provedor: 'admin' }); }
      if (b.exemplo) g.livro.autoExemplo = true;
      await pres.setJSON(id, g);
      // o agendador continua fazendo as imagens mesmo com a tela fechada
      await getStore('whatsapp').setJSON('lvadm_' + id, { id, em: Date.now() }).catch(() => {});
      try { await avancarLivro(id, process.env.URL || new URL(req.url).origin); } catch (e) {}
      return json({ ok: true });
    }
    if (b.acao === 'relatorio') {
      // RELATÓRIO SÓ DO LIVRO: prévias, quem pagou, entregues, com problema e quanto tempo levou
      const dias = Math.max(1, Math.min(90, parseInt(b.dias, 10) || 30));
      const idx = await lerDias().catch(() => null);
      const soLivro = (l) => (l || []).filter((x) => /^L[0-9a-f]{14}$/.test(x));
      const [criados, pagosIdx] = await Promise.all([idsDosDiasTudo(idx, dias, 'p').then(soLivro), idsDosDiasTudo(idx, dias, 'pg').then(soLivro)]);
      const ids = [...new Set(criados.concat(pagosIdx))].slice(-1500);
      const pres = getStore('presentes'), zl = getStore('whatsapp');
      const gs = (await Promise.all(ids.map((id) => pres.get(id, { type: 'json' }).catch(() => null)))).filter((g) => g && g.livro && !g.cancelado);
      const pagos = gs.filter((g) => g.pago);
      const ent = await Promise.all(pagos.map((g) => zl.get('lvent_' + g.id, { type: 'json' }).catch(() => null)));
      const temas = await lerTemas(), nomeTema = (id) => { if (id === 'propria') return '✨ História própria'; const t = temas.find((x) => x.id === id); return t ? (t.emoji || '📖') + ' ' + t.nome : id; };
      const prov = (g) => (g.pagamento && g.pagamento.provedor) || '';
      const livros = pagos.map((g, i) => {
        const L = g.livro, ps = (L.paginas || []).filter((p) => p && !p.so && p.usa == null);
        const erros = [L.capa].concat(ps).filter((p) => p && !p.ok && p.msg).map((p) => p.msg);
        return {
          id: g.id, nome: L.nome, tema: nomeTema(L.tema), whatsapp: g.whatsapp || '',
          tipo: g.pacoteDe ? 'pacote' : prov(g) === 'admin' ? 'teste' : 'venda',
          pacote: g.pacote ? g.pacote.tipo : null, valor: g.pacoteDe || prov(g) === 'admin' ? 0 : ((g.pagamento && g.pagamento.valor) || 0),
          criadoEm: g.criadoEm || null, previaEm: L.previaEm || null, pagoEm: g.pagoEm || null, prontoEm: L.prontoEm || null,
          entregueEm: (ent[i] && ent[i].em) || null, status: L.status || '', ilus: ps.filter((p) => p.ok).length, ilusTotal: ps.length,
          capaOk: !!(L.capa && L.capa.ok), motivo: L.status === 'pronto' ? '' : (erros[erros.length - 1] || '')
        };
      }).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0));
      const porDia = {};
      for (let i = 0; i < Math.min(dias, 14); i++) porDia[diaBR(Date.now() - i * 86400000)] = { previas: 0, pagos: 0 };
      gs.forEach((g) => { const d = g.criadoEm ? diaBR(g.criadoEm) : ''; if (porDia[d] && !g.pacoteDe && prov(g) !== 'admin') porDia[d].previas++; });
      livros.forEach((l) => { const d = l.pagoEm ? diaBR(l.pagoEm) : ''; if (porDia[d] && l.tipo === 'venda') porDia[d].pagos++; });
      const tPrev = gs.filter((g) => g.livro.previaEm && g.criadoEm && !g.pacoteDe).map((g) => g.livro.previaEm - g.criadoEm);
      return json({ ok: true, dias, previas: gs.filter((g) => !g.pacoteDe && prov(g) !== 'admin').length, livros, porDia, temposPrevia: tPrev });
    }
    if (b.acao === 'livro-diag') {
      const g = await getStore('presentes').get(String(b.id || ''), { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      const dg = diagLivro(g); dg.motor = await motorRodando(g.id).catch(() => false); dg.pago = !!g.pago; dg.nome = g.livro.nome; dg.token = g.livro.token;
      dg.temFoto = !!(await loja().get('foto/' + g.id, { type: 'arrayBuffer' }).catch(() => null));
      return json({ ok: true, diag: dg });
    }
    if (b.acao === 'pdf-links') {
      // PDFs em alta de um livro (ex.: exemplo da vitrine) pra você baixar e usar nos anúncios
      const g = await getStore('presentes').get(String(b.id || ''), { type: 'json' }).catch(() => null);
      if (!g || !g.livro) return json({ erro: 'Livro não encontrado.' }, 404);
      if (!g.pago) return json({ erro: 'Esse livro ainda não foi liberado.' }, 400);
      const mus = (v) => (process.env.URL || new URL(req.url).origin) + '/.netlify/functions/baixar-musica?id=' + g.id + '&v=' + v;
      if (g.livro.pdf && !b.refazer) return json({ ok: true, links: { ler: linkPdf(g, 'ler'), folhas: linkPdf(g, 'folhas'), livreto: linkPdf(g, 'livreto'), musica1: g.musicaPreviewUrl ? mus(1) : null, musica2: g.musicaPreviewUrl2 ? mus(2) : null } });
      const base = process.env.URL || new URL(req.url).origin;
      await fetch(base + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, refazer: !!b.refazer }) }).catch(() => {});
      return json({ ok: true, gerando: true });
    }
    if (b.acao === 'livro-refazer') {
      const id = String(b.id || '').trim();
      if (!/^L[0-9a-f]{14}$/.test(id)) return json({ erro: 'Código do livro inválido.' }, 400);
      const r = await refazerImagens(id);
      if (r.erro) return json({ erro: r.erro }, 400);
      try { await avancarLivro(id, process.env.URL || new URL(req.url).origin); } catch (e) {}
      return json({ ok: true });
    }
    if (b.acao === 'exemplo-add') {
      const r = await adicionarExemplo(String(b.id || '').trim());
      if (r.erro) return json({ erro: r.erro }, 400);
      return json({ ok: true, exemplos: r.lista.map(exPublico) });
    }
    if (b.acao === 'exemplo-foto') {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(b.foto || ''));
      if (!m) return json({ erro: 'Mande uma foto JPG ou PNG.' }, 400);
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length < 3000 || buf.length > 4500000) return json({ erro: 'Foto muito pequena ou muito grande.' }, 400);
      const id = 'F' + crypto.randomBytes(5).toString('hex');
      await loja().set('ex/' + id + '/capa', buf, { metadata: { tipo: m[1] } });
      const lista = await lerExemplos(); lista.unshift({ id, tipo: 'foto', legenda: String(b.legenda || '').slice(0, 80), em: Date.now(), mostrar: true });
      await loja().setJSON('exemplos', lista);
      return json({ ok: true, exemplos: lista.map(exPublico) });
    }
    if (b.acao === 'exemplos-salvar') {
      const atual = await lerExemplos(), porId = {}; atual.forEach((x) => { porId[x.id] = x; });
      const nova = [];
      (Array.isArray(b.exemplos) ? b.exemplos : []).forEach((e) => { const x = porId[e && e.id]; if (x && nova.indexOf(x) === -1) { x.mostrar = e.mostrar !== false; x.zap = !!e.zap && x.tipo === 'livro'; nova.push(x); } });
      // no máximo 2 vão junto com a prévia no WhatsApp
      let nz = 0; nova.forEach((x) => { if (x.zap && ++nz > 2) x.zap = false; });
      // os marcados pro WhatsApp vão como PDF: já deixa o PDF pronto
      const baseP = process.env.URL || new URL(req.url).origin;
      for (const x of nova) {
        if (!x.zap || !x.pedido) continue;
        const ge = await getStore('presentes').get(x.pedido, { type: 'json' }).catch(() => null);
        if (ge && ge.pago && ge.livro && !ge.livro.pdf) await fetch(baseP + '/.netlify/functions/livro-pdf-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.pedido }) }).catch(() => {});
      }
      // os que saíram da lista: apaga as imagens
      for (const x of atual) {
        if (nova.indexOf(x) !== -1) continue;
        const nomes = ['capa'].concat(Array.from({ length: x.n || 0 }, (_, i) => 'p' + (i + 1)));
        for (const n of nomes) await loja().delete('ex/' + x.id + '/' + n).catch(() => {});
      }
      await loja().setJSON('exemplos', nova);
      return json({ ok: true, exemplos: nova.map(exPublico) });
    }
    if (b.acao === 'importar20') {
      // as 20 histórias novas (bíblicas e educativas), completas: entram como RASCUNHO.
      // Se já existir com o mesmo id, atualiza o texto e mantém publicada/capa de vitrine/vendas.
      const atuais = await lerTemas();
      const porId = {}; atuais.forEach((t) => { porId[t.id] = t; });
      let novas = 0, atualizadas = 0;
      for (const n of HISTORIAS_20) {
        const v = porId[n.id];
        const t = limparTema(Object.assign({}, n, v ? { status: v.status, vitrineEm: v.vitrineEm, vitrineGenero: v.vitrineGenero, vendasFora: v.vendasFora, ordem: v.ordem } : { status: 'rascunho' }));
        if (!t) continue;
        if (v) { atuais[atuais.indexOf(v)] = t; atualizadas++; } else { atuais.push(t); novas++; }
      }
      await loja().setJSON('temas', atuais);
      return json({ ok: true, temas: atuais, novas, atualizadas });
    }
    if (b.acao === 'importar') {
      // adiciona as histórias novas SEM apagar as suas. Se já existir uma com o mesmo id, atualiza o conteúdo
      // e mantém se estava publicada e a capa de vitrine. As novas entram como rascunho (você revisa e publica).
      const atuais = await lerTemas();
      const porId = {}; atuais.forEach((t) => { porId[t.id] = t; });
      let novas = 0, atualizadas = 0;
      for (const n of NOVAS_HISTORIAS) {
        const v = porId[n.id];
        const t = limparTema(Object.assign({}, n, v ? { status: v.status, vitrineEm: v.vitrineEm, vitrineGenero: v.vitrineGenero, vendasFora: v.vendasFora } : { status: 'rascunho' }));
        if (!t) continue;
        if (v) { atuais[atuais.indexOf(v)] = t; atualizadas++; } else { atuais.push(t); novas++; }
      }
      await loja().setJSON('temas', atuais);
      return json({ ok: true, temas: atuais, novas, atualizadas });
    }
    if (b.acao === 'restaurar') {
      await loja().setJSON('temas', TEMAS_PADRAO);
      return json({ ok: true, temas: TEMAS_PADRAO });
    }
    if (b.acao === 'codigo') {
      // código de uso único pra liberar mais uma prévia (o suporte manda pro cliente)
      const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let cod = 'LIVRO-'; for (let i = 0; i < 5; i++) cod += letras[Math.floor(Math.random() * letras.length)];
      await loja().setJSON('codigo/' + cod, { usado: false, em: Date.now() });
      return json({ ok: true, codigo: cod });
    }
    if (b.acao === 'rascunho') {
      if (String(b.ideia || '').trim().length < 5) return json({ erro: 'Descreva a ideia da história.' }, 400);
      const t = await rascunhoIA(b.ideia);
      if (!t) return json({ erro: 'A IA não conseguiu escrever agora. Tente de novo.' }, 502);
      return json({ ok: true, tema: t });
    }
    if ((b.acao === 'vitrine' || b.acao === 'vitrine-status') && b.id === 'propria') {
      const t = await lerPropria(), chaveTask = 'vit/propria';
      if (b.acao === 'vitrine') {
        const genero = b.genero === 'menino' ? 'menino' : 'menina';
        const task = await criarImagem(promptImagem(t, { idade: 4, genero }, t.capa, true, true), [], '3:4', '2K');
        await loja().setJSON(chaveTask, { task, genero, em: Date.now() });
        return json({ ok: true, rodando: true });
      }
      const info = await loja().get(chaveTask, { type: 'json' }).catch(() => null);
      if (!info || !info.task) return json({ ok: true, pronto: !!t.vitrineEm, propria: t });
      const st = await verTarefa(info.task, 'imagem');
      if (st.estado === 'falhou') { await loja().delete(chaveTask); return json({ erro: 'A geração da capa falhou. Tente de novo.' }, 502); }
      if (st.estado !== 'pronto') return json({ ok: true, rodando: true });
      await guardarImagem(st.urls[0], 'img/tema/propria');
      const n = await salvarPropria({ vitrineEm: Date.now(), vitrineGenero: info.genero });
      await loja().delete(chaveTask);
      return json({ ok: true, pronto: true, propria: n });
    }
    if (b.acao === 'vitrine' || b.acao === 'vitrine-status') {
      const temas = await lerTemas();
      const t = temas.find((x) => x.id === b.id);
      if (!t) return json({ erro: 'História não encontrada.' }, 404);
      const chaveTask = 'vit/' + t.id;
      if (b.acao === 'vitrine') {
        const genero = b.genero === 'menina' ? 'menina' : 'menino';
        const prompt = promptImagem(t, { idade: 4, genero }, t.capa, true, true);
        const task = await criarImagem(prompt, [], '3:4', '2K');
        await loja().setJSON(chaveTask, { task, genero, em: Date.now() });
        return json({ ok: true, rodando: true });
      }
      const info = await loja().get(chaveTask, { type: 'json' }).catch(() => null);
      if (!info || !info.task) return json({ ok: true, pronto: !!t.vitrineEm });
      const st = await verTarefa(info.task, 'imagem');
      if (st.estado === 'falhou') { await loja().delete(chaveTask); return json({ erro: 'A geração da capa falhou. Tente de novo.' }, 502); }
      if (st.estado !== 'pronto') return json({ ok: true, rodando: true });
      await guardarImagem(st.urls[0], 'img/tema/' + t.id);
      t.vitrineEm = Date.now(); t.vitrineGenero = info.genero;
      await loja().setJSON('temas', temas);
      await loja().delete(chaveTask);
      return json({ ok: true, pronto: true, tema: t });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error('livro-temas:', e && e.stack || e);
    return json({ erro: 'Erro inesperado.' }, 500);
  }
};
