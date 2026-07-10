import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SSEClient from './sse.js';

function createMockResponse(chunks) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: {
      getReader() {
        return {
          read() {
            if (index >= chunks.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const value = encoder.encode(chunks[index]);
            index++;
            return Promise.resolve({ done: false, value });
          },
          cancel() {},
        };
      },
    },
  };
}

describe('SSEClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onToken for token events', async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const client = new SSEClient({ onToken, onDone });

    const lines = [
      'data: {"token":"Hello"}\n',
      'data: {"token":"world"}\n',
      'data: [DONE]\n',
    ];
    global.fetch.mockResolvedValue(createMockResponse(lines));

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onToken).toHaveBeenNthCalledWith(2, 'world');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone on [DONE] event', async () => {
    const onDone = vi.fn();
    const client = new SSEClient({ onDone });

    global.fetch.mockResolvedValue(createMockResponse(['data: [DONE]\n']));

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onError for error events', async () => {
    const onError = vi.fn();
    const client = new SSEClient({ onError });

    global.fetch.mockResolvedValue(createMockResponse(['data: {"error":"Rate limit"}\n']));

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledWith('Rate limit');
  });

  it('handles partial buffer (split across chunks)', async () => {
    const onToken = vi.fn();
    const client = new SSEClient({ onToken });

    global.fetch.mockResolvedValue(createMockResponse(['data: {"to', 'ken":"hi"}\n']));

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onToken).toHaveBeenCalledWith('hi');
  });

  it('ignores AbortError silently', async () => {
    const onError = vi.fn();
    const client = new SSEClient({ onError });

    global.fetch.mockRejectedValue({ name: 'AbortError' });

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onError).not.toHaveBeenCalled();
  });

  it('handles non-ok response with error message', async () => {
    const onError = vi.fn();
    const client = new SSEClient({ onError });

    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    client.send([]);
    await new Promise(r => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledWith('Bad request');
  });
});
