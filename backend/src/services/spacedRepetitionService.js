// Spaced repetition intervals (days) per phase
const REVIEW_INTERVALS = {
  1: [1],                    // Phase 1 → Phase 2: next day
  2: [1, 3, 7],              // Phase 2 reviews
  3: [2, 5, 10],             // Phase 3 reviews
  4: [3, 7, 14],             // Phase 4 reviews
  5: [7, 30, 60, 90],        // Phase 5 (mastered) maintenance
};

// Words per phase in a daily session
const SESSION_ALLOCATION = {
  1: { count: 5, minutesEach: 0.5 },
  2: { count: 3, minutesEach: 2 },
  3: { count: 3, minutesEach: 2 },
  4: { count: 2, minutesEach: 2 },
  5: { count: 1, minutesEach: 5 },
};

function getNextReviewDate(phase, attemptNumber = 0) {
  const intervals = REVIEW_INTERVALS[phase] || [1];
  const days = intervals[Math.min(attemptNumber, intervals.length - 1)];
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function buildDailySession(goalMinutes = 20) {
  const scale = goalMinutes / 20;
  return Object.entries(SESSION_ALLOCATION).reduce((acc, [phase, config]) => {
    acc[phase] = Math.max(1, Math.round(config.count * scale));
    return acc;
  }, {});
}

module.exports = { getNextReviewDate, buildDailySession, REVIEW_INTERVALS };
