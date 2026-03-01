const FormData = require('form-data');

async function transcribeWithWhisper(audioBuffer, filename = 'audio.webm') {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const { default: fetch } = await import('node-fetch');
  const formData = new FormData();
  formData.append('file', audioBuffer, { filename, contentType: 'audio/webm' });
  formData.append('model', 'whisper-1');
  formData.append('language', 'ru');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      ...formData.getHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.text;
}

module.exports = { transcribeWithWhisper };
