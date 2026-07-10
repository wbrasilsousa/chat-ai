import SSEClient from './sse.js';
import { formatMarkdown } from './markdown.js';

const state = {
  messages: [],
  loading: false,
};

let sseClient = null;
let streamingBubbleEl = null;
let expanded = false;
let isFirstToken = true;
let rafId = null;

const $ = (sel) => document.querySelector(sel);
const chatContainer = $('#chat-container');
const inputArea = $('#input-area textarea');
const sendBtn = $('#send-btn');
const clearBtn = $('#clear-btn');
const themeBtn = $('#theme-btn');

function init() {
  loadTheme();
  sseClient = new SSEClient({
    onToken: handleToken,
    onDone: handleDone,
    onError: handleError,
  });
  bindEvents();
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
  clearBtn.addEventListener('click', clearChat);
  themeBtn.addEventListener('click', toggleTheme);
}

function sendMessage() {
  if (!expanded) {
    expanded = true;
    const app = document.querySelector('.app');
    app.classList.remove('initial');
    app.classList.add('expanded');
  }

  const content = inputArea.value.trim();
  if (!content || state.loading) return;

  state.messages.push({ role: 'user', content });
  inputArea.value = '';
  autoResize();
  state.loading = true;

  const assistantIdx = state.messages.push({ role: 'assistant', content: '' }) - 1;
  isFirstToken = true;

  render();
  streamingBubbleEl = chatContainer.lastElementChild?.querySelector('.bubble');
  if (streamingBubbleEl) {
    streamingBubbleEl.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  }

  const apiMessages = state.messages.slice(0, assistantIdx);
  sseClient.send(apiMessages);
}

function scheduleRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const el = streamingBubbleEl || chatContainer.lastElementChild?.querySelector('.bubble');
    if (el && state.messages.length > 0) {
      const lastMsg = state.messages[state.messages.length - 1];
      el.innerHTML = formatMarkdown(lastMsg.content) + '<span class="typing-cursor">|</span>';
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
}

function handleToken(token) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    if (isFirstToken) {
      token = token.replace(/^\s+/, '');
      isFirstToken = false;
    }
    lastMsg.content += token;
    scheduleRender();
  }
}

function createCopyButton(content) {
  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.title = 'Copiar';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>';
  btn.addEventListener('click', () => navigator.clipboard.writeText(content));
  return btn;
}

function handleDone() {
  state.loading = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (streamingBubbleEl) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.content) {
      streamingBubbleEl.innerHTML = formatMarkdown(lastMsg.content);
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.appendChild(createCopyButton(lastMsg.content));
      streamingBubbleEl.appendChild(actions);
    } else {
      if (lastMsg && lastMsg.role === 'assistant') {
        state.messages.pop();
      }
      render();
    }
    streamingBubbleEl = null;
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function handleError(err) {
  state.loading = false;
  streamingBubbleEl = null;

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

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.role === 'user') {
      bubble.textContent = msg.content;
    } else if (msg.role === 'assistant') {
      bubble.innerHTML = formatMarkdown(msg.content);

      if (msg.content && !state.loading) {
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.appendChild(createCopyButton(msg.content));
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

function clearChat() {
  if (state.messages.length <= 1) return;
  if (!confirm('Tem certeza que deseja limpar o historico da conversa?')) return;
  state.messages = [];
  state.loading = false;
  sseClient.abort();
  streamingBubbleEl = null;
  expanded = false;
  const app = document.querySelector('.app');
  app.classList.remove('expanded');
  app.classList.add('initial');
  chatContainer.innerHTML = '';
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

init();
