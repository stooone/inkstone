import { h } from 'preact';
import { Vocabulary } from '/client/model/vocabulary';
import { Settings } from '/client/model/settings';
import { timestamp } from '/lib/base';

const fmtDate = (ts) => {
  if (ts == null) return '—';
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

export default function WordDetailView({ row, onBack }) {
  const charset = Settings.get('character_set');
  const word = row[charset] || row.simplified || row.traditional || row.word || '?';
  const vocabEntry = Vocabulary.getAllItems().find(e => e.word === word) || (row.word ? row : null);
  const charDisplay = word;

  const attempts = vocabEntry?.attempts ?? 0;
  const successes = vocabEntry?.successes ?? 0;
  const successRate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
  const now = timestamp();
  const isLeech = attempts >= 5 && successRate < 30 && (vocabEntry?.next ?? Infinity) < now + 3 * 86400;
  const isMastered = attempts >= 5 && successRate >= 80;

  return (
    <div class="word-detail-view">
      <div class="word-detail-header">
        <button class="btn-back" onClick={onBack}>← Back</button>
        <span class="word-detail-title">Word Details</span>
      </div>

      <div class="word-detail-card">
        <div class="word-detail-char">{charDisplay}</div>
        <div class="word-detail-meta">{row.pinyin || '—'} — {row.definition || '—'}</div>
      </div>

      <div class="panel-section">
        <div class="panel-heading">Scheduling</div>
        <div class="panel-body">
          <div class="metadata-field">
            <span class="field-label">Last</span>
            <span class="field-value">{fmtDate(vocabEntry?.last)}</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Due</span>
            <span class="field-value">{fmtDate(vocabEntry?.next)}</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Lists</span>
            <span class="field-value">{(vocabEntry?.lists ?? []).join(', ') || '—'}</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-heading">Performance</div>
        <div class="panel-body">
          <div class="metadata-field">
            <span class="field-label">Total</span>
            <span class="field-value">{attempts}</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Good</span>
            <span class="field-value">{successes} ({successRate}%)</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Bad</span>
            <span class="field-value">{attempts - successes} ({attempts > 0 ? 100 - successRate : 0}%)</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Last review failed</span>
            <span class="field-value">{vocabEntry?.failed ? 'Yes' : 'No'}</span>
          </div>
          <div class="metadata-field">
            <span class="field-label">Status</span>
            <span class="field-value">
              {attempts === 0 ? 'Unseen' : isLeech ? 'Leech' : isMastered ? 'Mastered' : 'Learning'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}