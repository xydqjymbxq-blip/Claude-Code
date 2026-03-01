import React from 'react';

export default function ProgressBar({ value, max, color = 'blue', showLabel = false, label }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colorMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label || ''}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color] || colorMap.blue} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
