# Plano de Correções — Code Review ChatAI

## Objetivo

Corrigir todos os achados do code review, organizados por prioridade, incluindo testes automatizados e documentação.

## Tarefas

### Fase 1 — Segurança Crítica

#### 1.1 Sanitizar `lang` no `formatMarkdown` (XSS)

- **Arquivo:** `client/js/app.js:164`
- **O que fazer:** Aplicar whitelist de caracteres seguros no grupo `lang` antes de interpolar no atributo `class`.
- **Código:**
  ```js
  const safeLang = (lang || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return '<pre><code class="language-' + (safeLang || 'text') + '">' + code.trim() + '</code></pre>';
  ```

#### 1.2 Remover `.env` da imagem Docker

- **Arquivos:** `Containerfile:13` e `scripts/podman-run.sh`
- **O que fazer:**
  1. Remover a linha `COPY package.json .env ./` do Containerfile
  2. Adicionar `.dockerignore` com `.env` e `node_modules/`
  3. Atualizar `scripts/podman-run.sh` para passar `--env-file .env` no `podman run`
  4. Substituir variáveis build-time seguras (ex.: `NODE_ENV`) por `ENV` ou `ARG` no Containerfile

#### 1.3 Remover ou restringir CORS

- **Arquivo:** `server/server.js:13-17`
- **O que fazer:** Remover o middleware CORS manual já que frontend e API estão na mesma origem. Se for necessário manter para desenvolvimento cross-origin, adicionar uma checagem de `NODE_ENV`.
- **Código:**
  ```js
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }
  ```

#### 1.4 Corrigir dupla escrita de `[DONE]` no SSE

- **Arquivo:** `server/routes/chat.js`
- **O que fazer:** Adicionar flag `doneSent` para garantir que `data: [DONE]` seja escrito apenas uma vez.
- **Código:**
  ```js
  let doneSent = false;
  // ... dentro do loop:
  if (token === null && !doneSent) {
    res.write('data: [DONE]\n\n');
    doneSent = true;
  }
  // ... após o buffer residual:
  if (buffer.trim()) { ... }
  if (!doneSent) {
    res.write('data: [DONE]\n\n');
  }
  ```

### Fase 2 — Backend

#### 2.1 Cancelar requisição RunPod na desconexão do cliente

- **Arquivo:** `server/routes/chat.js`
- **O que fazer:** Adicionar `req.on('close', () => { ... })` para abortar o `reader` e cancelar o `response.body` RunPod.
- **Código:**
  ```js
  let reader = null;
  const response = await callRunPodStream(ENDPOINT_ID, RUNPOD_API_KEY, payload);
  req.on('close', () => {
    reader?.cancel();
    response.body?.cancel();
  });
  ```

#### 2.2 Não expor erros internos ao cliente

- **Arquivo:** `server/routes/chat.js:99-100`
- **O que fazer:** Logar erro completo no servidor, enviar mensagem genérica ao cliente.
- **Código:**
  ```js
  console.error('Chat error:', err);
  const msg = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : err.message;
  res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  ```

#### 2.3 Adicionar rate limiting

- **Arquivo:** `server/server.js`
- **O que fazer:** Instalar `express-rate-limit` e aplicar ao `/api/chat`.
- **Comandos:**
  ```bash
  npm install express-rate-limit
  ```
- **Código:**
  ```js
  import rateLimit from 'express-rate-limit';
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Muitas requisicoes. Tente novamente em 1 minuto.' },
  });
  app.use('/api/chat', chatLimiter);
  ```

#### 2.4 Corrigir fallback não-streaming

- **Arquivo:** `server/routes/chat.js:77-93`
- **O que fazer:** Adicionar verificação `response.ok` antes de processar fallback, e tratar erro HTTP corretamente.

### Fase 3 — Frontend

#### 3.1 Extrair botão "Copiar" para função reutilizável

- **Arquivo:** `client/js/app.js`
- **O que fazer:** Criar `function createCopyButton(content) { ... }` e usar em `handleDone()` e `render()`.
- **Código:**
  ```js
  function createCopyButton(content) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.title = 'Copiar';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>';
    btn.addEventListener('click', () => navigator.clipboard.writeText(content));
    return btn;
  }
  ```

#### 3.2 Otimizar re-renderização de tokens

- **Arquivo:** `client/js/app.js`
- **O que fazer:** Substituir `innerHTML` completo por append em buffer com debounce de ~50ms via `requestAnimationFrame`.
- **Abordagem:**
  1. Manter `streamingBuffer` (string acumulada)
  2. Acumular tokens em `streamingBuffer`
  3. Usar `requestAnimationFrame` para re-renderizar `formatMarkdown(streamingBuffer)` em batches
  4. Usar `typing-cursor` após o conteúdo

