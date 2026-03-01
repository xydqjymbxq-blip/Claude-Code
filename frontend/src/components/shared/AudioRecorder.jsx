import React, { useState, useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

export default function AudioRecorder({ onTranscript, disabled = false, lang = 'ru-RU' }) {
  const [error, setError] = useState(null);

  const { isListening, transcript, start, stop, isSupported } = useSpeechRecognition({
    lang,
    onResult: (text) => onTranscript?.(text),
    onError: (err) => setError(`Recognition error: ${err}. Please try again.`),
  });

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  if (!isSupported) {
    return (
      <div className="text-center text-sm text-red-500">
        Speech recognition not supported. Please use Chrome or Safari.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={isListening ? stop : start}
        disabled={disabled}
        className={`mic-button transition-all ${
          isListening
            ? 'bg-red-500 animate-pulse shadow-red-300 shadow-xl'
            : 'bg-blue-600 hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        🎤
      </button>
      <p className="text-sm text-gray-500">
        {isListening ? 'Listening... tap to stop' : 'Tap to speak in Russian'}
      </p>
      {transcript && (
        <div className="bg-gray-100 rounded-xl px-4 py-2 text-center">
          <span className="text-sm text-gray-600">You said: </span>
          <span className="font-medium">{transcript}</span>
        </div>
      )}
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
}
