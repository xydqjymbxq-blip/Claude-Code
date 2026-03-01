import React, { useState, useEffect } from 'react';
import { progress } from '../../services/api';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PHASE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444'];
const PHASE_NAMES = ['Recognition', 'Pronunciation', 'Sentences', 'Complex Use', 'Mastered'];

export default function ProgressDashboard({ onStartPractice }) {
  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      progress.getDashboard(),
      progress.getStats(30),
      progress.getStreak(),
    ]).then(([d, s, st]) => {
      setDashboard(d);
      setStats(s);
      setStreak(st);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-3xl animate-spin">⏳</div>
      </div>
    );
  }

  if (!dashboard) return null;

  const pieData = Object.entries(dashboard.phase_distribution || {}).map(([phase, count], i) => ({
    name: PHASE_NAMES[i],
    value: count,
    color: PHASE_COLORS[i],
  })).filter(d => d.value > 0);

  const masteredData = (stats?.mastered_over_time || []).map(d => ({
    date: new Date(d.mastered_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    count: parseInt(d.count),
  }));

  return (
    <div className="space-y-4">
      {/* Streak banner */}
      {streak?.streak > 0 && (
        <div className="bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Current Streak</p>
              <p className="text-3xl font-bold">{streak.streak} days 🔥</p>
            </div>
            <div className="text-5xl">🔥</div>
          </div>
        </div>
      )}

      {/* Total progress */}
      <div className="card">
        <h2 className="font-bold text-lg mb-3">Vocabulary Journey</h2>
        <div className="flex items-center gap-4">
          <div className="w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1">
            {Object.entries(dashboard.phase_distribution || {}).map(([phase, count], i) => (
              <div key={phase} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[i] }} />
                <span className="text-xs text-gray-600 flex-1">{PHASE_NAMES[i]}</span>
                <span className="text-xs font-bold">{count}</span>
              </div>
            ))}
            <div className="pt-1 border-t">
              <span className="text-sm text-gray-500">Total: </span>
              <span className="font-bold">{dashboard.total_words?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* This week */}
      <div className="card">
        <h3 className="font-bold mb-3">This Week</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{dashboard.this_week?.words_practiced || 0}</div>
            <div className="text-xs text-gray-500">Words practiced</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{dashboard.this_week?.words_advanced || 0}</div>
            <div className="text-xs text-gray-500">Advanced phases</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{dashboard.this_week?.words_mastered || 0}</div>
            <div className="text-xs text-gray-500">Mastered ⭐</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{dashboard.this_week?.practice_minutes || 0}</div>
            <div className="text-xs text-gray-500">Minutes practiced</div>
          </div>
        </div>
      </div>

      {/* Mastered over time */}
      {masteredData.length > 1 && (
        <div className="card">
          <h3 className="font-bold mb-3">Words Mastered</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={masteredData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline estimate */}
      {dashboard.estimated_months_to_master && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600">
            At current pace, you'll master all words in approximately{' '}
            <strong>{dashboard.estimated_months_to_master} months</strong>.
          </p>
        </div>
      )}

      {/* Practice CTA */}
      <button onClick={onStartPractice} className="btn-primary w-full text-lg py-4">
        Start Today's Practice →
      </button>
    </div>
  );
}
