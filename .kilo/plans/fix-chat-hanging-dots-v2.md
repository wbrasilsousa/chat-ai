# Plano: Corrigir chat preso nos 3 pontinhos (v2 - revisado)

## Problema

O chat-ai exibe os 3 pontinhos (typing dots) mas nunca mostra a resposta do modelo. As alterações da v2 foram implantadas mas o problema persiste.

## Investigação - Logs do container

O container atual (com as alterações da v2) mostra que o servidor recebe corretamente os tokens da RunPod e os encaminha para o cliente. Exemplo real do log:

```
[RunPod chunk] data: {"delta":{"content":"\n\nClaro!","tool_calls":[]}}
[RunPod chunk] data: {"delta":{"content":" Você","tool_calls":[]}}
...
[RunPod chunk] data: {"delta":{"content":"?","tool_calls":[]}}
[RunPod chunk] data: {"delta":{},"finish_reason":"stop"}
[RunPod chunk] data: [DONE]
```

Teste com curl confirma que o servidor retorna os dados corretamente:
```
data: {"token":"\n\n"}
data: {"token":"OLA"}
data: [DONE]
```

**O servidor está funcionando.** O problema está no client-side.

## Causa Raiz Real (v2 revisado)

### Race condition: `handleDone` cancela `rafId` antes do `scheduleRender` atualizar o DOM

O fluxo do cliente é:

1. `sendMessage()` → `render()` cria bolha vazia → `streamingBubbleEl.innerHTML = '<div class="typing-dots">...'`
2. Token chega → `handleToken()` → `scheduleRender()` → agenda `requestAnimationFrame` (rafId)
3. `[DONE]` chega → `handleDone()` → **cancela rafId** com `cancelAnimationFrame(rafId)`
4. O callback do `requestAnimationFrame` NUNCA executa
5. `streamingBubbleEl.innerHTML` ainda contém os typing dots
6. `handleDone` só remove `.typing-cursor` (que nunca existiu) e adiciona botão de copiar
7. Os dots `<div class="typing-dots">...</div>` permanecem no DOM para sempre

Isso ocorre quando tokens de conteúdo e `[DONE]` chegam na mesma leitura do `reader.read()` (comum em respostas curtas) ou quando o `requestAnimationFrame` ainda não disparou.

### Secundário: `delta.reasoning` não é extraído

O modelo `huihui-qwen3` (e outros modelos de raciocínio) enviam tokens em `delta.reasoning` antes do `delta.content`. Estes tokens são ignorados pelo `extractToken`. Se o modelo produzir apenas raciocínio sem conteúdo visível, nada é mostrado.

## Alterações (apenas client-side)

### 1. `client/js/app.js` — `handleDone` sempre renderiza o conteúdo final

Em vez de confiar no `scheduleRender` ter atualizado o DOM, `handleDone` deve:
- Sempre substituir `streamingBubbleEl.innerHTML` pelo conteúdo formatado final
- Se o conteúdo estiver vazio, remover a mensagem do assistant do state e chamar `render()`

```js
function handleDone() {
  state.loading = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (streamingBubbleEl) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.content) {
      streamingBubbleEl.innerHTML = formatMarkdown(lastMsg.content);
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.appendChild(createCopyButton(lastMsg.content));
      streamingBubbleEl.appendChild(actions);
    } else {
      if (lastMsg && lastMsg.role === 'assistant') {
        state.messages.pop();
      }
      render();
    }
    streamingBubbleEl = null;
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
```

### 2. `client/js/sse.js` — Processar `parsed.token` mesmo quando vazio

Se `extractToken` retornar `""` (content vazio), o servidor envia `{"token":""}`. O cliente ignora por `if (parsed.token)`. Isso é correto (não há o que mostrar), mas o `anyTokenSent` no servidor é marcado como `true`, impedindo o erro de "resposta vazia". Não precisa mudar — o comportamento atual está OK.

## Arquivos a modificar

| Arquivo | Tipo de mudança |
|---|---|
| `client/js/app.js` | `handleDone` — sempre renderiza conteúdo final |

## Estratégia de deploy

Mudanças em `client/` entram em vigor imediatamente (volume mount). Basta o usuário dar hard refresh (Ctrl+F5) no navegador.

## Testes

```bash
npm test  # testes do server-side
```

Teste manual via curl:
```bash
curl -s -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Diga apenas a palavra: OLA"}]}'
```
