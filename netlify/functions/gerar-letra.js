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
  jazz:'jazz', blues:'blues', axe:'axé baiano', lofi:'lo-fi', infantil:'música infantil',
  anos80:'pop/rock dos anos 80, retrô', eletrofunk:'eletrofunk', bregafunk:'brega funk',
  funkcria:'funk de cria (funk de favela, ritmo de baile, gírias de quebrada)',
  jingle:'jingle comercial chiclete (refrão curto, grudento e repetitivo, fácil de decorar)',
  sertanejoraiz:'sertanejo raiz / modão de viola (linguagem simples do interior, saudade, roça)',
  funkantigo:'funk carioca antigo dos anos 2000 (funk melody / tamborzão, refrão simples e dançante)',
  gospeltrad:'gospel tradicional, estilo hino de igreja evangélica (Assembleia de Deus / Harpa Cristã): linguagem bíblica, louvor e fé',
  catolica:'música católica (canto de igreja, louvor a Deus e a Nossa Senhora, linguagem de fé católica)',
  arrocha:'arrocha (sofrência romântica dançante, estilo baiano)',
  tecnobrega:'tecnobrega paraense (aparelhagem, batida acelerada, refrão animado)',
  anos60:'estilo anos 60 (rock clássico e twist, ritmo retrô)',
  anos70:'estilo anos 70 (disco e soul, groove dançante retrô)',
  melody:'melody paraense (tecnomelody romântico, refrão apaixonado)',
  bregamarcante:'brega marcante paraense (romântico e dançante)',
  batidao:'batidão de paredão (grave pesado, dançante, refrão chiclete)',
  seresta:'seresta / sofrência (romântico de bar, dor de amor)',
  bregaromantico:'brega romântico das antigas (anos 80/90, bem apaixonado)',
  carimbo:'carimbó paraense (alegre, regional)',
  lambada:'lambada (dançante e alegre)',
  forroeletronico:'forró eletrônico (estilo vaquejada, animado)',
  xote:'xote e baião nordestino (simples e gostoso)',
  pagodao:'pagodão baiano / swingueira (animado e malicioso, sem palavrão)',
  pagode90:'pagode romântico anos 90',
  sambaraiz:'samba de raiz (roda de samba)',
  sambaenredo:'samba-enredo de escola de samba (refrão forte pra cantar junto)',
  choro:'choro (chorinho, alegre e virtuoso)',
  frevo:'frevo pernambucano (carnaval, acelerado)',
  boibumba:'toada de boi-bumbá (amazônica, épica)',
  vanera:'vanerão gaúcho (alegre, de fandango)',
  jovemguarda:'Jovem Guarda dos anos 60 (iê-iê-iê, inocente e romântico)',
  rapnacional:'rap nacional (rimas, flow e verdade)'
};
const CLIMA_PT = {
  alegre:'alegre e contagiante', emocionante:'emocionante, de arrepiar',
  romantica:'romântico e apaixonado', calma:'calmo e suave',
  nostalgica:'nostálgico, de saudade', festiva:'festivo, de celebração',
  energetica:'energético e vibrante', divertida:'divertido e bem-humorado',
  inspiradora:'inspirador, de superação', melancolica:'melancólico',
  triste:'triste, de saudade e dor, emocionante',
  zoeira:'MODO TROLLAGEM / ZOEIRA: engraçado, debochado, com piadas e provocações de brincadeira (zoeira entre amigos), exagerado e cômico — mas sem ofensa pesada, sem palavrão pesado e sem preconceito'
};
const NICHO_TEXTO = {
  namorada:'é para a namorada da pessoa — tom de romance', namorado:'é para quem a pessoa namora — tom de romance',
  esposa:'é para o cônjuge (esposa ou marido) — amor maduro e de parceria de vida', marido:'é para o marido — amor maduro e de parceria de vida',
  mae:'é de um filho/filha para a mãe ou o pai — gratidão e amor filial', pai:'é de um filho/filha para o pai — gratidão e amor filial',
  irma:'é entre irmãos — carinho e cumplicidade de família', irmao:'é entre irmãos — carinho e cumplicidade de família',
  amiga:'é para a melhor amiga — amizade', amigo:'é para um(a) melhor amigo(a) — amizade',
  familia:'é para a família toda — união, gratidão e amor de família',
  filho:'é de um pai/mãe para o filho(a) — amor incondicional de pai/mãe',
  avo:'é de um neto/neta para a avó ou avô — carinho, gratidão e memórias de família',
  tio:'é para a tia ou tio — carinho de família',
  sogro:'é para a sogra ou sogro — respeito, carinho e gratidão de família',
  padrinho:'é para a madrinha (dinda) ou padrinho — carinho, gratidão e cuidado',
  comercial:'é um JINGLE / PROPAGANDA de uma empresa ou marca — não é homenagem pessoal: fale do negócio, dos produtos/serviços e dos diferenciais, cite o nome da marca várias vezes (principalmente no refrão) e termine com uma chamada pra ação'
};
// Pra quem é, já com o gênero de quem recebe (cartões que juntam ela/ele)
const REL_GENERO = {
  namorado:['a namorada','o namorado'], esposa:['a esposa','o marido'], mae:['a mãe','o pai'],
  irmao:['a irmã','o irmão'], amigo:['a melhor amiga','o melhor amigo'],
  avo:['a avó','o avô'], tio:['a tia','o tio'], sogro:['a sogra','o sogro'],
  padrinho:['a madrinha (dinda)','o padrinho'], filho:['a filha','o filho']
};
const NICHO_EVITAR = {
  mae:'A letra é de filho para mãe: NUNCA use linguagem romântica ou de casal.',
  pai:'A letra é de filho para pai: NUNCA use linguagem romântica ou de casal.',
  irma:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  irmao:'A letra é entre irmãos: NUNCA use linguagem romântica.',
  amiga:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  amigo:'A letra é sobre amizade: NUNCA use linguagem romântica ou de paixão.',
  filho:'A letra é de pai/mãe para filho: NUNCA use linguagem romântica.',
  avo:'A letra é para avó/avô: NUNCA use linguagem romântica.',
  tio:'A letra é para tia/tio: NUNCA use linguagem romântica.',
  sogro:'A letra é para sogra/sogro: NUNCA use linguagem romântica.',
  padrinho:'A letra é para madrinha/padrinho: NUNCA use linguagem romântica.',
  comercial:'É propaganda: NUNCA use linguagem romântica nem de homenagem pessoal.',
  familia:'A letra é para a família: NUNCA use linguagem romântica.'
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
  var gIdx = p.paraGen === 'ela' ? 0 : (p.paraGen === 'ele' ? 1 : -1);
  if (REL_GENERO[p.relacao] && gIdx >= 0) relacaoDesc = 'é para ' + REL_GENERO[p.relacao][gIdx] + ' de quem está dando a música — ' + relacaoDesc.split('—').slice(1).join('—').trim();
  if (p.relacao === 'outro' && p.paraOutro) relacaoDesc = 'é para: ' + p.paraOutro + ' (descrito por quem pediu)' + (gIdx === 0 ? ' — quem recebe é MULHER' : gIdx === 1 ? ' — quem recebe é HOMEM' : '');
  var restricao = NICHO_EVITAR[p.relacao] || '';
  var vozDesc = VOZ_PT[p.voz] || '';

  var partes = [];
  partes.push('Escreva a letra de uma música em português do Brasil, sobre uma história real, com estas características:');
  partes.push('GÊNERO: ' + genDesc + '.');
  if (climaDesc) partes.push('CLIMA: ' + climaDesc + '.');
  partes.push('PARA QUEM: ' + relacaoDesc + '.');
  if (restricao) partes.push('RESTRIÇÃO IMPORTANTE: ' + restricao);
  if (p.ocasiao) partes.push('OCASIÃO: ' + p.ocasiao + '.');
  // GÊNERO DE QUEM DÁ A MÚSICA (eu-lírico): é isso que define "grata/grato",
  // "obrigada/obrigado", "cansada/cansado" etc. Vale mais que a voz.
  if (p.de === 'mulher') partes.push('QUEM ESTÁ DANDO A MÚSICA (quem fala na letra, o "eu") é uma MULHER: sempre que o "eu" falar de si mesma use o FEMININO (ex.: "grata", "obrigada", "apaixonada", "sozinha", "orgulhosa"). Nunca use o masculino pra ela.');
  else if (p.de === 'homem') partes.push('QUEM ESTÁ DANDO A MÚSICA (quem fala na letra, o "eu") é um HOMEM: sempre que o "eu" falar de si mesmo use o MASCULINO (ex.: "grato", "obrigado", "apaixonado", "sozinho", "orgulhoso").');
  else if (p.de === 'neutro') partes.push('QUEM ESTÁ DANDO A MÚSICA (o "eu") não quer marcar gênero: ao falar de si, use SOMENTE construções NEUTRAS — nada de "grato/grata", "obrigado/obrigada", "apaixonado/apaixonada". Prefira "tenho gratidão", "meu coração agradece", "sou feliz", "valeu", "te agradeço".');
  else if (p.de === 'varios') partes.push('QUEM ESTÁ DANDO A MÚSICA são VÁRIAS PESSOAS (família, amigos, equipe): escreva na primeira pessoa do PLURAL ("nós", "a gente"), nunca "eu".');
  if (p.paraGen === 'neutro' && p.relacao !== 'comercial') partes.push('QUEM RECEBE: não marque gênero ao falar dessa pessoa — use construções NEUTRAS (o nome dela, "você", "pessoa especial", "meu amor"), sem adjetivos no feminino ou masculino.');
  if (gIdx >= 0 && p.relacao !== 'comercial') partes.push('QUEM RECEBE é ' + (gIdx === 0 ? 'MULHER: ao falar dela use o FEMININO ("linda", "ela", "querida").' : 'HOMEM: ao falar dele use o MASCULINO ("lindo", "ele", "querido").'));
  if (vozDesc && !p.de) partes.push('VOZ: ' + vozDesc + '.');
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
    partes.push('REGRA DOS NOMES (obrigatória): escreva cada nome EXATAMENTE como foi informado — ' +
      'mesma grafia, mesmas letras e acentos. NÃO corrija, NÃO troque por outro nome parecido, ' +
      'NÃO invente apelido, NÃO traduza. Se o nome for incomum, use ele mesmo assim, igualzinho.');
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

function montarPromptAjuste(letraAtual, instrucao, nomes) {
  var partes = [];
  partes.push('Aqui está a letra atual de uma música personalizada, já com as marcações de estrutura:');
  partes.push('"""');
  partes.push(letraAtual);
  partes.push('"""');
  partes.push('');
  partes.push('PEDIDO DE AJUSTE da pessoa, nas palavras dela: "' + instrucao + '"');
  partes.push('');
  if (nomes) partes.push('Os nomes "' + nomes + '" devem continuar escritos EXATAMENTE assim (não altere a grafia).');
  partes.push('Mantenha a concordância de gênero que a letra já usa (feminino/masculino), a não ser que o pedido diga o contrário.');
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
  // modo longo = chamado pela função em segundo plano (sem o corte de 30s)
  const longo = req.headers.get('x-modo-longo') === '1';
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
    const de = String((body && body.de) || '').trim();             // mulher | homem | varios
    const paraGen = String((body && body.paraGen) || '').trim();   // ela | ele
    const paraOutro = String((body && body.paraOutro) || '').trim().slice(0, 120);

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
      ? montarPromptAjuste(letraAtual.slice(0, 3000), instrucao.slice(0, 500), nomesLetra)
      : montarPrompt({
          estilo, clima, relacao, ocasiao, nomesLetra, frase, voz, de, paraGen, paraOutro,
          texto: texto.slice(0, 2000)
        });
    const systemPrompt = modoAjuste ? AJUSTE_SYSTEM_PROMPT : SYSTEM_PROMPT;

    console.log('PEDIDO DE LETRA >> modo=' + (modoAjuste ? 'ajuste pontual' : 'geração') +
      (modoAjuste ? ' | pedido=' + instrucao.slice(0, 80) : ' | genero=' + estilo + ' | clima=' + clima + ' | relacao=' + relacao + ' | ocasiao=' + ocasiao + ' | de=' + de + ' | paraGen=' + paraGen));

    // O GPT-5.4 às vezes demora mais de 30s (ou dá 503) e o Netlify corta a
    // função em 30s. Então pedimos a letra ao GPT-5.4 e, AO MESMO TEMPO, a
    // modelos rápidos de reserva: se o 5.4 responder em até 14s, usa ele;
    // senão usa o primeiro modelo de reserva que responder.
    const t0 = Date.now();
    const espera = (ms) => new Promise((r) => setTimeout(() => r(null), Math.max(0, ms)));
    async function chamar(modelo, comTemperatura) {
      const tc = Date.now();
      try {
        const corpo = {
          model: modelo,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          // espaço de sobra: modelos que "pensam" antes gastam parte disso
          max_tokens: 4000
        };
        // Ajuste pontual pede mais fidelidade ao texto original.
        if (comTemperatura) corpo.temperature = modoAjuste ? 0.55 : 0.9;
        const r = await fetch('https://api.unifically.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo)
        });
        const d = await r.json().catch(() => null);
        const ch = d && d.choices && d.choices[0];
        const txt = ch && ch.message && ch.message.content;
        if (r.ok && ch && ch.finish_reason === 'length') {
          console.log('FALHA ' + modelo + ' >> letra veio cortada (limite de tamanho)');
          return null;
        }
        if (!r.ok || !txt || !String(txt).trim() || String(txt).trim().split('\n').length < 8) {
          console.log('FALHA ' + modelo + ' >> ' + r.status + ' ' + JSON.stringify(d).slice(0, 300));
          return null;
        }
        console.log('OK ' + modelo + ' em ' + (Date.now() - tc) + 'ms');
        return String(txt);
      } catch (e) {
        console.log('FALHA ' + modelo + ' >> ' + (e && e.message));
        return null;
      }
    }

    // Primeiro que responder com texto (ignora quem falhar).
    function primeiroOk(promessas) {
      return new Promise((resolve) => {
        let faltam = promessas.length;
        promessas.forEach((p) => p.then((v) => {
          if (v) resolve(v);
          else if (--faltam === 0) resolve(null);
        }));
      });
    }

    // Só o GPT-5.4 (era o único que acertava sempre). Antes 4 modelos reserva
    // eram chamados JUNTOS em toda letra — gastavam requisição mesmo sem uso.
    // Em segundo plano (até 15 min) dá pra esperar bem e tentar 2 vezes.
    const LIMITE = longo ? 95000 : 26000;
    const resta = () => LIMITE - (Date.now() - t0);
    let conteudo = await Promise.race([chamar('openai/gpt-5.4', true), espera(resta())]);
    if (!conteudo && longo && resta() > 40000) {
      console.log('GPT-5.4 falhou, tentando de novo...');
      conteudo = await Promise.race([chamar('openai/gpt-5.4', true), espera(resta())]);
    }
    if (!conteudo) {
      return json({ erro: 'Não consegui escrever a letra agora. Tenta de novo em instantes.' }, 502);
    }

    const letra = limparResposta(conteudo);
    console.log('LETRA GERADA >> ' + letra.slice(0, 120) + (letra.length > 120 ? '...' : ''));

    return json({ ok: true, letra: letra });

  } catch (e) {
    console.error('gerar-letra (inesperado):', e && e.stack || e);
    return json({ erro: 'Erro inesperado no servidor: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
};