#### 3.3 Remover `DOMContentLoaded` listener

- **Arquivo:** `client/js/app.js:212`
- **O que fazer:** Substituir `document.addEventListener('DOMContentLoaded', init)` por chamada direta `init()`.

#### 3.4 Remover CSS morto do painel de configurações

- **Arquivo:** `client/css/style.css:103-169`
- **O que fazer:** Remover as regras CSS de `#settings-panel`, `#settings-form`, `.form-group`, `.form-group.full`, `.form-group input`, `#settings-form button`.

#### 3.5 Adicionar `scrollbar-gutter`

- **Arquivo:** `client/css/style.css`
- **O que fazer:** Adicionar `scrollbar-gutter: stable` em `#chat-container`.

### Fase 4 — DevOps

#### 4.1 Criar `.dockerignore`

- **Arquivo:** `.dockerignore` (novo)
- **Conteúdo:**
  ```
  .env
  node_modules/
  .git/
  ```

#### 4.2 Atualizar `Containerfile` para não copiar `.env`

- **Arquivo:** `Containerfile`
- **O que fazer:** Substituir `COPY package.json .env ./` por `COPY package.json ./` e ajustar `ENV NODE_ENV=production` para `ARG NODE_ENV=production` com `ENV NODE_ENV=$NODE_ENV`.

#### 4.3 Atualizar `scripts/podman-run.sh`

- **Arquivo:** `scripts/podman-run.sh`
- **O que fazer:** Adicionar `--env-file .env` ao comando `podman run`.

### Fase 5 — Boas Práticas

#### 5.1 Adicionar `engines` no `package.json`

- **Arquivo:** `package.json`
- **Conteúdo:**
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```

#### 5.2 Criar README.md

- **Arquivo:** `README.md` (novo)
- **Conteúdo mínimo:**
  - Descrição do projeto
  - Pré-requisitos (Node 18+, conta RunPod)
  - Configuração (.env)
  - `npm install` + `npm run dev`
  - Deploy via Podman/Docker
  - Arquitetura (diagrama simplificado)

### Fase 6 — Testes

#### 6.1 Setup de teste

- **Arquivos:** `package.json`, `vitest.config.js` (ou `jest.config.js`)
- **O que fazer:** Adicionar `vitest` como devDependency e script de teste.
- **Comandos:**
  ```bash
  npm install -D vitest
  ```
- **Script:** `"test": "vitest run"` no `package.json`

#### 6.2 Testes para `extractToken`

- **Arquivo:** `server/lib/runpod.test.js`
- **Casos de teste:**
  - Chunk vazio → `undefined`
  - `[DONE]` → `null`
  - Chunk com `delta.content` (OpenAI format)
  - Chunk com `output` (RunPod format)
  - Chunk com `response`
  - JSON inválido → `undefined`

#### 6.3 Testes para `formatMarkdown`

- **Arquivo:** `client/js/app.test.js` (ou test utils)
- **Casos de teste:**
  - Texto simples sem markdown
  - Código inline com backticks
  - Code block com language
  - Code block com language maliciosa (XSS) — testar sanitização
  - **Negrito** e *itálico*
  - Escape de HTML (`<script>`)
  - Conteúdo vazio
  - Quebras de linha

#### 6.4 Testes para SSE client

- **Arquivo:** `client/js/sse.test.js`
- **Casos de teste:**
  - Parsing de eventos SSE bem-formados
  - Evento `[DONE]` → chama `onDone`
  - Evento com `error` → chama `onError`
  - Evento com `token` → chama `onToken`
  - Buffer residual (split no meio de uma linha)
  - `AbortError` ignorado

## Validação

1. `npm run dev` — servidor sobe sem erros
2. `npm test` — todos os testes passam
3. Enviar mensagem no chat — streaming funciona, sem duplicação de `[DONE]`
4. Testar XSS: enviar resposta simulada com `` ```js" onfocus="alert(1)``` `` — não executa JS
5. `podman build -t chat-ai .` — build passa; `podman history` não mostra `.env`
6. Verificar CORS: `curl -v -X OPTIONS http://localhost:3000/api/chat` — sem headers `Access-Control-Allow-Origin:*` em produção
7. Fechar navegador durante streaming — log do servidor não mostra erro, requisição RunPod cancelada
8. Rate limiting: 21 requisições em 1 minuto → 20ª OK, 21ª retorna 429
