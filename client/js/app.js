import SSEClient from './sse.js';

const state = {
  messages: [],
  loading: false,
  config: {
    endpoint: '',
    temperature: 0.7,
    maxTokens: 1024,
  },
};

let sseClient = null;

const $ = (sel) => document.querySelector(sel);
const chatContainer = $('#chat-container');
const inputArea = $('#input-area textarea');
const sendBtn = $('#send-btn');
const settingsPanel = $('#settings-panel');
const settingsToggle = $('#settings-toggle');
const settingsForm = $('#settings-form');
const clearBtn = $('#clear-btn');
const themeBtn = $('#theme-btn');
const typingIndicator = $('#typing-indicator');

function init() {
  loadSettings();
  loadTheme();
  sseClient = new SSEClient({
    onToken: handleToken,
    onDone: handleDone,
    onError: handleError,
  });
  showWelcome();
  bindEvents();
  if (!state.config.endpoint) {
    openSettings();
  }
}

function bindEvents() {
  sendBtn.addEventListener('click', sendMessage);
  inputArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputArea.addEventListener('input', autoResize);
  settingsToggle.addEventListener('click', toggleSettings);
  settingsForm.addEventListener('submit', saveSettings);
  clearBtn.addEventListener('click', clearChat);
  themeBtn.addEventListener('click', toggleTheme);
}

function sendMessage() {
  const content = inputArea.value.trim();
  if (!content || state.loading) return;

  if (!state.config.endpoint) {
    alert('Configure o endpoint do RunPod nas configuracoes.');
    openSettings();
    return;
  }

  state.messages.push({ role: 'user', content });
  inputArea.value = '';
  autoResize();
  state.loading = true;

  const assistantIdx = state.messages.push({ role: 'assistant', content: '' }) - 1;

  render();
  showTyping(true);

  const apiMessages = state.messages.slice(0, assistantIdx);
  sseClient.send(apiMessages, state.config);
}

function handleToken(token) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    lastMsg.content += token;
    render();
  }
}

function handleDone() {
  state.loading = false;
  showTyping(false);
  render();
}

function handleError(err) {
  state.loading = false;
  showTyping(false);

  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content.trim()) {
    state.messages.pop();
  }

  state.messages.push({ role: 'system', content: 'Erro: ' + err });
  render();
}

function render() {
  chatContainer.innerHTML = '';

  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i];
    const msgEl = document.createElement('div');
    msgEl.className = 'message ' + msg.role;

    if (msg.role !== 'system') {
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = msg.role === 'user' ? 'U' : 'A';
      msgEl.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.role === 'user') {
      bubble.textContent = msg.content;
    } else if (msg.role === 'assistant') {
      bubble.innerHTML = formatMarkdown(msg.content);

      if (msg.content && !state.loading) {
        const actions = document.createElement('div');
        actions.className = 'actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.title = 'Copiar';
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(msg.content);
        });
        actions.appendChild(copyBtn);
        bubble.appendChild(actions);
      }
    } else if (msg.role === 'system') {
      bubble.style.color = 'var(--error)';
      bubble.textContent = msg.content;
    }

    msgEl.appendChild(bubble);
    chatContainer.appendChild(msgEl);
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function formatMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return '<pre><code class="language-' + (lang || 'text') + '">' + code.trim() + '</code></pre>';
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

function showTyping(show) {
  typingIndicator.classList.toggle('hidden', !show);
}

function showWelcome() {
  state.messages.push({
    role: 'assistant',
    content: 'Ola! Eu sou ChatAI, seu assistente com inteligencia artificial. Digite sua mensagem para comecar.',
  });
  render();
}

function autoResize() {
  inputArea.style.height = 'auto';
  inputArea.style.height = Math.min(inputArea.scrollHeight, 200) + 'px';
}

function toggleSettings() {
  settingsPanel.classList.toggle('open');
}

function openSettings() {
  settingsPanel.classList.add('open');
}

function saveSettings(e) {
  e.preventDefault();
  const formData = new FormData(settingsForm);
  state.config.endpoint = formData.get('endpoint').trim();
  state.config.temperature = parseFloat(formData.get('temperature')) || 0.7;
  state.config.maxTokens = parseInt(formData.get('max_tokens'), 10) || 1024;
  localStorage.setItem('chat-ai-config', JSON.stringify(state.config));
  settingsPanel.classList.remove('open');
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('chat-ai-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.config.endpoint = parsed.endpoint || '';
      state.config.temperature = parsed.temperature || 0.7;
      state.config.maxTokens = parsed.maxTokens || 1024;

      const endpointInput = document.querySelector('[name="endpoint"]');
      const tempInput = document.querySelector('[name="temperature"]');
      const tokensInput = document.querySelector('[name="max_tokens"]');
      if (endpointInput) endpointInput.value = state.config.endpoint;
      if (tempInput) tempInput.value = state.config.temperature;
      if (tokensInput) tokensInput.value = state.config.maxTokens;
    }
  } catch {}
}

function clearChat() {
  if (state.messages.length <= 1) return;
  if (!confirm('Tem certeza que deseja limpar o historico da conversa?')) return;
  state.messages = [];
  state.loading = false;
  sseClient.abort();
  showTyping(false);
  showWelcome();
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('chat-ai-theme', next);
}

function loadTheme() {
  const saved = localStorage.getItem('chat-ai-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

document.addEventListener('DOMContentLoaded', init);
