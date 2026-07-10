# Plano: Corrigir streaming do chat-ai com RunPod

## Problema

O chat-ai exibe os três pontinhos (typing dots) mas nunca mostra a resposta do modelo, mesmo com a API RunPod respondendo corretamente.

## Causa Raiz

Em `server/routes/chat.js:48`, a verificação:

```js
const isChunked = response.headers.get('transfer-encoding')?.includes('chunked');
```

determina se a resposta do RunPod deve ser lida como stream ou como blob único. Quando o endpoint RunPod OpenAI-compatible retorna a resposta **sem** `transfer-encoding: chunked` (ex: HTTP/2, resposta text/event-stream sem chunked encoding explicito, ou certas configs de proxy), `isChunked` é `false`. O código então cai no branch `else` (linha 96) que faz:

```js
const text = await response.text();
```

Isso lê **todo o corpo SSE** como uma única string. Em seguida tenta `JSON.parse(text)` — que falha (a string contém múltiplos JSONs SSE separados por `\n\n`) — e cai em `content = text`, enviando a stream SSE bruta como um token único para o cliente. Isso pode:
1. Fazer `response.text()` travar se a stream for longa ou infinita
2. Enviar dados corrompidos/brutos para o cliente

## Problemas Secundários

1. Em `client/js/app.js:78`, `scheduleRender()` só atualiza `streamingBubbleEl`. Se `streamingBubbleEl` for `null`, os tokens são acumulados em `state.messages[].content` mas nunca renderizados no DOM.
2. Em `chat.js`, se `response.body` for `null`, `getReader()` lançaria TypeError.
3. Falta logging para debugar o formato real dos chunks recebidos do RunPod.

## Alterações

### 1. `server/routes/chat.js` — Sempre tentar streaming primeiro

Substituir o bloco `if (isChunked) { ... } else { ... }` por:

```js
if (response.body) {
  // Lógica de streaming via response.body.getReader()
  // (mesma lógica atual do branch isChunked)
} else {
  // Fallback: response.text() mas processando como SSE
  // (split por linhas, tratar data: ..., extrair tokens)
}
```

**Detalhes:**
- `response.body` é `ReadableStream | null`. O `getReader()` funciona tanto para chunked quanto para non-chunked responses no Node.js 20 (fetch do undici).
- O branch fallback com `response.text()` deve processar o texto como múltiplas linhas SSE (separar por `\n`, filtrar linhas `data: `, extrair tokens) em vez de tentar `JSON.parse` no texto inteiro.
- Remover a variável `isChunked`.

### 2. `client/js/app.js` — Fallback de renderização

Em `scheduleRender()` (linha 74), adicionar fallback caso `streamingBubbleEl` seja `null`:

```js
function scheduleRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const el = streamingBubbleEl || chatContainer.lastElementChild?.querySelector('.bubble');
    if (el && state.messages.length > 0) {
      const lastMsg = state.messages[state.messages.length - 1];
      el.innerHTML = formatMarkdown(lastMsg.content) + '<span class="typing-cursor">|</span>';
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
}
```

Isso garante que mesmo se `streamingBubbleEl` for perdido, os tokens encontram o bubble correto no DOM.

### 3. `server/routes/chat.js` — Logging

Adicionar log condicional nos chunks recebidos (apenas quando `NODE_ENV !== 'production'` ou similar):

```js
if (process.env.NODE_ENV !== 'production') {
  console.log('[RunPod chunk]', line);
}
```

## Testes

- `npm test` — verificar que `extractToken`, `SSEClient`, e `formatMarkdown` continuam passando
- Teste manual: enviar mensagem, verificar se a resposta aparece no chat

## Riscos

- Remover o `isChunked` pode expor bugs no `reader.read()` se o `response.body` for um ReadableStream, mas não estiver pronto para leitura imediata. Isso não deve acontecer com o fetch do Node.js 20.

## Arquivos a modificar

1. `server/routes/chat.js` — lógica de leitura da resposta, fallback non-stream
2. `client/js/app.js` — fallback de renderização em `scheduleRender`
