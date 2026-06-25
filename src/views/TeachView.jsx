import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useReactive } from '../hooks/useReactive';
import { Timing } from '/client/model/timing';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';
import { Handwriting } from '/client/handwriting';
import { readItem } from '/client/assets';
import { Matcher } from '/lib/matcher/matcher';

const kMaxMistakes  = 3;
const kMaxPenalties = 4;

const getResult = (penalties) => Math.min(Math.floor(2 * penalties / kMaxPenalties) + 1, 3);
const fixMedian = (median) => median.map((x) => [x[0], 900 - x[1]]);

// -------------------------------------------------------------------
// ErrorCard
// -------------------------------------------------------------------
function ErrorCard({ card, onNavigate }) {
  const data = card.data;
  return (
    <div class="error-card">
      <h2>{data.error}</h2>
      {(data.options || []).map((opt, i) => (
        <button
          key={i}
          id={`error-option-${i}`}
          class="error-option-btn"
          onClick={() => {
            if (opt.extra) {
              Timing.addExtraCards(opt.extra);
            } else if (opt.link) {
              onNavigate(opt.link);
            }
          }}
        >
          {opt.text}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------
// GradingOverlay
// -------------------------------------------------------------------
function GradingOverlay({ onGrade }) {
  const grades = [
    { result: 0, icon: '⭐', label: 'Perfect' },
    { result: 1, icon: '✓',  label: 'Good'    },
    { result: 2, icon: '⏸',  label: 'Okay'    },
    { result: 3, icon: '✕',  label: 'Wrong'   },
  ];
  return (
    <div class="grading-overlay" id="grading-overlay">
      {grades.map(g => (
        <button
          key={g.result}
          id={`grade-btn-${g.result}`}
          class="grade-btn"
          data-result={g.result}
          onClick={() => onGrade(g.result)}
          title={g.label}
        >
          {g.icon}
          <span>{g.label}</span>
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------
// TeachView
// -------------------------------------------------------------------
export default function TeachView({ showPopup, hidePopup, navigate }) {
  const card = useReactive(() => Timing.getNextCard(), []);

  const [helpers, setHelpers] = useState({
    pinyin: '', definition: '', deck: '', error: null, options: null,
    grading: false, complete: false, word: '', loadError: null,
  });

  const setH = useCallback((patch) => setHelpers(prev => ({ ...prev, ...patch })), []);

  const canvasWrapRef = useRef(null);
  const hwRef         = useRef(null);   // Handwriting instance
  const elementRef    = useRef(null);   // canvas parent element

  // Item state (mutable, not reactive state – mutated in callbacks)
  const itemRef = useRef({ card: null, index: 0, tasks: [] });

  // ------------------------------------------------------------------
  // Handwriting event callbacks
  // ------------------------------------------------------------------
  const maybeAdvance = useCallback(() => {
    const item = itemRef.current;
    if (item.index === item.tasks.length) return true;
    const task = item.tasks[item.index];
    if (task.missing.length > 0) return false;
    if (task.result === null) return true;
    item.index += 1;
    setH({ complete: false });
    window.dispatchEvent(new Event('makemeahanzi-next-character'));
    if (item.index < item.tasks.length) {
      hwRef.current?.moveToCorner();
    } else {
      // All characters done
      transition();
      maybeRecordResult();
      hwRef.current?.clear();
    }
    return true;
  }, []);

  const maybeRecordResult = useCallback(() => {
    const item = itemRef.current;
    if (!item.card) return;
    const card = item.card;
    const result = item.tasks.reduce((max, t) => Math.max(max, t.result ?? 0), 0);
    setTimeout(() => Timing.completeCard(card, result), 20);
  }, []);

  const transition = useCallback(() => {
    // CSS slide animation: re-mount canvas by clearing and re-drawing
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    wrap.style.transition = 'opacity .15s';
    wrap.style.opacity = '0';
    setTimeout(() => {
      wrap.style.opacity = '1';
    }, 150);
  }, []);

  const onClick = useCallback(() => {
    if (maybeAdvance()) return;
    const task = itemRef.current.tasks[itemRef.current.index];
    task.penalties += kMaxPenalties;
    hwRef.current?.flash(task.strokes[task.missing[0]]);
  }, [maybeAdvance]);

  const onDouble = useCallback(() => {
    if (maybeAdvance()) return;
    const task = itemRef.current.tasks[itemRef.current.index];
    if (task.penalties < kMaxPenalties) return;
    hwRef.current?.reveal(task.strokes);
    hwRef.current?.highlight(task.strokes[task.missing[0]]);
  }, [maybeAdvance]);

  const onRequestRegrade = useCallback((stroke) => {
    const item = itemRef.current;
    const task = item.tasks[item.index];
    if (!task || task.missing.length > 0 || task.result === null) return false;
    const n = stroke.length;
    if (stroke[0][1] - stroke[n - 1][1] < Math.abs(stroke[0][0] - stroke[n - 1][0])) {
      return false;
    }
    task.result = null;
    hwRef.current?.glow(null);
    setH({ grading: true });
    return true;
  }, []);

  const onStroke = useCallback((stroke) => {
    if (onRequestRegrade(stroke) || maybeAdvance()) return;
    const item = itemRef.current;
    const task = item.tasks[item.index];
    const result = task.matcher.match(stroke, task.missing);
    task.recording.push({ indices: result.indices, stroke });

    if (result.indices.length === 0) {
      task.mistakes += 1;
      hwRef.current?.fade();
      if (task.mistakes >= kMaxMistakes) {
        task.penalties += kMaxPenalties;
        hwRef.current?.flash(task.strokes[task.missing[0]]);
      }
      return;
    }

    const path = result.indices.map((x) => task.strokes[x]).join(' ');
    const missing = task.missing.filter((x) => !result.indices.includes(x));

    if (missing.length === task.missing.length) {
      task.penalties += 1;
      hwRef.current?.undo();
      hwRef.current?.flash(path);
      return;
    }

    task.missing = missing;
    const rotate = result.simplified_median.length === 2;
    hwRef.current?.emplace([path, rotate, result.source_segment, result.target_segment]);
    if (result.warning) {
      task.penalties += result.penalties;
      hwRef.current?.warn(result.warning);
    }

    const index = Math.min(...result.indices);
    if (task.missing.length === 0) {
      setH({ complete: true });
      window.dispatchEvent(new Event('makemeahanzi-character-complete'));
      task.result = getResult(task.penalties);
      hwRef.current?.glow(task.result);
    } else if (task.missing[0] < index) {
      task.penalties += 2 * (index - task.missing[0]);
      hwRef.current?.flash(task.strokes[task.missing[0]]);
    } else {
      task.mistakes = 0;
      hwRef.current?.highlight(task.strokes[task.missing[0]]);
    }
  }, [maybeAdvance, onRequestRegrade]);

  const onRegrade = useCallback((result) => {
    const item = itemRef.current;
    const task = item.tasks[item.index];
    if (!task || task.missing.length > 0 || task.result !== null) return;
    task.result = result;
    hwRef.current?.glow(task.result);
    hwRef.current?._stage?.update();
    setH({ grading: false });
    maybeAdvance();
  }, [maybeAdvance]);

  // ------------------------------------------------------------------
  // Update item when card changes
  // ------------------------------------------------------------------
  const updateItem = useCallback((c, data) => {
    itemRef.current = {
      card: c,
      index: 0,
      tasks: (data.characters || []).map((row, i) => ({
        data: row,
        index: i,
        matcher: new Matcher(row),
        missing: Array.from({ length: row.medians.length }, (_, j) => j),
        mistakes: 0,
        penalties: 0,
        recording: [],
        result: null,
        strokes: row.strokes,
      })),
    };
  }, []);

  const onItemData = useCallback((data) => {
    const c = Timing.getNextCard();
    if (!c || data.word !== c.data.word) return;
    setH({
      deck: c.deck,
      definition: data.definition,
      pinyin: data.pinyin,
      word: data.word,
      error: null, options: null,
      grading: false, complete: false, loadError: null,
    });
    updateItem(c, data);
  }, [updateItem]);

  // ------------------------------------------------------------------
  // Mount / initialize Handwriting canvas
  // ------------------------------------------------------------------
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;

    const init = () => {
      if (el.offsetWidth === 0) {
        requestAnimationFrame(init);
        return;
      }
      const hw = new Handwriting(el, {
        onclick: onClick,
        ondouble: onDouble,
        onstroke: onStroke,
      });
      hwRef.current = hw;
      elementRef.current = el;
    };
    requestAnimationFrame(init);
    return () => { hwRef.current?.destroy?.(); };
  }, [onClick, onDouble, onStroke]);

  // ------------------------------------------------------------------
  // React to card changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!card) return;
    hwRef.current?.clear();
    setH({ deck: card.deck, grading: false, complete: false, loadError: null });

    if (card.deck === 'errors') {
      setH({ error: card.data.error, options: card.data.options });
      updateItem(card, { characters: [] });
      return;
    }
    setH({ error: null, options: null });

    const charset = Settings.get('character_set');
    let cancelled = false;
    setTimeout(() => {
      if (cancelled) return;
      readItem(card.data, charset).then((data) => {
        if (cancelled) return;
        onItemData(data);
      }).catch((err) => {
        if (cancelled) return;
        console.error('Card read error:', err.stack || err);
        // Show an in-place error instead of reshuffling (reshuffling causes an
        // infinite re-render loop: new card → load error → reshuffle → repeat).
        setH({
          loadError: `Failed to load "${card.data.word}": ${err.message || err}`,
          deck: card.deck,
        });
      });
    }, 20);
    return () => { cancelled = true; };
  }, [card]);

  // ------------------------------------------------------------------
  // Canvas size
  // ------------------------------------------------------------------
  const canvasWidth = Settings.get('canvas_width');
  const margin = Math.max(Math.min(Math.floor((100 - canvasWidth) / 2), 50), 0);

  const showRegradeIcon = Settings.get('show_regrading_icon') && helpers.complete;

  // ------------------------------------------------------------------
  // Blacklist
  // ------------------------------------------------------------------
  const onBlacklist = useCallback(() => {
    if (!itemRef.current.card || itemRef.current.card.deck === 'errors') return;
    const word = helpers.word;
    showPopup({
      title: 'Confirm Blacklist',
      text: 'Are you sure you want to blacklist this word? You can remove words from the blacklist on the Lists page.',
      buttons: [
        {
          label: 'Yes',
          callback: () => {
            hidePopup();
            const item = itemRef.current;
            if (!item.card || item.card.data.word !== word) return;
            Vocabulary.updateBlacklist(
              { definition: helpers.definition, pinyin: helpers.pinyin, word },
              true
            );
            transition();
            hwRef.current?.clear();
          }
        },
        { label: 'No', class: 'bold' },
      ],
    });
  }, [helpers, showPopup, hidePopup, transition]);

  // ------------------------------------------------------------------
  // Show answer (hash-based)
  // ------------------------------------------------------------------
  const onShow = useCallback(() => {
    const tasks = itemRef.current.tasks;
    if (tasks.length === 0) return;
    if (tasks.length === 1) {
      const t = tasks[0];
      if (t.missing.length > 0 && t.penalties < kMaxPenalties) {
        showPopup({
          title: 'Character Details',
          text: 'Looking at the details page will count as getting this character wrong. Proceed?',
          buttons: [
            {
              label: 'Yes',
              callback: () => {
                t.penalties += kMaxPenalties;
                setTimeout(() => {
                  window.location.hash = t.data.character.codePointAt(0);
                }, 0);
                hidePopup();
              }
            },
            { label: 'No', class: 'bold' },
          ],
        });
      } else {
        window.location.hash = t.data.character.codePointAt(0);
      }
    }
  }, [showPopup, hidePopup]);

  // ------------------------------------------------------------------
  // Redo
  // ------------------------------------------------------------------
  const onRedo = useCallback(() => {
    if (!itemRef.current.card || itemRef.current.card.deck === 'errors') return;
    const penalties = itemRef.current.tasks.map(t => t.penalties);
    updateItem(itemRef.current.card, { characters: itemRef.current.tasks.map(t => t.data) });
    itemRef.current.tasks.forEach((t, i) => t.penalties = penalties[i]);
    hwRef.current?.clear(true);
    setH({ grading: false, complete: false });
  }, [updateItem]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const isError = helpers.error !== null;
  const isLoadError = helpers.loadError !== null && !isError;

  return (
    <div id="view-teach">
      {/* Prompt */}
      <div class="teach-prompt">
        <div class="teach-pinyin">{helpers.pinyin}</div>
        <div class="teach-definition">{helpers.definition}</div>
      </div>

      {/* Canvas area */}
      <div class="teach-canvas-wrap">
        {isError ? (
          <ErrorCard card={card} onNavigate={navigate} />
        ) : isLoadError ? (
          <div class="load-error-card">
            <p>⚠️ {helpers.loadError}</p>
            <button id="btn-skip-card" class="error-option-btn" onClick={() => Timing.shuffle()}>
              Skip to next card
            </button>
          </div>
        ) : (
          <div
            class="teach-canvas-inner"
            style={{ left: `${margin}%`, right: `${margin}%`, position: 'relative', width: `${canvasWidth}%`, margin: '0 auto' }}
          >
            <div ref={canvasWrapRef} id="teach-canvas" style={{ width: '100%', paddingBottom: '100%', position: 'relative' }} />

            {helpers.grading && (
              <GradingOverlay onGrade={onRegrade} />
            )}

            {showRegradeIcon && !helpers.grading && (
              <div
                class="regrade-icon"
                id="btn-regrade"
                title="Regrade"
                onClick={() => { onRequestRegrade([[0, 1], [0, 0]]); hwRef.current?._stage?.update(); }}
              >
                🚩
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div class="teach-controls">
        <button id="ctrl-home"      class="teach-ctrl" title="Home"      onClick={() => navigate('index', 'back')}>⌂</button>
        <button id="ctrl-redo"      class="teach-ctrl" title="Redo"      onClick={onRedo}>↩</button>
        <button id="ctrl-blacklist" class="teach-ctrl" title="Blacklist" onClick={onBlacklist}>✕</button>
        <button id="ctrl-show"      class="teach-ctrl" title="Details"   onClick={onShow}>🔍</button>
      </div>
    </div>
  );
}
