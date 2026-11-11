/** Real Ollama API client; never returns a canned agent reply. */
export function ollamaOrigin(value = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434') {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') {
    throw Error('Invalid OLLAMA_BASE_URL');
  }
  if (u.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) {
    throw Error('Remote Ollama needs private HTTPS connection');
  }
  return u.origin;
}

export function chooseModel(names, model = 'auto') {
  if (!names.length) throw Error('Brak modelu w Ollama. Użyj ollama pull MODEL na hoście.');
  if (model !== 'auto') {
    const found = names.find((n) => n === model) || names.find((n) => n.startsWith(model + ':'));
    if (!found) throw Error('Model ' + model + ' niedostępny. Zainstalowane: ' + names.join(', '));
    return found;
  }
  return (
    names.find((n) => /llama3\.2[-:]vision|vision.*11b|llama3\.2:11b/i.test(n)) ||
    names.find((n) => /14b|qwen|dolphin/i.test(n)) ||
    names[0]
  );
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(process.env.OLLAMA_API_KEY ? { Authorization: 'Bearer ' + process.env.OLLAMA_API_KEY } : {}),
  };
}

// Shared inference concurrency limiter
const maxConcurrency = Math.max(1, Number(process.env.OLLAMA_MAX_CONCURRENCY || 2));
let activeRequests = 0;
const waitQueue = [];

async function withInferenceSlot(fn) {
  if (activeRequests >= maxConcurrency) {
    await new Promise((resolve) => waitQueue.push(resolve));
  }
  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
    const next = waitQueue.shift();
    if (next) next();
  }
}

export function getInferenceQueueStatus() {
  return {
    activeRequests,
    queuedRequests: waitQueue.length,
    maxConcurrency,
  };
}

export async function ollamaVersion() {
  const url = ollamaOrigin();
  const response = await fetch(url + '/api/version', { headers: headers(), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Ollama /api/version HTTP ' + response.status);
  const data = await response.json();
  return typeof data?.version === 'string' ? data.version : 'unknown';
}

export async function ollamaPs() {
  const url = ollamaOrigin();
  const response = await fetch(url + '/api/ps', { headers: headers(), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Ollama /api/ps HTTP ' + response.status);
  const data = await response.json();
  return Array.isArray(data?.models) ? data.models : [];
}

export async function ollamaShow(modelName) {
  const url = ollamaOrigin();
  const response = await fetch(url + '/api/show', {
    method: 'POST',
    headers: headers(),
    signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ name: modelName }),
  });
  if (!response.ok) throw Error('Ollama /api/show HTTP ' + response.status);
  return response.json();
}

export async function ollamaEmbed(input, modelName) {
  const url = ollamaOrigin();
  const targetModel = modelName || process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  const response = await fetch(url + '/api/embed', {
    method: 'POST',
    headers: headers(),
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ model: targetModel, input }),
  });
  if (!response.ok) throw Error('Ollama /api/embed HTTP ' + response.status);
  return response.json();
}

export async function ollamaGenerate(prompt, options = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Error('Pusty prompt');
  const { url, model } = await probeOllama();
  const targetModel = options.model || model;
  return withInferenceSlot(async () => {
    const response = await fetch(url + '/api/generate', {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({
        model: targetModel,
        prompt,
        stream: false,
        ...(Array.isArray(options.images) && options.images.length ? { images: options.images } : {}),
      }),
    });
    if (!response.ok) throw Error('Ollama /api/generate HTTP ' + response.status);
    const data = await response.json();
    const content = typeof data?.response === 'string' ? data.response.trim() : '';
    if (!content) throw Error('Ollama zwróciła pustą odpowiedź');
    return { content: content.slice(0, 16000), model: targetModel };
  });
}

export async function probeOllama() {
  const url = ollamaOrigin();
  const response = await fetch(url + '/api/tags', { headers: headers(), signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw Error('Ollama /api/tags HTTP ' + response.status);
  const obj = await response.json();
  if (!Array.isArray(obj?.models)) throw Error('Ollama returned invalid model list');
  const models = obj.models.map((x) => x?.name).filter((x) => typeof x === 'string' && x.length);
  return { url, model: chooseModel(models, process.env.OLLAMA_MODEL || 'auto'), models };
}

export async function answerAgent(agent, question, options = {}) {
  if (typeof question !== 'string' || !question.trim()) throw Error('Puste zadanie');
  const { url, model } = await probeOllama();
  return withInferenceSlot(async () => {
    const userMsg = {
      role: 'user',
      content: question,
      ...(Array.isArray(options.images) && options.images.length ? { images: options.images } : {}),
    };
    const response = await fetch(url + '/api/chat', {
      method: 'POST',
      headers: headers(),
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Jesteś agentem ' +
              agent +
              ' Bastilla OS. Odpowiadaj po polsku. Ten kanał nie wykonuje komend ani nie posiada narzędzi do modyfikacji hosta. Nie twierdź, że wykonałeś operacje root, zmieniłeś pliki lub przetestowałeś aplikację bez faktycznych wyników narzędzi. Odróżniaj zalecenia od działań wykonanych.',
          },
          userMsg,
        ],
      }),
    });
    if (!response.ok) throw Error('Ollama /api/chat HTTP ' + response.status);
    const data = await response.json();
    const content = typeof data?.message?.content === 'string' ? data.message.content.trim() : '';
    if (!content) throw Error('Ollama zwróciła pustą odpowiedź');
    return { content: content.slice(0, 16000), model };
  });
}
