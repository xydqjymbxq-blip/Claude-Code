const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function evaluatePronunciation(targetWord, userTranscript, userLevel = 'B1') {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are evaluating Russian pronunciation for a language learner (level: ${userLevel}).

Target word: "${targetWord}"
User said (transcription): "${userTranscript}"

Evaluate and return ONLY valid JSON (no markdown, no extra text):
{
  "accuracy_score": <0-100>,
  "correct_aspects": ["list", "of", "what", "was", "correct"],
  "needs_improvement": ["list", "of", "specific", "issues"],
  "stress_correct": <true/false>,
  "tips": "<one or two specific actionable tips>",
  "pass": <true if score >= 70, false otherwise>,
  "encouragement": "<brief encouraging message>"
}

Pay special attention to: stress placement, soft vs hard consonants, vowel reduction in unstressed syllables.`
    }]
  });

  try {
    return JSON.parse(message.content[0].text);
  } catch {
    return { accuracy_score: 60, pass: false, tips: 'Keep practicing!', encouragement: 'Good effort!' };
  }
}

async function evaluateSentence(targetWord, userSentence, userLevel = 'B1') {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `You are evaluating a Russian sentence from a ${userLevel} level learner practicing the word "${targetWord}".

User's sentence: "${userSentence}"

Evaluate and return ONLY valid JSON (no markdown, no extra text):
{
  "correct_usage": <true/false>,
  "grammar_correct": <true/false>,
  "grammar_notes": "<brief explanation of any grammar issues, or 'Perfect!' if none>",
  "makes_sense": <true/false>,
  "naturalness": <1-5>,
  "tip": "<one specific improvement tip, or empty string if perfect>",
  "advancement_eligible": <true if correct_usage and makes_sense and naturalness >= 3>,
  "praise": "<what they did well>",
  "corrected_version": "<corrected sentence if needed, or same sentence if correct>"
}`
    }]
  });

  try {
    return JSON.parse(message.content[0].text);
  } catch {
    return { correct_usage: true, grammar_correct: true, makes_sense: true, naturalness: 3, advancement_eligible: true, tip: '' };
  }
}

async function evaluateConversation(targetWords, conversationTranscript, userLevel = 'B1', phase = 4) {
  const pressureNote = phase === 5 ? 'This is real-time conversation practice, so also evaluate response timing and fluency.' : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    messages: [{
      role: 'user',
      content: `You are evaluating a Russian conversation from a ${userLevel} level learner. ${pressureNote}

Target words to use: ${targetWords.join(', ')}
Conversation transcript: "${conversationTranscript}"

Evaluate and return ONLY valid JSON (no markdown, no extra text):
{
  "words_used": {
    "<word>": {"used": <true/false>, "correct": <true/false>, "context": "<brief note>"}
  },
  "overall_accuracy": <0-100>,
  "grammar_score": <0-100>,
  "fluency_score": <0-100>,
  "grammar_highlights": ["list of grammar points - both correct and incorrect"],
  "advancement_eligible": <true if overall_accuracy >= 75>,
  "feedback": "<2-3 sentences of specific, encouraging feedback>",
  "strong_points": ["what they did well"],
  "improvement_areas": ["specific areas to work on"]
}`
    }]
  });

  try {
    return JSON.parse(message.content[0].text);
  } catch {
    return { overall_accuracy: 75, grammar_score: 75, fluency_score: 75, advancement_eligible: true, feedback: 'Good effort!' };
  }
}

async function generateAssessmentFeedback(word, response, type, userLevel = 'B1') {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Quickly assess this Russian vocabulary response for a ${userLevel} learner.

Word: "${word}"
Test type: ${type} (${type === 'recognition' ? 'user gives English meaning' : 'user says Russian word'})
User response: "${response}"

Return ONLY valid JSON:
{
  "correct": <true/false>,
  "confidence": <"high"|"medium"|"low">,
  "suggested_phase": <1-5 based on quality of response>,
  "notes": "<brief note>"
}`
    }]
  });

  try {
    return JSON.parse(message.content[0].text);
  } catch {
    return { correct: false, confidence: 'low', suggested_phase: 1 };
  }
}

async function generateConversationReply(userMessage, topic, targetWords, conversationHistory = [], userLevel = 'B1') {
  const history = conversationHistory.map(m => ({ role: m.role, content: m.content }));

  const systemPrompt = `You are a friendly Russian language conversation partner helping a ${userLevel} learner practice.
Topic: ${topic}
Target vocabulary to naturally elicit: ${targetWords.join(', ')}
Rules:
- Respond in Russian (keep responses 1-3 sentences for Phase 4, shorter for Phase 5)
- Be encouraging and natural
- Naturally use the target words in your responses when appropriate
- If the user doesn't use a target word, gently prompt for it
- Correct major errors kindly, ignore minor ones
- Keep the conversation flowing naturally`;

  const messages = [
    ...history,
    { role: 'user', content: userMessage }
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text;
}

module.exports = {
  evaluatePronunciation,
  evaluateSentence,
  evaluateConversation,
  generateAssessmentFeedback,
  generateConversationReply,
};
