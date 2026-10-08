function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Mesmas descrições usadas em gerar-musica.mjs — aqui servem só de CONTEXTO
// pro modelo de texto entender o estilo. Quem decide o SOM é a Suno, não
// esta função: esta função só escreve a letra que a pessoa vai aprovar.
const GENERO_PT = {
  romantica:'balada romântica pop', sertanejo:'sertanejo universitário moderno',
  pop:'pop moderno', rock:'rock', mpb:'MPB', bossa:'bossa nova', gospel:'gospel de adoração',
  samba:'samba', pagode:'pagode', forro:'forró pé de serra', piseiro:'piseiro',
  funk:'funk carioca', trap:'trap', eletronica:'música eletrônica', reggae:'reggae',
  jazz:'jazz', blues:'blues', axe:'axé baiano', lofi:'lo-fi', infantil:'música infantil'
};
const CLIMA_PT = {
  alegre:'alegre e contagiante', emocionante:'emocionante, de arrepiar',
  romantica:'romântico e apaixonado', calma:'calmo e suave',
  nostalgica:'nostálgico, de saudade', festiva:'festivo, de celebração',
  energetica:'energético e vibrante', divertida:'divertido e bem-humorado',
  inspiradora:'inspirador, de superação', melancolica:'melancólico'
};
const NICHO_TEXTO = {
  namorada:'é para a namorada da pessoa — tom de romance', namorado:'é para o namorado da pessoa — tom de romance',
  esposa:'é para a esposa — amor maduro e de parceria de vida', marido:'é para o marido — amor maduro e de parceria de vida',
  mae:'é de um filho/filha para a mãe — gratidão e amor filial', pai:'é de um filho/filha para o pai — gratidão e amor filial',
  irma:'é entre irmãos — carinho e cumplicidade de família', irmao:'é entre irmãos — carinho e cumplicidade de família',
  amiga:'é para a melhor amiga — amizade', amigo:'é para o melhor amigo — amizade',
  filho:'é de um pai/mãe para o filho(a) — amor incondicional de pai/mãe'
};
const NICHO_EVITAR = {
  mae:'A letra é de filho para mãe: NUNCA use linguagem romântica ou de casal.',
  pai:'A letra é de filho para pai: NUNCA use linguagem romântica ou de casal.',
  irma:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  irmao:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  amiga:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  amigo:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  filho:'A letra é de pai/mãe para filho: NUNCA use linguagem romântica.'
};
const VOZ_PT = {
  masculina:'a música será cantada por uma voz masculina — se precisar de concordância de gênero no texto, use a masculina',
  feminina:'a música será cantada por uma voz feminina — se precisar de concordância de gênero no texto, use a feminina',
  dueto:'a música será um dueto, cantada em dupla — pode alternar vozes entre os versos'
};

const SYSTEM_PROMPT =
  'Você é um letrista brasileiro profissional, especializado em compor letras de música ' +
  'personalizadas e emocionantes para presentes (encomendas de clientes reais, não é ficção). ' +
  'Você escreve APENAS letras 100% originais, nunca reproduz nem parafraseia trechos de músicas ' +
  'já existentes de outros artistas. Sua resposta deve conter SOMENTE a letra final, pronta — ' +
  'sem explicações, sem comentários, sem aspas, sem markdown, sem títulos. Comece direto com a ' +
  'primeira marcação de estrutura.';

