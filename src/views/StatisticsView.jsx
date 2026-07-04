import { h } from 'preact';
import { Vocabulary } from '/client/model/vocabulary';
import { Lists } from '/client/model/lists';
import { useReactive } from '../hooks/useReactive';

function computeStats() {
  // Access all active vocabulary entries via the Vocabulary's internal cache
  // We need to trigger reactivity by depending on the vocabulary
  const allItems = Vocabulary.getAllItems ? Vocabulary.getAllItems() : [];

  const total = allItems.length;
  const learned = allItems.filter(e => e.attempts > 0);
  const new_ = allItems.filter(e => e.attempts === 0);
  // Mastered: at least 5 attempts and success rate >= 80%
  const mastered = learned.filter(e => e.attempts >= 5 && (e.successes / e.attempts) >= 0.8);

  // Compute overall success rate
  const totalAttempts = learned.reduce((sum, e) => sum + e.attempts, 0);
  const totalSuccesses = learned.reduce((sum, e) => sum + e.successes, 0);
  const overallRate = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 0;

  // By list
  const enabledLists = Lists.getEnabledLists();
  const listStats = {};
  Object.keys(enabledLists).forEach(listKey => {
    const listItems = allItems.filter(e => e.lists && e.lists.includes(listKey));
    const listLearned = listItems.filter(e => e.attempts > 0);
    listStats[listKey] = {
      name: enabledLists[listKey].name,
      total: listItems.length,
      learned: listLearned.length,
      mastered: listLearned.filter(e => e.attempts >= 5 && (e.successes / e.attempts) >= 0.8).length,
    };
  });

  return {
    total,
    learned: learned.length,
    newCount: new_.length,
    mastered: mastered.length,
    overallRate,
    totalAttempts,
    totalSuccesses,
    listStats,
  };
}

function StatCard({ label, value, color }) {
  return (
    <div class="stat-card" style={color ? { borderLeftColor: color } : undefined}>
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div class="stat-progress">
      <div class="stat-progress-bar" style={{ width: `${pct}%`, background: color || 'var(--accent)' }}></div>
    </div>
  );
}

export default function StatisticsView() {
  const stats = useReactive(computeStats, []);

  return (
    <div class="stats-view">
      {/* Overview cards */}
      <div class="section-divider">Overview</div>
      <div class="stats-grid">
        <StatCard label="Total Characters" value={stats.total} color="var(--blue)" />
        <StatCard label="Learned" value={stats.learned} color="var(--green)" />
        <StatCard label="Mastered" value={stats.mastered} color="var(--purple)" />
        <StatCard label="New" value={stats.newCount} color="var(--ink-muted)" />
        <StatCard label="Success Rate" value={`${stats.overallRate}%`} color="var(--orange)" />
      </div>

      {/* Overall progress bar */}
      {stats.total > 0 && (
        <div class="stats-overall-progress">
          <div class="stat-progress-label">
            <span>Overall Progress</span>
            <span>{stats.learned} / {stats.total} ({Math.round((stats.learned / stats.total) * 100)}%)</span>
          </div>
          <ProgressBar value={stats.learned} max={stats.total} color="var(--green)" />
        </div>
      )}

      {/* Per-list breakdown */}
      {Object.keys(stats.listStats).length > 0 && (
        <>
          <div class="section-divider">By List</div>
          {Object.entries(stats.listStats).map(([key, ls]) => (
            <div class="list-stat-item" key={key}>
              <div class="list-stat-header">
                <span class="list-stat-name">{ls.name}</span>
                <span class="list-stat-count">{ls.learned} / {ls.total}</span>
              </div>
              <ProgressBar value={ls.learned} max={ls.total} color="var(--green)" />
              <div class="list-stat-detail">
                <span>{ls.mastered} mastered</span>
                <span>{ls.total - ls.learned} remaining</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Total attempts info */}
      {stats.totalAttempts > 0 && (
        <>
          <div class="section-divider">Activity</div>
          <div class="list-item">
            <span>Total Reviews</span>
            <span class="stat-number">{stats.totalAttempts}</span>
          </div>
          <div class="list-item">
            <span>Total Successes</span>
            <span class="stat-number">{stats.totalSuccesses}</span>
          </div>
        </>
      )}

      {/* Legend / Explanations */}
      <div class="section-divider">About These Stats</div>
      <div class="stats-legend">
        <p><strong>Learned</strong> — characters you have practiced at least once.</p>
        <p><strong>Mastered</strong> — characters with at least 5 reviews and a success rate of 80% or higher.</p>
        <p><strong>Success Rate</strong> — the percentage of correct answers across all your reviews.</p>
      </div>
    </div>
  );
}