import React, { useState, useEffect } from 'react';
import AudioPlayer from '../shared/AudioPlayer';
import { practice } from '../../services/api';


export default function Phase1Recognition({ word, onComplete, onSkip }) {
  const [viewCount, setViewCount] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const TARGET_VIEWS = 3;

  useEffect(() => {
    // Auto-play pronunciation on mount
    const timer = setTimeout(() => {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(word.russian_word);
      u.lang = 'ru-RU';
      u.rate = 0.8;
      window.speechSynthesis?.speak(u);
    }, 500);
    return () => clearTimeout(timer);
  }, [word.russian_word]);

  async function handleNext() {
    const newCount = viewCount + 1;
    setViewCount(newCount);
    setShowDefinition(false);

    if (newCount >= TARGET_VIEWS) {
      await practice.submitAttempt({
        vocabulary_item_id: word.id,
        phase_practiced: 1,
        attempt_type: 'recognition',
        user_response: 'viewed',
        accuracy_score: 100,
        feedback_given: `Viewed ${newCount} times`,
        advance: true,
      });
      onComplete?.(word);
    } else {
      // Re-play
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(word.russian_word);
        u.lang = 'ru-RU';
        u.rate = 0.8;
        window.speechSynthesis?.speak(u);
      }, 300);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <span className="phase-badge bg-blue-100 text-blue-700">Phase 1: Recognition</span>
        <span className="text-sm text-gray-400">{viewCount + 1} of {TARGET_VIEWS}</span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {Array.from({ length: TARGET_VIEWS }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${i < viewCount ? 'bg-blue-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Word card */}
      <div className="card w-full text-center">
        <p className="text-sm text-gray-500 mb-2">Russian Word</p>
        <div className="russian-text text-4xl font-bold text-blue-900 mb-4">
          {word.russian_word}
        </div>
        <div className="flex justify-center mb-4">
          <AudioPlayer text={word.russian_word} size="lg" />
        </div>

        {!showDefinition ? (
          <button
            onClick={() => setShowDefinition(true)}
            className="text-blue-600 text-sm font-medium underline"
          >
            Show meaning
          </button>
        ) : (
          <div className="mt-2 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Meaning</p>
            <p className="text-xl font-semibold text-gray-800">{word.english_definition}</p>
            {word.notes && <p className="text-sm text-gray-500 mt-2 italic">{word.notes}</p>}
          </div>
        )}
      </div>

      {/* Example sentences placeholder */}
      <div className="w-full bg-gray-50 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Focus on recognizing this word</p>
        <p className="text-sm text-gray-600">
          See it. Hear it. Understand it. You'll practice producing it in later phases.
        </p>
      </div>

      <div className="flex gap-3 w-full">
        <button onClick={onSkip} className="btn-secondary flex-1">
          Skip
        </button>
        <button onClick={handleNext} className="btn-primary flex-2 flex-grow">
          {viewCount + 1 >= TARGET_VIEWS ? 'Got it! →' : 'See Again →'}
        </button>
      </div>
    </div>
  );
}
