import React, { useState, useRef } from 'react';
import { vocabulary } from '../../services/api';

export default function FlashcardUpload({ onComplete }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const fileRef = useRef();

  async function handleFileUpload() {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await vocabulary.import(fd);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleManualImport() {
    if (!manualText.trim()) return;
    setError('');
    setLoading(true);
    try {
      const lines = manualText.trim().split('\n').filter(l => l.trim());
      const words = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { russian_word: parts[0], english_definition: parts[1] || '', notes: parts[2] || null };
      }).filter(w => w.russian_word && w.english_definition);

      if (words.length === 0) {
        setError('No valid words found. Format: "Russian word, English definition" per line.');
        return;
      }

      const data = await vocabulary.importWords(words);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-5xl">✅</div>
        <h3 className="text-xl font-bold text-green-700">Import Successful!</h3>
        <div className="card max-w-sm mx-auto text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Words imported</span>
            <span className="font-bold text-green-600">{result.imported}</span>
          </div>
          {result.duplicates > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Duplicates skipped</span>
              <span className="font-bold text-gray-500">{result.duplicates}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Total in file</span>
            <span className="font-bold">{result.total}</span>
          </div>
        </div>
        <p className="text-sm text-gray-500">Run the assessment to categorize your vocabulary into phases.</p>
        <button onClick={() => onComplete?.(result)} className="btn-primary w-full max-w-sm">
          Run Assessment →
        </button>
        <button onClick={() => { setResult(null); setFile(null); }} className="btn-secondary w-full max-w-sm">
          Import More
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Import Vocabulary</h2>
        <p className="text-gray-600 text-sm">Import your flashcards (CSV or JSON format)</p>
      </div>

      {/* File Upload */}
      {!manualMode && (
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl mb-3">📁</div>
            {file ? (
              <div>
                <p className="font-medium text-blue-700">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">Tap to select file</p>
                <p className="text-sm text-gray-400">CSV or JSON</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={e => setFile(e.target.files[0])}
            />
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <p className="font-medium mb-1">CSV format (one per line):</p>
            <p className="font-mono text-xs">необходимый, necessary, essential</p>
            <p className="font-mono text-xs">привет, hello</p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button onClick={handleFileUpload} disabled={!file || loading} className="btn-primary w-full">
            {loading ? 'Importing...' : 'Import File'}
          </button>

          <button onClick={() => setManualMode(true)} className="text-sm text-blue-600 w-full text-center">
            Or paste words manually
          </button>
        </div>
      )}

      {/* Manual input */}
      {manualMode && (
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-xl p-3 text-sm">
            <p className="font-medium text-blue-700 mb-1">Paste words (one per line):</p>
            <p className="font-mono text-xs text-blue-600">Russian word, English definition</p>
          </div>

          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3 h-48 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={"необходимый, necessary\nпривет, hello\nспасибо, thank you"}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setManualMode(false)} className="btn-secondary flex-1">
              Back to file
            </button>
            <button onClick={handleManualImport} disabled={!manualText.trim() || loading} className="btn-primary flex-1">
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
