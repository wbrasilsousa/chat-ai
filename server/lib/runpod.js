const RUNPOD_API_BASE = 'https://api.runpod.ai/v2';

export function buildPayload(messages, options = {}) {
  const { model, temperature = 0.2, max_tokens = 4096 } = options;
  return {
    model,
    messages,
    temperature,
    max_tokens,
    stream: true,
  };
}

export async function callRunPodStream(endpointId, apiKey, payload) {
  const url = `${RUNPOD_API_BASE}/${endpointId}/openai/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod API error ${response.status}: ${errorText}`);
  }

  return response;
}

export function extractToken(chunk) {
  if (!chunk) return undefined;
  if (chunk === '[DONE]') return null;

  try {
    const parsed = JSON.parse(chunk);

    if (parsed.choices?.[0]?.delta?.content !== undefined) {
      return parsed.choices[0].delta.content;
    }

    if (parsed.choices?.[0]?.message?.content) {
      return parsed.choices[0].message.content;
    }

    if (parsed.choices?.[0]?.text) {
      return parsed.choices[0].text;
    }

    if (parsed.token !== undefined) {
      return String(parsed.token);
    }

    if (parsed.output) {
      return String(parsed.output);
    }

    if (parsed.response) {
      return String(parsed.response);
    }
  } catch {
    // not JSON
  }

  return undefined;
}
