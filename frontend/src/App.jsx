import React, { useState, useEffect } from 'react';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProgressDashboard from './components/Dashboard/ProgressDashboard';
import PracticeSession from './components/Practice/PracticeSession';
import FlashcardUpload from './components/Import/FlashcardUpload';
import InitialAssessment from './components/Import/InitialAssessment';
import { assessment } from './services/api';

const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  DASHBOARD: 'dashboard',
  PRACTICE: 'practice',
  IMPORT: 'import',
  ASSESSMENT: 'assessment',
};

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [view, setView] = useState(user ? VIEWS.DASHBOARD : VIEWS.LOGIN);
  const [goalMinutes] = useState(20);
  const [, setHasAssessment] = useState(null);

  useEffect(() => {
    if (user) {
      // Check if user has done assessment
      assessment.getStatus().then(status => {
        setHasAssessment(!!status);
      }).catch(() => setHasAssessment(true)); // Assume done if error
    }
  }, [user]);

  function handleLogin(u) {
    setUser(u);
    setView(VIEWS.DASHBOARD);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView(VIEWS.LOGIN);
  }

  if (!user) {
    if (view === VIEWS.REGISTER) {
      return <Register onRegister={handleLogin} onSwitchToLogin={() => setView(VIEWS.LOGIN)} />;
    }
    return <Login onLogin={handleLogin} onSwitchToRegister={() => setView(VIEWS.REGISTER)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view !== VIEWS.DASHBOARD && (
              <button onClick={() => setView(VIEWS.DASHBOARD)} className="text-blue-200 mr-1">‹</button>
            )}
            <span className="text-lg font-bold">🇷🇺 Russian Learning</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView(VIEWS.IMPORT)} className="text-blue-200 text-sm">
              Import
            </button>
            <button onClick={handleLogout} className="text-blue-200 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-5">
        {view === VIEWS.DASHBOARD && (
          <ProgressDashboard
            onStartPractice={() => setView(VIEWS.PRACTICE)}
          />
        )}

        {view === VIEWS.PRACTICE && (
          <PracticeSession
            goalMinutes={goalMinutes}
            onFinish={() => setView(VIEWS.DASHBOARD)}
          />
        )}

        {view === VIEWS.IMPORT && (
          <FlashcardUpload
            onComplete={() => setView(VIEWS.ASSESSMENT)}
          />
        )}

        {view === VIEWS.ASSESSMENT && (
          <InitialAssessment
            onComplete={() => {
              setHasAssessment(true);
              setView(VIEWS.DASHBOARD);
            }}
          />
        )}
      </main>

      {/* Bottom nav */}
      {[VIEWS.DASHBOARD, VIEWS.PRACTICE, VIEWS.IMPORT].includes(view) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
          <div className="max-w-lg mx-auto flex">
            {[
              { view: VIEWS.DASHBOARD, icon: '📊', label: 'Progress' },
              { view: VIEWS.PRACTICE, icon: '🎯', label: 'Practice' },
              { view: VIEWS.IMPORT, icon: '📥', label: 'Import' },
            ].map(tab => (
              <button
                key={tab.view}
                onClick={() => setView(tab.view)}
                className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 ${
                  view === tab.view ? 'text-blue-700' : 'text-gray-400'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
