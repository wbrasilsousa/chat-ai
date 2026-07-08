import { Router } from 'express';
import { buildPayload, callRunPodStream, extractToken } from '../lib/runpod.js';

const router = Router();

router.post('/', async (req, res) => {
  const { messages, temperature, max_tokens } = req.body;
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

  try {
    const payload = buildPayload(messages, { temperature, max_tokens });
    const response = await callRunPodStream(ENDPOINT_ID, RUNPOD_API_KEY, payload);

    const isChunked = response.headers.get('transfer-encoding')?.includes('chunked');

    if (isChunked) {
      const reader = response.body.getReader();
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

          if (token === null) {
            res.write('data: [DONE]\n\n');
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
          res.write('data: [DONE]\n\n');
        } else if (token !== undefined) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else {
      const text = await response.text();
      let content = '';

      try {
        const parsed = JSON.parse(text);
        content = parsed.output
          || parsed.choices?.[0]?.message?.content
          || parsed.response
          || text;
      } catch {
        content = text;
      }

      if (content) {
        res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Erro interno' })}\n\n`);
    res.end();
  }
});

export default router;
