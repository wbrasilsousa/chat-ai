# ChatAI

Assistente com inteligência artificial usando API RunPod.

## Pré-requisitos

- Node.js >= 18
- Conta [RunPod](https://runpod.io) com endpoint Serverless configurado

## Configuração

Copie `.env.example` para `.env` e preencha:

```
RUNPOD_API_KEY=sua-chave-aqui
ENDPOINT_ID=seu-endpoint-id
```

## Instalação

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## Deploy com Podman/Docker

```bash
podman build -t chat-ai .
podman run -d --name chat-ai -p 3000:3000 --env-file .env chat-ai
```

## Arquitetura

```
client/          → Frontend (HTML + CSS + JS módulos ES)
server/          → Backend Express
  routes/chat.js → API de chat com SSE streaming
  lib/runpod.js  → Integração com RunPod API
.env             → Configuração (não versionado)
```
