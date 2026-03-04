import React, { useState, useEffect } from 'react';
import { assessment } from '../../services/api';
import AudioPlayer from '../shared/AudioPlayer';

const TEST_TYPES = ['recognition', 'production'];

export default function InitialAssessment({ onComplete }) {
  const [stage, setStage] = useState('loading'); // loading | intro | testing | complete | error
  const [words, setWords] = useState([]);
  const [totalWords, setTotalWords] = useState(0);
  const [sampleSize, setSampleSize] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testType, setTestType] = useState('recognition');
  const [response, setResponse] = useState('');
  const [results, setResults] = useState([]);
  const [lastEval, setLastEval] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState(null);

  useEffect(() => {
    loadAssessment();
  }, []);

  async function loadAssessment() {
    try {
      const data = await assessment.start(150);
      setWords(data.words);
      setTotalWords(data.total_words);
      setSampleSize(data.sample_size);
      setStage('intro');
    } catch (err) {
      setStage('error');
    }
  }

  async function submitAnswer() {
    if (!response.trim()) return;
    setLoading(true);

    const word = words[currentIndex];
    try {
      const result = await assessment.submitAnswer(word.id, testType, response);
      const newResult = {
        word_id: word.id,
        suggested_phase: result.evaluation.suggested_phase || 1,
        correct: result.evaluation.correct,
      };
      const newResults = [...results, newResult];
      setResults(newResults);
      setLastEval(result.evaluation);

      setResponse('');

      // Alternate test types
      if (currentIndex + 1 < words.length) {
        setTestType(TEST_TYPES[(currentIndex + 1) % 2]);
        setCurrentIndex(i => i + 1);
        setLastEval(null);
      } else {
        // Done testing, complete assessment
        await completeAssessment(newResults);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function completeAssessment(finalResults) {
    setStage('loading');
    try {
      const data = await assessment.complete(finalResults);
      setProjection(data.projection);
      setStage('complete');
    } catch {
      setStage('complete');
    }
  }

  const currentWord = words[currentIndex];
  const progress = words.length > 0 ? Math.round((currentIndex / words.length) * 100) : 0;

  return (
    <div className="space-y-4 py-4">
      {stage === 'loading' && (
        <div className="text-center py-12">
          <div className="text-3xl animate-spin mb-3">⏳</div>
          <p className="text-gray-600">Preparing assessment...</p>
        </div>
      )}

      {stage === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Failed to load assessment. Please import vocabulary first.</p>
          <button onClick={onComplete} className="btn-primary">Continue</button>
        </div>
      )}

      {stage === 'intro' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-3">🔍</div>
            <h2 className="text-xl font-bold">Smart Assessment</h2>
            <p className="text-gray-600 text-sm mt-1">
              We'll test {sampleSize} of your {totalWords.toLocaleString()} words to estimate your proficiency distribution.
            </p>
          </div>

          <div className="card space-y-2">
            <p className="font-medium">What to expect:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Recognition: See Russian → give English meaning</li>
              <li>• Production: See English → say Russian word</li>
              <li>• Takes about 10-15 minutes</li>
              <li>• Results auto-assign your vocabulary to phases</li>
            </ul>
          </div>

          <button onClick={() => setStage('testing')} className="btn-primary w-full">
            Start Assessment
          </button>
          <button onClick={onComplete} className="btn-secondary w-full">
            Skip (assign all to Phase 1)
          </button>
        </div>
      )}

      {stage === 'testing' && currentWord && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm text-gray-500">{currentIndex}/{words.length}</span>
          </div>

          {/* Test card */}
          <div className="card text-center">
            <span className={`phase-badge mb-4 ${testType === 'recognition' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {testType === 'recognition' ? '👁 Recognition' : '🗣 Production'}
            </span>

            {testType === 'recognition' ? (
              <>
                <div className="russian-text text-4xl font-bold text-blue-900 mb-3">{currentWord.russian_word}</div>
                <div className="flex justify-center mb-3">
                  <AudioPlayer text={currentWord.russian_word} size="lg" />
                </div>
                <p className="text-sm text-gray-500">What does this mean in English?</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-800 mb-3">{currentWord.english_definition}</p>
                <p className="text-sm text-gray-500">What's the Russian word?</p>
              </>
            )}
          </div>

          {/* Last evaluation feedback */}
          {lastEval && (
            <div className={`card text-sm ${lastEval.correct ? 'border-green-200 bg-green-50' : 'border-red-100 bg-red-50'}`}>
              <p className={lastEval.correct ? 'text-green-700' : 'text-red-600'}>
                {lastEval.correct ? '✓ Correct!' : '✗ Incorrect'} — Phase {lastEval.suggested_phase} assigned
              </p>
            </div>
          )}

          {/* Response */}
          <div className="space-y-2">
            <input
              type="text"
              value={response}
              onChange={e => setResponse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={testType === 'recognition' ? 'Type English meaning...' : 'Type Russian word...'}
              autoFocus
            />
            <button onClick={submitAnswer} disabled={!response.trim() || loading} className="btn-primary w-full">
              {loading ? 'Evaluating...' : 'Submit'}
            </button>
            <button
              onClick={() => {
                const skippedResult = { word_id: currentWord.id, suggested_phase: 1, correct: false };
                const newResults = [...results, skippedResult];
                setResults(newResults);
                if (currentIndex + 1 < words.length) {
                  setCurrentIndex(i => i + 1);
                  setTestType(TEST_TYPES[(currentIndex + 1) % 2]);
                } else {
                  completeAssessment(newResults);
                }
              }}
              className="text-sm text-gray-400 w-full text-center"
            >
              Skip this word
            </button>
          </div>
        </div>
      )}

      {stage === 'complete' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-3">📊</div>
            <h2 className="text-xl font-bold">Assessment Complete!</h2>
            <p className="text-gray-600 text-sm">Your vocabulary has been categorized.</p>
          </div>

          {projection && (
            <div className="card">
              <p className="font-medium mb-3">Estimated Phase Distribution:</p>
              {[
                ['Phase 5 (Mastered)', '5', 'text-red-600'],
                ['Phase 4 (Complex Use)', '4', 'text-orange-600'],
                ['Phase 3 (Sentences)', '3', 'text-green-600'],
                ['Phase 2 (Pronunciation)', '2', 'text-purple-600'],
                ['Phase 1 (Recognition)', '1', 'text-blue-600'],
              ].map(([label, phase, color]) => (
                <div key={phase} className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`font-bold ${color}`}>{projection[phase] || 0}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={onComplete} className="btn-primary w-full">
            Start Practicing →
          </button>
        </div>
      )}
    </div>
  );
}
