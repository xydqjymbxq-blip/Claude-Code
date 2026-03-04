import React, { useState, useEffect } from 'react';
import Phase1Recognition from './Phase1Recognition';
import Phase2Pronunciation from './Phase2Pronunciation';
import Phase3SimpleSentence from './Phase3SimpleSentence';
import Phase4ComplexUse from './Phase4ComplexUse';
import Phase5RealTime from './Phase5RealTime';
import { practice } from '../../services/api';


export default function PracticeSession({ onFinish, goalMinutes = 20 }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalMinutes]);

  async function loadSession() {
    try {
      setLoading(true);
      const data = await practice.getSession(goalMinutes);

      // Flatten into queue: [{word, phase}]
      const q = [];
      for (let phase = 1; phase <= 5; phase++) {
        const phaseWords = data.session[`phase${phase}`] || [];
        phaseWords.forEach(word => q.push({ word, phase }));
      }

      setQueue(q);
      setCurrentIndex(0);
    } catch (err) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }

  function handleComplete(word) {
    setCompleted(c => [...c, word]);
    advanceQueue();
  }

  function handleSkip() {
    advanceQueue();
  }

  function advanceQueue() {
    setCurrentIndex(i => i + 1);
  }

  const current = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;
  const progress = queue.length > 0 ? Math.round((currentIndex / queue.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="text-3xl animate-spin">⏳</div>
        <p className="text-gray-600">Building your practice session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-4 py-8">
        <p className="text-red-500">{error}</p>
        <button onClick={loadSession} className="btn-primary">Try again</button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-5xl">✅</div>
        <h3 className="text-xl font-bold">All caught up!</h3>
        <p className="text-gray-600">No words are due for practice right now. Come back later or add more vocabulary.</p>
        <button onClick={onFinish} className="btn-primary">Back to dashboard</button>
      </div>
    );
  }

  if (isFinished) {
    const minutes = Math.round((Date.now() - startTime) / 60000);
    return (
      <div className="text-center space-y-6 py-8">
        <div className="text-6xl">🎊</div>
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <div className="card max-w-sm mx-auto text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Words practiced</span>
            <span className="font-bold">{completed.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Time spent</span>
            <span className="font-bold">{minutes} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Session words</span>
            <span className="font-bold">{queue.length}</span>
          </div>
        </div>
        <button onClick={onFinish} className="btn-success w-full max-w-sm mx-auto block">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { word, phase } = current;

  return (
    <div className="flex flex-col gap-4">
      {/* Session progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-gray-500 shrink-0">{currentIndex}/{queue.length}</span>
        <button onClick={onFinish} className="text-xs text-gray-400 shrink-0">✕ End</button>
      </div>

      {/* Phase component */}
      {phase === 1 && <Phase1Recognition word={word} onComplete={handleComplete} onSkip={handleSkip} />}
      {phase === 2 && <Phase2Pronunciation word={word} onComplete={handleComplete} onSkip={handleSkip} />}
      {phase === 3 && <Phase3SimpleSentence word={word} onComplete={handleComplete} onSkip={handleSkip} />}
      {phase === 4 && <Phase4ComplexUse word={word} onComplete={handleComplete} onSkip={handleSkip} />}
      {phase === 5 && <Phase5RealTime word={word} onComplete={handleComplete} onSkip={handleSkip} />}
    </div>
  );
}
