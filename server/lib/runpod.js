const RUNPOD_API_BASE = 'https://api.runpod.ai/v2';

export function buildPayload(messages, options = {}) {
  const { temperature = 0.7, max_tokens = 1024 } = options;
  return {
    input: {
      messages,
      temperature,
      max_tokens,
      stream: true,
    },
  };
}

export async function callRunPodStream(endpointId, apiKey, payload) {
  const url = `${RUNPOD_API_BASE}/${endpointId}/runsync`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod API error ${response.status}: ${errorText}`);
  }

  return response;
}

export function extractToken(chunk) {
  if (!chunk || chunk === '[DONE]') return null;

  try {
    const parsed = JSON.parse(chunk);

    if (parsed.choices?.[0]?.delta?.content) {
      return parsed.choices[0].delta.content;
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
