# Capivarinha Love — integração Pix com Efí Bank

Este pacote já está preparado para o fluxo:

**criar presente → gerar cobrança Pix Efí → exibir QR Code + Pix Copia e Cola → aguardar confirmação → webhook Efí → liberar presente.**

O mesmo núcleo é reutilizado para carta, álbum, jogo, pacote completo e itens extras. O conteúdo só é liberado depois que o pedido correspondente estiver marcado como pago.

## O que foi alterado

- Integração Asaas removida do backend.
- Cobrança Pix dinâmica Efí com `txid` único por pedido.
- QR Code / Pix Copia e Cola obtidos da API Pix Efí.
- Webhook `webhook-efi` associa o `txid` ao presente e libera somente após pagamento.
- Netlify Blobs continua armazenando os presentes e o vínculo `txid → pedido`.
- Modo de homologação possui botão de simulação local para testar o fluxo visual sem dinheiro real.
- Corrigido o wizard: selecionar opções, adicionar/remover itens, fotos, perguntas ou jogos não joga mais a tela para o topo.
- A fala digitada da Capivarinha não reinicia em alterações dentro da mesma etapa; ela reinicia apenas quando há mudança real de etapa, como ao tocar em **Continuar** ou **Voltar**.

## Variáveis do Netlify

Em **Netlify → Site configuration → Environment variables**, configure:

- `EFI_CLIENT_ID` — Client_Id da aplicação Efí.
- `EFI_CLIENT_SECRET` — Client_Secret da aplicação Efí.
- `EFI_PIX_KEY` — chave Pix vinculada à conta Efí que receberá os pagamentos.
- `EFI_CERT_P12_BASE64` — conteúdo do certificado `.p12` convertido para Base64.
- `EFI_CERT_PASSWORD` — senha do P12, somente se o certificado possuir senha; caso contrário deixe vazia/não crie.
- `EFI_ENV` — `homologation` para testes ou `production` para pagamentos reais.
- `EFI_WEBHOOK_SECRET` — texto aleatório longo usado como segredo/HMAC na URL do webhook.
- `EFI_WEBHOOK_URL` — URL da função, por exemplo `https://SEU-SITE.netlify.app/.netlify/functions/webhook-efi`.
- `EFI_SETUP_SECRET` — senha administrativa temporária usada somente para executar a configuração automática do webhook.

### Converter o certificado P12 para Base64

macOS/Linux:

```bash
base64 -i certificado.p12 | tr -d '\n'
```

Se sua versão do `base64` não aceitar `-i`:

```bash
base64 certificado.p12 | tr -d '\n'
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12"))
```

Cole somente o resultado na variável `EFI_CERT_P12_BASE64`. Nunca coloque Client Secret ou certificado dentro do `index.html`.

## Escopos necessários na aplicação Efí

Para este projeto, habilite na API Pix pelo menos:

- `cob.write` — criar cobrança Pix.
- `cob.read` — consultar cobranças, útil para diagnóstico/expansão.
- `payloadlocation.read` — obter QR Code/Pix Copia e Cola da cobrança.
- `webhook.write` — cadastrar o webhook.
- `webhook.read` — recomendado para consultar a configuração.
- `pix.read` — recomendado para conciliação/diagnóstico de Pix recebidos.

Não é necessário habilitar envio de Pix, pagamento de QR Code, alteração de chaves ou outras permissões que este site não usa.

## Configurar o webhook Efí no Netlify

Depois do deploy e das variáveis configuradas, faça uma chamada **POST** para:

`/.netlify/functions/configurar-webhook-efi`

com o header:

`x-setup-secret: VALOR_DE_EFI_SETUP_SECRET`

A função registra `EFI_WEBHOOK_URL` para a sua `EFI_PIX_KEY`, habilitando `x-skip-mtls-checking: true`, adequado ao Netlify. A URL recebe também o `EFI_WEBHOOK_SECRET` e `ignorar=` para manter o callback na mesma rota quando a Efí acrescentar `/pix`.

Depois que o webhook estiver configurado e testado, você pode remover `EFI_SETUP_SECRET` do ambiente para desativar essa configuração administrativa.

## Homologação

Use:

`EFI_ENV=homologation`

O site exibirá a identificação de homologação e um botão **Simular pagamento (só teste)**. Esse botão apenas marca o pedido como pago no ambiente de teste para validar todo o fluxo visual do site. Ele é automaticamente bloqueado quando `EFI_ENV=production`.

## Produção

Quando tudo estiver validado:

1. Gere/use credenciais e certificado de **produção** na Efí.
2. Troque `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET` e `EFI_CERT_P12_BASE64` pelos de produção.
3. Confirme que `EFI_PIX_KEY` é a chave real que receberá os valores.
4. Defina `EFI_ENV=production`.
5. Faça novo deploy.
6. Execute novamente `configurar-webhook-efi` usando as credenciais de produção.
7. Faça uma compra real de baixo valor e confirme o fluxo completo.

## Funções principais

- `netlify/functions/_efi.mjs` — cliente HTTPS/mTLS + OAuth2 da Efí.
- `netlify/functions/criar-pagamento.mjs` — salva pedido, cria cobrança e devolve Pix.
- `netlify/functions/webhook-efi.mjs` — recebe Pix confirmado e libera o conteúdo.
- `netlify/functions/configurar-webhook-efi.mjs` — configuração protegida do webhook.
- `netlify/functions/simular-pagamento.mjs` — simulação apenas em homologação.
- `netlify/functions/presente.mjs` — consulta o pedido e só devolve o conteúdo completo quando pago.

## Segurança do fluxo

O front-end nunca libera o presente apenas porque o usuário chegou à tela final. O status válido fica no servidor/Netlify Blobs. Em produção, quem muda o pedido para pago é o webhook associado ao `txid`. O navegador apenas consulta periodicamente o status e mostra o presente quando o backend confirma a liberação.

## Diagnóstico seguro da integração

Este pacote também inclui `/.netlify/functions/diagnostico-efi`. Ele não cria cobrança e não devolve Client Secret, certificado nem chave Pix. Serve para verificar se as variáveis obrigatórias estão presentes, se o OAuth/mTLS da Efí autentica e se o webhook pode ser consultado.

Faça uma chamada GET ou POST com o header:

`x-setup-secret: VALOR_DE_EFI_SETUP_SECRET`

Quando retornar `"ok": true` e `"autenticacao": "ok"`, a autenticação de produção está funcionando. Depois de terminar a configuração, remova `EFI_SETUP_SECRET` para desativar tanto o diagnóstico quanto a configuração administrativa do webhook.
