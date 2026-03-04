import React, { useState, useEffect } from 'react';
import AudioPlayer from '../shared/AudioPlayer';
import AudioRecorder from '../shared/AudioRecorder';
import ProgressBar from '../shared/ProgressBar';
import { practice } from '../../services/api';

const PASS_THRESHOLD = 70;
const HIGH_PASS = 80;
const ATTEMPTS_FOR_ADVANCE = 2;

export default function Phase2Pronunciation({ word, onComplete, onSkip }) {
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [stage, setStage] = useState('listen'); // listen | practice | feedback | done

  useEffect(() => {
    // Auto-play on mount
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(word.russian_word);
      u.lang = 'ru-RU';
      u.rate = 0.75;
      window.speechSynthesis?.speak(u);
    }, 400);
  }, [word.russian_word]);

  async function handleTranscript(text) {
    setLoading(true);
    setStage('feedback');

    try {
      const result = await practice.evaluatePronunciation(word.russian_word, text);
      setEvaluation(result);

      const newAttempts = [...attempts, { transcript: text, score: result.accuracy_score, pass: result.pass }];
      setAttempts(newAttempts);

      const goodAttempts = newAttempts.filter(a => a.score >= PASS_THRESHOLD).length;
      const highAttempts = newAttempts.filter(a => a.score >= HIGH_PASS).length;
      const shouldAdvance = highAttempts >= ATTEMPTS_FOR_ADVANCE || (goodAttempts >= 3 && newAttempts.length >= 3);

      await practice.submitAttempt({
        vocabulary_item_id: word.id,
        phase_practiced: 2,
        attempt_type: 'pronunciation',
        user_response: text,
        accuracy_score: result.accuracy_score,
        feedback_given: result.tips,
        advance: shouldAdvance,
      });

      if (shouldAdvance) setStage('done');
    } catch (err) {
      setEvaluation({ error: true, tips: 'Could not evaluate. Try again.' });
    } finally {
      setLoading(false);
    }
  }

  function tryAgain() {
    setEvaluation(null);
    setStage('practice');
  }

  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center gap-2">
        <span className="phase-badge bg-purple-100 text-purple-700">Phase 2: Pronunciation</span>
        {attempts.length > 0 && <span className="text-sm text-gray-400">Attempt {attempts.length}</span>}
      </div>

      {/* Word display */}
      <div className="card w-full text-center">
        <div className="russian-text text-4xl font-bold text-blue-900 mb-2">
          {word.russian_word}
        </div>
        <p className="text-gray-600 mb-3">{word.english_definition}</p>
        <div className="flex justify-center gap-4 items-center">
          <AudioPlayer text={word.russian_word} size="lg" />
          <div className="text-sm text-gray-500">
            <button onClick={() => { const u = new SpeechSynthesisUtterance(word.russian_word); u.lang = 'ru-RU'; u.rate = 0.6; window.speechSynthesis?.speak(u); }}
              className="text-blue-500 underline">
              Slow version
            </button>
          </div>
        </div>
      </div>

      {/* Listen stage */}
      {stage === 'listen' && (
        <div className="w-full text-center space-y-4">
          <p className="text-gray-600">Listen carefully to the pronunciation, then try it yourself.</p>
          <button onClick={() => setStage('practice')} className="btn-primary w-full">
            I'm ready to practice
          </button>
        </div>
      )}

      {/* Practice stage */}
      {stage === 'practice' && (
        <div className="w-full space-y-4">
          <p className="text-center text-gray-600 text-sm">Say the word aloud in Russian:</p>
          <AudioRecorder onTranscript={handleTranscript} disabled={loading} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center">
          <div className="text-2xl animate-spin">⏳</div>
          <p className="text-sm text-gray-500 mt-2">Evaluating pronunciation...</p>
        </div>
      )}

      {/* Feedback */}
      {evaluation && stage === 'feedback' && !loading && (
        <div className="w-full space-y-4">
          <div className={`card ${evaluation.pass ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">{evaluation.pass ? '✓ Good!' : '△ Keep practicing'}</span>
              <span className="text-2xl font-bold">{evaluation.accuracy_score}%</span>
            </div>
            <ProgressBar value={evaluation.accuracy_score} max={100} color={evaluation.accuracy_score >= 80 ? 'green' : evaluation.accuracy_score >= 60 ? 'yellow' : 'red'} />

            {evaluation.correct_aspects?.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-green-700">What you did well:</p>
                <ul className="text-sm text-green-600 list-disc list-inside">
                  {evaluation.correct_aspects.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {evaluation.needs_improvement?.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-orange-700">Work on:</p>
                <ul className="text-sm text-orange-600 list-disc list-inside">
                  {evaluation.needs_improvement.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            {evaluation.tips && (
              <p className="text-sm text-gray-600 mt-2 italic">{evaluation.tips}</p>
            )}
          </div>

          {attempts.length > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Attempts: {attempts.length}</span>
              <span>Avg score: {avgScore}%</span>
              <span>Best: {Math.max(...attempts.map(a => a.score))}%</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={tryAgain} className="btn-secondary flex-1">
              Try Again
            </button>
            <button onClick={() => onComplete?.(word)} className="btn-primary flex-1">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="w-full text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h3 className="text-xl font-bold text-green-700">Pronunciation Mastered!</h3>
          <p className="text-gray-600">
            Average score: {avgScore}% — You're ready for sentence practice!
          </p>
          <button onClick={() => onComplete?.(word)} className="btn-success w-full">
            Advance to Phase 3 →
          </button>
        </div>
      )}

      {stage !== 'done' && (
        <button onClick={onSkip} className="text-sm text-gray-400 underline">
          Skip this word
        </button>
      )}
    </div>
  );
}
