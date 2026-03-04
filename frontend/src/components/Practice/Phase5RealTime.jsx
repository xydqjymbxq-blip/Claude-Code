import React, { useState, useRef, useEffect } from 'react';
import AudioPlayer from '../shared/AudioPlayer';
import { practice } from '../../services/api';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

const RESPOND_SECONDS = 8;
const SESSION_DURATION_MINUTES = 10;

const QUICK_TOPICS = [
  'Что ты любишь делать в выходные?',
  'Расскажи о своей работе или учёбе.',
  'Что для тебя самое важное в жизни?',
  'Опиши идеальный день.',
  'Что ты обычно делаешь утром?',
  'Расскажи о своём любимом месте.',
];

export default function Phase5RealTime({ word, words = [], onComplete, onSkip }) {
  const allTargetWords = [word, ...words].map(w => w.russian_word);
  const [stage, setStage] = useState('intro'); // intro | live | pause | done
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(RESPOND_SECONDS);
  const [sessionTime, setSessionTime] = useState(SESSION_DURATION_MINUTES * 60);
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [topicIndex, setTopicIndex] = useState(0);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const conversationRef = useRef([]);
  const timerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { isListening, start: startRecognition, stop: stopRecognition, reset: resetTranscript } = useSpeechRecognition({
    lang: 'ru-RU',
    onResult: handleSpeech,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(sessionTimerRef.current);
    };
  }, []);

  async function startSession() {
    setStage('live');
    setLoading(true);

    // Start session timer
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(t => {
        if (t <= 1) {
          clearInterval(sessionTimerRef.current);
          endSession();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    try {
      const firstQ = QUICK_TOPICS[0];
      const aiMsg = { role: 'assistant', content: firstQ };
      conversationRef.current = [aiMsg];
      setMessages([aiMsg]);
      startResponseTimer();
    } finally {
      setLoading(false);
    }
  }

  function startResponseTimer() {
    setWaitingForUser(true);
    setTimeLeft(RESPOND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Auto-start listening when timer hits 0
          startRecognition();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  async function handleSpeech(text) {
    if (!text.trim()) return;
    clearInterval(timerRef.current);
    setWaitingForUser(false);
    setLoading(true);
    resetTranscript();

    const userMsg = { role: 'user', content: text };
    const newHistory = [...conversationRef.current, userMsg];
    conversationRef.current = newHistory;
    setMessages([...newHistory]);

    try {
      const nextTopic = QUICK_TOPICS[(topicIndex + 1) % QUICK_TOPICS.length];
      const reply = await practice.getConversationReply(
        text,
        nextTopic,
        allTargetWords,
        newHistory.slice(-4)
      );
      const aiMsg = { role: 'assistant', content: reply };
      conversationRef.current = [...newHistory, aiMsg];
      setMessages([...newHistory, aiMsg]);
      setTopicIndex(i => i + 1);
      startResponseTimer();
    } catch {
      const aiMsg = { role: 'assistant', content: 'Продолжай!' };
      conversationRef.current = [...newHistory, aiMsg];
      setMessages([...newHistory, aiMsg]);
      startResponseTimer();
    } finally {
      setLoading(false);
    }
  }

  async function endSession() {
    clearInterval(timerRef.current);
    clearInterval(sessionTimerRef.current);
    stopRecognition();
    setStage('pause');
    setLoading(true);

    const fullTranscript = conversationRef.current
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    try {
      const result = await practice.evaluateConversation({
        target_words: allTargetWords,
        transcript: fullTranscript,
        phase: 5,
        conversation_history: conversationRef.current,
      });
      setEvaluation(result);

      await practice.submitAttempt({
        vocabulary_item_id: word.id,
        phase_practiced: 5,
        attempt_type: 'real_time',
        user_response: fullTranscript,
        accuracy_score: result.overall_accuracy,
        feedback_given: result.feedback,
        advance: result.advancement_eligible,
      });

      if (result.advancement_eligible) setStage('done');
    } catch {
      setStage('done');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-2">
        <span className="phase-badge bg-red-100 text-red-700">Phase 5: Real-Time</span>
        {stage === 'live' && (
          <span className="text-sm font-mono text-red-500">{formatTime(sessionTime)}</span>
        )}
      </div>

      {/* Target words */}
      <div className="flex flex-wrap gap-1">
        {allTargetWords.map((w, i) => (
          <span key={i} className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-medium">{w}</span>
        ))}
      </div>

      {/* Intro */}
      {stage === 'intro' && (
        <div className="space-y-4">
          <div className="card border-red-200">
            <h3 className="font-bold text-red-700 text-lg mb-2">Live Conversation Mode</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Respond within {RESPOND_SECONDS} seconds</li>
              <li>• {SESSION_DURATION_MINUTES} minute session</li>
              <li>• Topics change rapidly</li>
              <li>• Use target words naturally</li>
            </ul>
          </div>
          <button onClick={startSession} className="btn-danger w-full text-lg py-4">
            🔴 START LIVE SESSION
          </button>
          <button onClick={onSkip} className="btn-secondary w-full">Skip for now</button>
        </div>
      )}

      {/* Live conversation */}
      {stage === 'live' && (
        <div className="space-y-3">
          {/* Chat */}
          <div className="bg-gray-900 rounded-xl p-3 max-h-72 overflow-y-auto space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                }`}>
                  {msg.role === 'assistant' && (
                    <AudioPlayer text={msg.content} size="sm" />
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 px-3 py-2 rounded-xl text-sm text-gray-300">...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Timer & mic */}
          {waitingForUser && !loading && (
            <div className="text-center space-y-2">
              <div className={`text-4xl font-bold font-mono ${timeLeft <= 3 ? 'text-red-500' : 'text-blue-600'}`}>
                {timeLeft}s
              </div>
              <button
                onClick={() => { clearInterval(timerRef.current); startRecognition(); }}
                className={`mic-button mx-auto ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}
              >
                🎤
              </button>
              <p className="text-xs text-gray-400">
                {isListening ? 'Listening...' : 'Tap mic or wait for auto-start'}
              </p>
            </div>
          )}

          <button onClick={endSession} disabled={loading} className="btn-secondary w-full text-sm">
            End session & get feedback
          </button>
        </div>
      )}

      {/* Feedback */}
      {stage === 'pause' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-2xl animate-spin">⏳</div>
              <p className="text-gray-500 mt-2">Analyzing your conversation...</p>
            </div>
          ) : evaluation ? (
            <div className="space-y-4">
              <div className="card">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{evaluation.fluency_score}%</div>
                    <div className="text-xs text-gray-500">Fluency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{evaluation.overall_accuracy}%</div>
                    <div className="text-xs text-gray-500">Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{evaluation.grammar_score}%</div>
                    <div className="text-xs text-gray-500">Grammar</div>
                  </div>
                </div>

                {evaluation.words_used && (
                  <div className="mb-2">
                    <p className="text-sm font-medium mb-1">Words used:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(evaluation.words_used).map(([w, info]) => (
                        <span key={w} className={`px-2 py-0.5 rounded text-xs ${info.used && info.correct ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {w} {info.used ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evaluation.feedback && <p className="text-sm text-gray-600">{evaluation.feedback}</p>}
              </div>

              <div className="flex gap-3">
                <button onClick={startSession} className="btn-secondary flex-1">Try again</button>
                <button onClick={() => onComplete?.(word)} className="btn-primary flex-1">Done →</button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Mastered! */}
      {stage === 'done' && (
        <div className="text-center space-y-4">
          <div className="text-6xl">🏆</div>
          <h3 className="text-2xl font-bold text-red-700">MASTERED!</h3>
          <p className="text-gray-600">
            "{word.russian_word}" is now in your active vocabulary!
          </p>
          <div className="bg-gold-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-700">This word will be reviewed in 7 days to keep it sharp.</p>
          </div>
          <button onClick={() => onComplete?.(word)} className="btn-success w-full text-lg">
            🎊 Continue
          </button>
        </div>
      )}
    </div>
  );
}
