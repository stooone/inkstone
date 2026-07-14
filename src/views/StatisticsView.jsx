import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Vocabulary } from '/client/model/vocabulary';
import { Lists } from '/client/model/lists';
import { useReactive } from '../hooks/useReactive';

function computeStats() {
  try {
    // Access all active vocabulary entries via the Vocabulary's internal cache
    // We need to trigger reactivity by depending on the vocabulary
    const allItems = Vocabulary.getAllItems ? Vocabulary.getAllItems() : [];

    const total = allItems.length;
    const learning = allItems.filter(e => e && e.attempts > 0);
    const new_ = allItems.filter(e => e && e.attempts === 0);
    // Mastered: at least 5 attempts and success rate >= 80%
    const mastered = learning.filter(e => e.attempts >= 5 && e.successes != null && (e.successes / e.attempts) >= 0.8);

    const totalAttempts = learning.reduce((sum, e) => sum + (e.attempts || 0), 0);
    // Leeches: items with success rate < 20% and due within 3 days
    const leechesCursor = Vocabulary.getRoteReviewItems();
    const leechesCount = leechesCursor.count();
    const leechesItems = leechesCursor.fetch();
    // By list
    const enabledLists = Lists.getEnabledLists();
    const listStats = {};
    Object.keys(enabledLists).forEach(listKey => {
      const listItems = allItems.filter(e => e && e.lists && e.lists.includes(listKey));
      const listLearning = listItems.filter(e => e.attempts > 0);
      listStats[listKey] = {
        name: enabledLists[listKey].name,
        total: listItems.length,
        learning: listLearning.length,
        mastered: listLearning.filter(e => e.attempts >= 5 && e.successes != null && (e.successes / e.attempts) >= 0.8).length,
      };
    });

    return {
      total,
      learning: learning.length,
      newCount: new_.length,
      mastered: mastered.length,
      totalAttempts,
      listStats,
      leeches: leechesCount,
      leechesItems,
    };
  } catch (err) {
    console.error('Failed to compute stats:', err);
    return {
      total: 0, learning: 0, newCount: 0, mastered: 0,
      totalAttempts: 0, listStats: {},
      leeches: 0, leechesItems: [],
    };
  }
}

function CircleStat({ value, color }) {
  return (
    <div class="stat-circle" style={{ borderColor: color }}>
      <span class="stat-circle-value">{value}</span>
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

function SegmentedProgressBar({ mastered, learning, total }) {
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const learningPct = total > 0 ? Math.round(((learning - mastered) / total) * 100) : 0;
  const remainingPct = total > 0 ? 100 - masteredPct - learningPct : 100;
  return (
    <div class="stat-progress stat-progress-segmented">
      {masteredPct > 0 && (
        <div class="stat-progress-bar stat-progress-mastered" style={{ width: `${masteredPct}%` }}></div>
      )}
      {learningPct > 0 && (
        <div class="stat-progress-bar stat-progress-learning" style={{ width: `${learningPct}%` }}></div>
      )}
      {remainingPct > 0 && (
        <div class="stat-progress-bar stat-progress-remaining" style={{ width: `${remainingPct}%` }}></div>
      )}
    </div>
  );
}

function LeechListItem({ word, attempts, successes, last, next }) {
  const rate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
  return (
    <div class="leech-word-row">
      <span class="leech-word-char">{word}</span>
      <span class="leech-word-meta">{rate}% · {successes}/{attempts}</span>
    </div>
  );
}

export default function StatisticsView() {
  const stats = useReactive(computeStats, []);
  const [leechesOpen, setLeechesOpen] = useState(false);

  return (
    <div class="stats-view">
      {/* Circle-dash-circle stat indicators */}
      <div class="section-divider">Overview</div>
      <div class="stats-circles-bracket">
        <div class="stats-circle-row">
          <div class="stat-circle-item">
            <CircleStat value={stats.newCount} color="var(--ink-muted)" />
            <span class="stat-circle-label">New</span>
          </div>
          <div class="stat-circle-connector"></div>
          <div class="stat-circle-item">
            <CircleStat value={stats.learning} color="var(--green)" />
            <span class="stat-circle-label">Learning</span>
          </div>
          <div class="stat-circle-connector"></div>
          <div class="stat-circle-item">
            <CircleStat value={stats.mastered} color="var(--purple)" />
            <span class="stat-circle-label">Mastered</span>
          </div>
        </div>
        <div class="stats-bracket">
          <div class="stats-bracket-total">{stats.total}</div>
        </div>
      </div>

      {/* Per-list breakdown */}
      {Object.keys(stats.listStats).length > 0 && (
        <>
          <div class="section-divider">By List</div>
          {Object.entries(stats.listStats).map(([key, ls]) => (
            <div class="list-stat-item" key={key}>
              <div class="list-stat-header">
                <span class="list-stat-name">{ls.name}</span>
                <span class="list-stat-count">{ls.learning} / {ls.total}</span>
              </div>
              <SegmentedProgressBar mastered={ls.mastered} learning={ls.learning} total={ls.total} />
              <div class="list-stat-detail">
                <span>{ls.mastered} mastered</span>
                <span>{ls.learning - ls.mastered} learning</span>
                <span>{ls.total - ls.learning} new</span>
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
          {stats.leeches > 0 && (
            <div class="list-toggle-group">
              <div class="list-item clickable" onClick={() => setLeechesOpen((v) => !v)}>
                <span>Leeches <span class="stat-number" style={{ color: "var(--red)" }}>{stats.leeches}</span></span>
                <span>{leechesOpen ? '▾' : '▸'}</span>
              </div>
              {leechesOpen && (
                <div class="leech-words-expanded">
                  {stats.leechesItems.map((item, idx) => (
                    <LeechListItem
                      key={idx}
                      word={item.word}
                      attempts={item.attempts}
                      successes={item.successes}
                      last={item.last}
                      next={item.next}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Legend / Explanations */}
      <div class="section-divider">About These Stats</div>
      <div class="stats-legend">
        <p><strong>Learning</strong> — characters you have practiced at least once.</p>
        <p><strong>Mastered</strong> — characters with at least 5 reviews and a success rate of 80% or higher.</p>
      </div>
    </div>
  );
}