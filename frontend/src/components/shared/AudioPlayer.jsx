import React, { useCallback } from 'react';

export default function AudioPlayer({ text, lang = 'ru-RU', size = 'md' }) {
  const speak = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, [text, lang]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  return (
    <button
      onClick={speak}
      className={`${sizeClasses[size]} rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors active:scale-95`}
      title="Play pronunciation"
    >
      🔊
    </button>
  );
}