// Modo de AJUSTE PONTUAL: a pessoa já aprovou (ou quase aprovou) uma letra e
// quer mudar só um detalhe ("deixa o refrão mais alegre", "troca a palavra X
// no segundo verso"...). Diferente do modo normal (que escreve do zero), aqui
// o que entra é a letra JÁ EXISTENTE + o pedido — e a letra inteira deve
// voltar igual, exceto pela mudança pedida. Isso evita que a pessoa perca
// partes da letra que já estava gostando só por pedir um ajuste pequeno.
const AJUSTE_SYSTEM_PROMPT =
  'Você é um letrista brasileiro profissional revisando a letra de uma música personalizada que ' +
  'já foi escrita para um cliente (encomenda real, não é ficção). A pessoa vai te dizer EXATAMENTE ' +
  'o que quer mudar. Sua tarefa é aplicar SOMENTE essa mudança pontual, preservando o restante da ' +
  'letra o mais fiel possível ao original: mesma estrutura e mesmas marcações (como [Verso 1], ' +
  '[Refrão], [Ponte] etc.), mesmos versos que não têm relação com o pedido, mesmos nomes e frases ' +
  'que a pessoa não mencionou. Não reescreva nem "melhore" partes que não foram pedidas. Sua ' +
  'resposta deve conter SOMENTE a letra completa e final, já com o ajuste aplicado, do início ao ' +
  'fim — sem explicações, sem comentários, sem aspas, sem markdown.';

function montarPrompt(p) {
  var genDesc = GENERO_PT[p.estilo] || GENERO_PT.romantica;
  var climaDesc = CLIMA_PT[p.clima] || '';
  var relacaoDesc = NICHO_TEXTO[p.relacao] || 'é uma homenagem pessoal';
  var restricao = NICHO_EVITAR[p.relacao] || '';
  var vozDesc = VOZ_PT[p.voz] || '';

  var partes = [];
  partes.push('Escreva a letra de uma música em português do Brasil, sobre uma história real, com estas características:');
  partes.push('GÊNERO: ' + genDesc + '.');
  if (climaDesc) partes.push('CLIMA: ' + climaDesc + '.');
  partes.push('PARA QUEM: ' + relacaoDesc + '.');
  if (restricao) partes.push('RESTRIÇÃO IMPORTANTE: ' + restricao);
  if (p.ocasiao) partes.push('OCASIÃO: ' + p.ocasiao + '.');
  if (vozDesc) partes.push('VOZ: ' + vozDesc + '.');
  partes.push('');
  partes.push('HISTÓRIA REAL contada por quem está encomendando a música — use estes detalhes ' +
    'verdadeiros (nomes, lugares, datas, cenas específicas) porque são o que torna a letra ' +
    'pessoal e única. Não ignore nem resuma demais; aproveite o máximo de detalhes concretos ' +
    'que couberem naturalmente na letra:');
  partes.push('"""');
  partes.push(p.texto);
  partes.push('"""');
  if (p.frase) {
    partes.push('');
    partes.push('Inclua esta frase EXATAMENTE como está escrita, palavra por palavra, em algum ' +
      'verso ou no refrão (não mude nenhuma palavra dela): "' + p.frase + '"');
  }
  if (p.nomesLetra) {
    partes.push('');
    partes.push('Cite estes nomes na letra, naturalmente: ' + p.nomesLetra);
  }
  partes.push('');
  partes.push('ESTRUTURA: use estas marcações, cada uma em sua própria linha, exatamente com ' +
    'esta grafia — [Verso 1], [Refrão], [Verso 2], [Refrão], [Ponte], [Refrão Final] (a [Ponte] ' +
    'é opcional, pode remover se a música ficar melhor sem ela). Depois de cada marcação, escreva ' +
    'as linhas de letra correspondentes.');
  partes.push('TAMANHO: a letra completa (sem contar as marcações de estrutura) deve ter entre ' +
    '500 e 1400 caracteres — nem curta demais, nem longa demais.');
  partes.push('');
  partes.push('Responda SOMENTE com a letra formatada — nada antes, nada depois.');
  return partes.join('\n');
}

