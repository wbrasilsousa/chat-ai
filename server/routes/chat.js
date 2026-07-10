import { Router } from 'express';
import { buildPayload, callRunPodStream, extractToken } from '../lib/runpod.js';

const router = Router();

const TEMPERATURE = parseFloat(process.env.TEMPERATURE) || 0.2;
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS, 10) || 4096;
const MODEL_NAME = process.env.MODEL_NAME;

router.post('/', async (req, res) => {
  const { messages } = req.body;
  const { RUNPOD_API_KEY, ENDPOINT_ID } = process.env;

  if (!RUNPOD_API_KEY || !ENDPOINT_ID) {
    return res.status(500).json({ error: 'RunPod nao configurado' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages e obrigatorio' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let doneSent = false;
  let reader = null;

  try {
    const payload = buildPayload(messages, {
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      model: MODEL_NAME,
    });
    const response = await callRunPodStream(ENDPOINT_ID, RUNPOD_API_KEY, payload);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API error ${response.status}: ${errorText}`);
    }

    req.on('close', () => {
      reader?.cancel();
      response.body?.cancel();
    });

    if (response.body) {
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).replace(/\r$/, '');
          buffer = buffer.slice(newlineIdx + 1);

          const trimmed = line.trim();
          if (!trimmed) continue;

          const data = trimmed.startsWith('data: ') ? trimmed.slice(6).trim() : trimmed;
          const token = extractToken(data);

          if (process.env.NODE_ENV !== 'production') {
            console.log('[RunPod chunk]', line);
          }

          if (token === null) {
            if (!doneSent) {
              res.write('data: [DONE]\n\n');
              doneSent = true;
            }
          } else if (token !== undefined) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        const data = trimmed.startsWith('data: ') ? trimmed.slice(6).trim() : trimmed;
        const token = extractToken(data);
        if (token === null) {
          if (!doneSent) {
            res.write('data: [DONE]\n\n');
            doneSent = true;
          }
        } else if (token !== undefined) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else {
      const text = await response.text();
      const lines = text.split('\n');

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        if (process.env.NODE_ENV !== 'production') {
          console.log('[RunPod fallback]', trimmed);
        }

        const data = trimmed.startsWith('data: ') ? trimmed.slice(6).trim() : trimmed;
        if (data === '[DONE]') {
          if (!doneSent) {
            res.write('data: [DONE]\n\n');
            doneSent = true;
          }
          break;
        }

        const token = extractToken(data);
        if (token !== undefined && token !== null) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    }

    if (!doneSent) {
      res.write('data: [DONE]\n\n');
    }
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    if (!doneSent) {
      const msg = process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message;
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }
    res.end();
  }
});

export default router;
