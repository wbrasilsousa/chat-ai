# Plano: UI estilo DeepSeek para ChatAI

## Objetivo
Tornar a interface do ChatAI similar ao chat.deepseek.com:
- Estado inicial: apenas o bloco de prompt centralizado
- Após primeira interação: expansão para exibir todo o chat
- Bordas mais arredondadas

## Arquivos a modificar

### 1. `client/index.html`
- Adicionar `<div id="welcome">` com título "ChatAI" e subtítulo "Seu assistente com inteligência artificial" entre `<header>` e `<div id="chat-container">`
- Adicionar classe `initial` no `<div class="app">`

### 2. `client/css/style.css`
- Aumentar `--radius` de `12px` para `20px` e `--radius-sm` de `8px` para `12px`
- Adicionar regras para `#welcome` (centralizado, fade)
- Adicionar regras para `.app.initial`:
  - `header` → `display: none`
  - `#chat-container` → `display: none`
  - `#welcome` → visível
  - layout: `display: flex; justify-content: center;` para centralizar verticalmente o conjunto welcome + input
  - `#input-area` → centralizado, sem `border-top`, max-width menor
  - `#input-area textarea` → maior padding, fonte maior
- Adicionar regras para `.app.expanded`:
  - `header` → visível
  - `#chat-container` → visível
  - `#welcome` → `display: none`
  - `#input-area` → layout normal (bottom)

### 3. `client/js/app.js`
- Remover chamada `showWelcome()` do `init()`
- Adicionar variável `let expanded = false`
- Em `init()`: não renderizar mensagem de boas-vindas
- Em `sendMessage()`: se `!expanded`, definir `expanded = true`, trocar classe `.app` de `initial` para `expanded`, limpar `state.messages` (se houver), prosseguir com envio normal
- Não exibir mensagem de sistema "bem-vindo" – o `#welcome` HTML já cumpre esse papel

## Fluxo
1. Usuário acessa → vê `#welcome` centralizado + textarea grande
2. Digita e envia → app troca para `expanded`, `#welcome` some, `header` e `#chat-container` aparecem, mensagens são renderizadas, input vai para o bottom
3. Interações seguintes → comportamento normal de chat

## Validação
- Servir com `npm run dev` e testar no navegador
- Verificar transição suave entre estados
- Verificar responsividade no estado inicial e expandido
- Verificar toggle de tema nos dois estados
