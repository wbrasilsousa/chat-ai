class SSEClient {
  constructor(callbacks = {}) {
    this.onToken = callbacks.onToken || (() => {});
    this.onDone = callbacks.onDone || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.abortController = null;
    this.timeout = callbacks.timeout || 180000;
    this._timeoutId = null;
  }

  send(messages) {
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();

    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
    this._timeoutId = setTimeout(() => {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      this.onError('Tempo limite excedido (180s)');
    }, this.timeout);

    fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: this.abortController.signal,
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Erro no servidor'); });
      }
      return this._readStream(response);
    })
    .catch(err => {
      if (err.name === 'AbortError') return;
      this.onError(err.message);
    });
  }

  async _readStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!line || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') {
          this.onDone();
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            this.onError(parsed.error);
            return;
          }
          if (parsed.token) {
            this.onToken(parsed.token);
          }
        } catch {
          // skip
        }
      }
    }

    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    if (buffer.trim() && buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6);
      if (data === '[DONE]') {
        this.onDone();
      } else {
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) this.onToken(parsed.token);
        } catch {}
      }
    }
  }

  abort() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export default SSEClient;
