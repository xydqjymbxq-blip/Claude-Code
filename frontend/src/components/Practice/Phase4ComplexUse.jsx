import React, { useState, useRef, useEffect } from 'react';
import AudioRecorder from '../shared/AudioRecorder';
import AudioPlayer from '../shared/AudioPlayer';
import { practice } from '../../services/api';

const TOPICS = [
  { topic: 'Planning a trip', hint: 'Discuss what you need to bring and prepare' },
  { topic: 'Your daily routine', hint: 'Describe a typical day in detail' },
  { topic: 'A recent experience', hint: 'Tell me about something interesting that happened' },
  { topic: 'Your work or studies', hint: 'Explain what you do and what you find interesting' },
  { topic: 'Your hobbies', hint: 'Talk about what you enjoy doing in your free time' },
];

const REQUIRED_SUCCESSES = 2;

export default function Phase4ComplexUse({ word, words = [], onComplete, onSkip }) {
  const allTargetWords = [word, ...words].map(w => w.russian_word);
  const [stage, setStage] = useState('intro'); // intro | conversation | feedback | done
  const [topic] = useState(TOPICS[Math.floor(Math.random() * TOPICS.length)]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const conversationRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function startConversation() {
    setStage('conversation');
    setLoading(true);
    try {
      const reply = await practice.getConversationReply(
        `Давай поговорим о теме: ${topic.topic}. Начни разговор.`,
        topic.topic,
        allTargetWords,
        []
      );
      const aiMsg = { role: 'assistant', content: reply };
      conversationRef.current = [aiMsg];
      setMessages([aiMsg]);
    } catch {
      setMessages([{ role: 'assistant', content: 'Привет! Давай поговорим.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUserSpeech(text) {
    setLoading(true);

    const userMsg = { role: 'user', content: text };
    const newHistory = [...conversationRef.current, userMsg];
    conversationRef.current = newHistory;
    setMessages([...newHistory]);

    try {
      const reply = await practice.getConversationReply(text, topic.topic, allTargetWords, newHistory.slice(-6));
      const aiMsg = { role: 'assistant', content: reply };
      conversationRef.current = [...newHistory, aiMsg];
      setMessages([...newHistory, aiMsg]);
    } catch {
      const aiMsg = { role: 'assistant', content: 'Продолжай, пожалуйста!' };
      conversationRef.current = [...newHistory, aiMsg];
      setMessages([...newHistory, aiMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function finishConversation() {
    setLoading(true);
    const fullTranscript = conversationRef.current
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    try {
      const result = await practice.evaluateConversation({
        target_words: allTargetWords,
        transcript: fullTranscript,
        phase: 4,
        conversation_history: conversationRef.current,
      });
      setEvaluation(result);

      const newSuccessCount = result.advancement_eligible ? successCount + 1 : successCount;
      if (result.advancement_eligible) setSuccessCount(newSuccessCount);

      await practice.submitAttempt({
        vocabulary_item_id: word.id,
        phase_practiced: 4,
        attempt_type: 'complex_use',
        user_response: fullTranscript,
        accuracy_score: result.overall_accuracy,
        feedback_given: result.feedback,
        advance: newSuccessCount >= REQUIRED_SUCCESSES,
      });

      if (newSuccessCount >= REQUIRED_SUCCESSES) setStage('done');
      else setStage('feedback');
    } catch {
      setStage('feedback');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-2">
        <span className="phase-badge bg-orange-100 text-orange-700">Phase 4: Complex Use</span>
        <span className="text-sm text-gray-400">{successCount}/{REQUIRED_SUCCESSES} conversations</span>
      </div>

      {/* Intro */}
      {stage === 'intro' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Target vocabulary</p>
            <div className="flex flex-wrap gap-2">
              {allTargetWords.map((w, i) => (
                <span key={i} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="text-lg font-bold mb-1">Topic: {topic.topic}</p>
            <p className="text-gray-600 text-sm">{topic.hint}</p>
            <p className="text-xs text-gray-400 mt-2">Have a 60-90 second conversation naturally using the target words.</p>
          </div>

          <button onClick={startConversation} className="btn-primary w-full">
            Start Conversation
          </button>
        </div>
      )}

      {/* Conversation */}
      {stage === 'conversation' && (
        <div className="space-y-4">
          {/* Target words reminder */}
          <div className="flex flex-wrap gap-1">
            {allTargetWords.map((w, i) => (
              <span key={i} className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-xs">
                {w}
              </span>
            ))}
          </div>

          {/* Chat messages */}
          <div className="bg-gray-50 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1">
                      <AudioPlayer text={msg.content} size="sm" />
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border px-3 py-2 rounded-xl text-sm text-gray-400">
                  AI is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <AudioRecorder onTranscript={handleUserSpeech} disabled={loading} />

          {messages.filter(m => m.role === 'user').length >= 3 && (
            <button onClick={finishConversation} disabled={loading} className="btn-secondary w-full">
              Finish & Get Feedback
            </button>
          )}
        </div>
      )}

      {/* Feedback */}
      {stage === 'feedback' && evaluation && (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">{evaluation.overall_accuracy}%</div>
                <div className="text-xs text-gray-500">Overall</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{evaluation.grammar_score}%</div>
                <div className="text-xs text-gray-500">Grammar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-700">{evaluation.fluency_score}%</div>
                <div className="text-xs text-gray-500">Fluency</div>
              </div>
            </div>

            {/* Words used */}
            {evaluation.words_used && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-1">Target words:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(evaluation.words_used).map(([w, info]) => (
                    <span key={w} className={`px-2 py-0.5 rounded text-sm ${info.used && info.correct ? 'bg-green-100 text-green-700' : info.used ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {w} {info.used ? (info.correct ? '✓' : '△') : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {evaluation.feedback && <p className="text-sm text-gray-600 italic">{evaluation.feedback}</p>}
          </div>

          <div className="flex gap-3">
            <button onClick={startConversation} className="btn-secondary flex-1">
              Try again
            </button>
            <button onClick={() => onComplete?.(word)} className="btn-primary flex-1">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="text-center space-y-4">
          <div className="text-5xl">🚀</div>
          <h3 className="text-xl font-bold text-orange-700">Phase 4 Complete!</h3>
          <p className="text-gray-600">You're using these words naturally in conversation!</p>
          <button onClick={() => onComplete?.(word)} className="btn-success w-full">
            Advance to Phase 5 →
          </button>
        </div>
      )}

      {stage !== 'done' && stage !== 'conversation' && (
        <button onClick={onSkip} className="text-sm text-gray-400 underline text-center">Skip</button>
      )}
    </div>
  );
}
