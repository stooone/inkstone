import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { readCharacter } from '/client/assets';
import { getAnimationData } from '/lib/animation';
import { Decomposition } from '/lib/decomposition';

const kUnknown = '(unknown)';

// ─── helpers ──────────────────────────────────────────────────────────────────

const lower = (s) => (s && s.length > 0) ? s[0].toLowerCase() + s.slice(1) : s;

const formatEtymology = (ety) => {
  const parts = [ety.type];
  if (ety.type === 'ideographic' || ety.type === 'pictographic') {
    if (ety.hint) parts.push(`- ${lower(ety.hint)}`);
  } else {
    parts.push('-');
    parts.push(ety.semantic || '?');
    if (ety.hint) parts.push(`(${lower(ety.hint)})`);
    parts.push('provides the meaning while');
    parts.push(ety.phonetic || '?');
    parts.push('provides the pronunciation.');
  }
  return parts.join(' ');
};

const buildTree = (row) => {
  const tree = Decomposition.convertDecompositionToTree(row.decomposition);
  const augment = (node) => {
    if (node.type === 'compound') {
      node.class = 'ids';
      node.label = lower(Decomposition.ids_data[node.value]?.label || '');
      (node.children || []).forEach(augment);
    } else {
      node.label = (row.dependencies || {})[node.value] || kUnknown;
      if ((row.dependencies || {})[node.value]) {
        node.codepoint = node.value.charCodeAt(0);
      }
    }
  };
  augment(tree);
  return tree;
};

// Linkify CJK characters
const linkifyValue = (value, onNav) => {
  if (!value) return value;
  return value.split('').map((ch, i) => {
    if (/[\u2E80-\u2EFF\u3400-\u9FBF]/.test(ch)) {
      return (
        <a key={i} class="field-link" onClick={() => onNav(ch.charCodeAt(0))} style="cursor:pointer;color:var(--accent)">
          {ch}
        </a>
      );
    }
    return ch;
  });
};

// ─── StrokeAnimation ──────────────────────────────────────────────────────────

function StrokeAnimation({ data, onReset }) {
  if (!data) return null;
  const { animations, strokes } = data;
  const vb = '0 0 1024 1024';

  return (
    <svg
      class="stroke-animation"
      viewBox={vb}
      width="200"
      height="200"
      onClick={onReset}
      style="cursor:pointer;display:block"
      title="Tap to replay animation"
    >
      <defs>
        {animations.map((anim) => (
          <clipPath key={anim.clip_id} id={anim.clip_id}>
            <rect x="0" y="0" width="1024" height="1024" />
          </clipPath>
        ))}
      </defs>
      <g transform="scale(1,-1) translate(0,-900)">
        {/* Background strokes */}
        {strokes.map((stroke, i) => (
          <path
            key={`bg-${i}`}
            d={stroke}
            fill="var(--border)"
            clip-path={`url(#${animations[i]?.clip_id})`}
          />
        ))}
        {/* Animated strokes */}
        {animations.map((anim) => (
          <g key={anim.animation_id} clip-path={`url(#${anim.clip_id})`}>
            <path d={anim.stroke} fill="none" stroke="var(--accent)" stroke-width={anim.width} />
            <style>{`
              @keyframes ${anim.keyframes} {
                0%   { stroke-dashoffset: ${anim.offset}; }
                ${anim.fraction} { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: 0; }
              }
            `}</style>
            <path
              d={anim.d}
              fill="none"
              stroke="var(--accent)"
              stroke-width={anim.width * 2}
              stroke-dasharray={`${anim.length} ${anim.spacing}`}
              stroke-dashoffset={anim.offset}
              style={{
                animation: `${anim.keyframes} ${anim.duration} ${anim.delay} ease-out both`,
              }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ─── DecompNode (recursive) ───────────────────────────────────────────────────

function DecompNode({ node, depth = 0, onNav }) {
  if (!node) return null;
  return (
    <div style={{ paddingLeft: depth > 0 ? '20px' : '0' }}>
      <div class="decomp-node">
        <span class="decomp-val">{node.value}</span>
        <span style="color:var(--text-muted)">—</span>
        {node.codepoint ? (
          <a class="decomp-link" onClick={() => onNav(node.codepoint)}>{node.label}</a>
        ) : (
          <span class="decomp-label">{node.label}</span>
        )}
      </div>
      {(node.children || []).map((child, i) => (
        <DecompNode key={i} node={child} depth={depth + 1} onNav={onNav} />
      ))}
    </div>
  );
}

// ─── AnswerPanel ──────────────────────────────────────────────────────────────

export default function AnswerPanel({ character, onClose, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const bodyRef = useRef(null);
  const animKeyRef = useRef(0); // increment to force animation replay

  const [animKey, setAnimKey] = useState(0);

  const load = useCallback(async (ch) => {
    setLoading(true);
    setData(null);
    try {
      const row = await readCharacter(ch);
      setData(row);
    } catch (e) {
      console.error('AnswerPanel load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (character) {
      load(character);
      bodyRef.current?.scrollTo(0, 0);
    }
  }, [character, load]);

  const handleNav = useCallback((codepoint) => {
    onNavigate(codepoint);
  }, [onNavigate]);

  const handleReset = useCallback(() => {
    setAnimKey(k => k + 1);
  }, []);

  // Build metadata rows
  const metadata = data ? [
    { label: 'Def', value: data.definition || kUnknown, raw: true },
    { label: 'Pin', value: (data.pinyin || []).join(', ') || kUnknown },
    { label: 'Rad', value: data.radical || kUnknown },
    ...(data.etymology ? [{ label: 'For', value: formatEtymology(data.etymology) }] : []),
  ] : [];

  const animData = data
    ? getAnimationData(data.strokes, data.medians)
    : null;

  const tree = data ? buildTree(data) : null;

  return (
    <div class={`answer-panel ${character ? 'visible' : ''}`} id="answer-panel">
      {/* Header */}
      <div class="answer-header">
        {data && <span class="answer-char">{character}</span>}
        <span class="answer-title">
          {loading ? 'Loading…' : `Details for ${character}`}
        </span>
        <button id="btn-answer-back" class="btn-back" onClick={onClose}>
          ← Done
        </button>
      </div>

      {/* Body */}
      <div class="answer-body" ref={bodyRef}>
        {loading && (
          <div style="text-align:center;padding:40px;color:var(--text-muted)">
            Loading character data…
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stroke order animation */}
            <div class="answer-animation">
              <StrokeAnimation key={animKey} data={animData} onReset={handleReset} />
            </div>

            {/* Metadata panel */}
            <div class="panel-section">
              <div class="panel-heading">Metadata</div>
              <div class="panel-body">
                {metadata.map((field) => (
                  <div class="metadata-field" key={field.label}>
                    <span class="field-label">{field.label}</span>
                    <span class="field-value">
                      {field.raw
                        ? linkifyValue(field.value, handleNav)
                        : field.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decomposition panel */}
            {tree && (
              <div class="panel-section">
                <div class="panel-heading">Decomposition</div>
                <div class="panel-body">
                  <DecompNode node={tree} onNav={handleNav} />
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !data && (
          <div style="text-align:center;padding:40px;color:var(--text-muted)">
            Character data unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