function montarPromptAjuste(letraAtual, instrucao) {
  var partes = [];
  partes.push('Aqui está a letra atual de uma música personalizada, já com as marcações de estrutura:');
  partes.push('"""');
  partes.push(letraAtual);
  partes.push('"""');
  partes.push('');
  partes.push('PEDIDO DE AJUSTE da pessoa, nas palavras dela: "' + instrucao + '"');
  partes.push('');
  partes.push('Aplique SOMENTE esse ajuste. Mantenha todo o resto da letra igual — mesmas ' +
    'marcações de estrutura, mesmos versos que não têm relação com o pedido, mesmo tamanho ' +
    'aproximado. Responda com a letra completa, já ajustada, do início ao fim — nada antes, ' +
    'nada depois.');
  return partes.join('\n');
}

function limparResposta(txt) {
  var t = String(txt || '').trim();
  // tira cerca de código, se o modelo colocar uma por engano
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  return t.slice(0, 3000);
}

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
    const letraAtual = String((body && body.letraAtual) || '').trim();
    const instrucao = String((body && body.instrucao) || '').trim();

    // Ajuste pontual: já existe uma letra, e a pessoa só quer mudar um
    // detalhe dela — não precisa (nem deve) repetir estilo/história/etc.
    const modoAjuste = letraAtual.length > 0 && instrucao.length > 0;

    if (modoAjuste) {
      if (letraAtual.length < 20) return json({ erro: 'Letra atual inválida.' }, 400);
      if (instrucao.length < 3) return json({ erro: 'Descreve o que você quer ajustar na letra.' }, 400);
    } else {
      if (!estilo) return json({ erro: 'Escolhe um estilo primeiro.' }, 400);
      if (texto.length < 50) return json({ erro: 'Conta um pouco mais da história (pelo menos 50 caracteres).' }, 400);
    }

    const apiKey = (process.env.UNIFICALLY_API_KEY || '').trim();
    if (!apiKey) {
      return json({ erro: 'A geração de letra ainda está sendo configurada. Volta em breve!' }, 503);
    }

    // texto da história limitado por segurança (custo/tokens) — 2000 caracteres
    // já é bem mais espaço do que a Suno aceitava no modo antigo (500).
    const prompt = modoAjuste
      ? montarPromptAjuste(letraAtual.slice(0, 3000), instrucao.slice(0, 500))
      : montarPrompt({
          estilo, clima, relacao, ocasiao, nomesLetra, frase, voz,
          texto: texto.slice(0, 2000)
        });
    const systemPrompt = modoAjuste ? AJUSTE_SYSTEM_PROMPT : SYSTEM_PROMPT;

    console.log('PEDIDO DE LETRA >> modo=' + (modoAjuste ? 'ajuste pontual' : 'geração') +
      (modoAjuste ? ' | pedido=' + instrucao.slice(0, 80) : ' | genero=' + estilo + ' | clima=' + clima + ' | relacao=' + relacao + ' | ocasiao=' + ocasiao));

    let resp;
    try {
      resp = await fetch('https://api.unifically.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-5.4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          // Ajuste pontual pede mais fidelidade ao texto original (menos
          // "criatividade" solta) do que escrever uma letra nova do zero.
          temperature: modoAjuste ? 0.55 : 0.9,
          max_tokens: 900
        })
      });
    } catch (e) {
      console.error('Unifically chat (rede):', e && e.stack || e);
      return json({ erro: 'Não consegui falar com o servidor de letras agora.' }, 502);
    }

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      console.error('Unifically chat completions:', resp.status, JSON.stringify(data));
      return json({ erro: 'Não consegui escrever a letra agora. Tenta de novo em instantes.' }, 502);
    }

    const conteudo = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!conteudo || !conteudo.trim()) {
      console.error('Unifically chat sem conteúdo:', JSON.stringify(data));
      return json({ erro: 'O serviço de letra não respondeu com um texto. Tenta de novo.' }, 502);
    }

    const letra = limparResposta(conteudo);
    console.log('LETRA GERADA >> ' + letra.slice(0, 120) + (letra.length > 120 ? '...' : ''));

    return json({ ok: true, letra: letra });

  } catch (e) {
    console.error('gerar-letra (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
