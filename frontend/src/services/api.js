const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

async function uploadFile(path, formData) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export const auth = {
  register: (email, password, russian_level) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, russian_level }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

export const vocabulary = {
  import: (formData) => uploadFile('/vocabulary/import', formData),
  importWords: (words) => request('/vocabulary/import', { method: 'POST', body: JSON.stringify({ words }) }),
  getAll: (params = {}) => request(`/vocabulary?${new URLSearchParams(params)}`),
  getPhase: (phase, limit) => request(`/vocabulary/phase/${phase}?limit=${limit || 20}`),
  getById: (id) => request(`/vocabulary/${id}`),
  update: (id, data) => request(`/vocabulary/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/vocabulary/${id}`, { method: 'DELETE' }),
};

export const practice = {
  getSession: (minutes) => request(`/practice/session${minutes ? `?minutes=${minutes}` : ''}`),
  submitAttempt: (data) => request('/practice/attempt', { method: 'POST', body: JSON.stringify(data) }),
  evaluatePronunciation: (target_word, transcript) => request('/practice/evaluate/pronunciation', { method: 'POST', body: JSON.stringify({ target_word, transcript }) }),
  evaluateSentence: (target_word, sentence) => request('/practice/evaluate/sentence', { method: 'POST', body: JSON.stringify({ target_word, sentence }) }),
  evaluateConversation: (data) => request('/practice/evaluate/conversation', { method: 'POST', body: JSON.stringify(data) }),
  getConversationReply: (user_message, topic, target_words, conversation_history) =>
    request('/practice/evaluate/conversation', { method: 'POST', body: JSON.stringify({ user_message, topic, target_words, conversation_history }) }),
  transcribeAudio: (audioBlob) => {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'audio.webm');
    return uploadFile('/practice/transcribe', fd);
  },
};

export const progress = {
  getDashboard: () => request('/progress/dashboard'),
  getStats: (days) => request(`/progress/stats${days ? `?days=${days}` : ''}`),
  getStreak: () => request('/progress/streak'),
  getWordHistory: (id) => request(`/progress/word/${id}/history`),
};

export const assessment = {
  start: (sample_size) => request('/assessment/start', { method: 'POST', body: JSON.stringify({ sample_size }) }),
  submitAnswer: (word_id, test_type, response) => request('/assessment/answer', { method: 'POST', body: JSON.stringify({ word_id, test_type, response }) }),
  complete: (results) => request('/assessment/complete', { method: 'POST', body: JSON.stringify({ results }) }),
  getStatus: () => request('/assessment/status'),
};
