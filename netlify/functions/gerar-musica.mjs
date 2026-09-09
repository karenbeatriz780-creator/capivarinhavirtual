import { getStore } from '@netlify/blobs';

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

// Relação e ocasião viram tag de estilo — orientam o clima da música
// sem virar texto cantado.
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
    const gen = GENEROS[estilo] || GENEROS.romantica;
    const tagsPartes = [gen, 'sung in portuguese', 'brazilian'];
    if (CLIMAS[clima]) tagsPartes.push(CLIMAS[clima]);
    if (RELACOES_TAG[relacao]) tagsPartes.push(RELACOES_TAG[relacao]);
    if (OCASIOES_TAG[ocasiao]) tagsPartes.push(OCASIOES_TAG[ocasiao]);
    if (VOZES[voz]) tagsPartes.push(VOZES[voz]);
    tagsPartes.push(gen.split(',')[0]); // reforço final do gênero
    const tagsEstilo = tagsPartes.join(', ');

    // PROMPT = no modo custom, isto vira a LETRA cantada. Então só entra
    // conteúdo de verdade (a história, nomes, frase) — nunca instrução,
    // senão a Suno canta a instrução ao pé da letra.
    // As marcações [Verse]/[Chorus] são estruturais e não são cantadas.
    var linhas = [];
    linhas.push('[Portuguese lyrics]');
    linhas.push('');
    linhas.push('[Verse 1]');
    linhas.push(texto);
    if (nomesLetra) {
      linhas.push('');
      linhas.push('[Chorus]');
      linhas.push(nomesLetra);
    }
    if (frase) {
      linhas.push('');
      linhas.push('[Bridge]');
      linhas.push(frase);
    }
    const prompt = linhas.join('\n').slice(0, 2900);

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
