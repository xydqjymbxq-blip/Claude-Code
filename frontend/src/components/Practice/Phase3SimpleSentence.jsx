import React, { useState } from 'react';
import AudioPlayer from '../shared/AudioPlayer';
import AudioRecorder from '../shared/AudioRecorder';
import { practice } from '../../services/api';

const PROMPTS = [
  (word) => `Make a simple sentence using "${word}" about your morning routine`,
  (word) => `Use "${word}" to describe something in your home`,
  (word) => `Make any simple sentence with "${word}"`,
  (word) => `Use "${word}" to talk about something you like`,
  (word) => `Describe your work or study using "${word}"`,
];

const REQUIRED_SENTENCES = 2;

export default function Phase3SimpleSentence({ word, onComplete, onSkip }) {
  const [transcript, setTranscript] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [stage, setStage] = useState('prompt'); // prompt | recording | feedback | done

  const currentPrompt = PROMPTS[promptIndex % PROMPTS.length](word.russian_word);

  async function handleTranscript(text) {
    setTranscript(text);
    setLoading(true);
    setStage('feedback');

    try {
      const result = await practice.evaluateSentence(word.russian_word, text);
      setEvaluation(result);

      const isSuccess = result.advancement_eligible;
      const newSuccessCount = isSuccess ? successCount + 1 : successCount;
      if (isSuccess) setSuccessCount(newSuccessCount);

      const shouldAdvance = newSuccessCount >= REQUIRED_SENTENCES;

      await practice.submitAttempt({
        vocabulary_item_id: word.id,
        phase_practiced: 3,
        attempt_type: 'simple_sentence',
        user_response: text,
        accuracy_score: result.naturalness * 20,
        feedback_given: result.tip,
        advance: shouldAdvance,
      });

      if (shouldAdvance) setStage('done');
    } catch (err) {
      setEvaluation({ error: true });
    } finally {
      setLoading(false);
    }
  }

  function nextPrompt() {
    setTranscript('');
    setEvaluation(null);
    setPromptIndex(p => p + 1);
    setStage('prompt');
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center gap-2">
        <span className="phase-badge bg-green-100 text-green-700">Phase 3: Sentences</span>
        <span className="text-sm text-gray-400">{successCount}/{REQUIRED_SENTENCES} done</span>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {Array.from({ length: REQUIRED_SENTENCES }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full ${i < successCount ? 'bg-green-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Word card */}
      <div className="card w-full text-center">
        <div className="russian-text text-3xl font-bold text-blue-900 mb-1">
          {word.russian_word}
        </div>
        <p className="text-gray-500 mb-2">{word.english_definition}</p>
        <AudioPlayer text={word.russian_word} />
      </div>

      {/* Prompt */}
      {(stage === 'prompt' || stage === 'recording') && (
        <div className="w-full space-y-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-blue-600 font-medium mb-1">Your task:</p>
            <p className="text-gray-800">{currentPrompt}</p>
            <p className="text-xs text-gray-400 mt-2">Speak in Russian (30-60 seconds to think)</p>
          </div>

          <AudioRecorder onTranscript={handleTranscript} disabled={loading} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center">
          <div className="text-2xl animate-spin">⏳</div>
          <p className="text-sm text-gray-500 mt-2">Claude is evaluating your sentence...</p>
        </div>
      )}

      {/* Feedback */}
      {evaluation && stage === 'feedback' && !loading && (
        <div className="w-full space-y-3">
          {/* Transcript */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">You said:</p>
            <p className="italic text-gray-700">"{transcript}"</p>
            {evaluation.corrected_version && evaluation.corrected_version !== transcript && (
              <div className="mt-2">
                <p className="text-xs text-blue-500">Suggested:</p>
                <p className="text-blue-700 italic">"{evaluation.corrected_version}"</p>
              </div>
            )}
          </div>

          {/* Evaluation */}
          <div className={`card ${evaluation.advancement_eligible ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            {evaluation.advancement_eligible ? (
              <p className="font-semibold text-green-700 mb-2">✓ Excellent!</p>
            ) : (
              <p className="font-semibold text-orange-700 mb-2">△ Good try!</p>
            )}

            {evaluation.praise && <p className="text-sm text-gray-700 mb-2">{evaluation.praise}</p>}

            {!evaluation.grammar_correct && evaluation.grammar_notes && (
              <div className="bg-white rounded-lg p-2 mb-2">
                <p className="text-sm text-orange-600">Grammar: {evaluation.grammar_notes}</p>
              </div>
            )}

            {evaluation.tip && <p className="text-sm text-gray-500 italic">Tip: {evaluation.tip}</p>}

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">Naturalness:</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < evaluation.naturalness ? 'text-yellow-400' : 'text-gray-200'}>★</span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={nextPrompt} className="btn-secondary flex-1">
              {successCount >= REQUIRED_SENTENCES ? 'Continue' : 'Try another prompt'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="w-full text-center space-y-4">
          <div className="text-5xl">🌟</div>
          <h3 className="text-xl font-bold text-green-700">Phase 3 Complete!</h3>
          <p className="text-gray-600">
            You successfully used "{word.russian_word}" in {REQUIRED_SENTENCES} different sentences!
          </p>
          <button onClick={() => onComplete?.(word)} className="btn-success w-full">
            Advance to Phase 4 →
          </button>
        </div>
      )}

      {stage !== 'done' && (
        <button onClick={onSkip} className="text-sm text-gray-400 underline">Skip</button>
      )}
    </div>
  );
}
