import { h } from 'preact';
import { useEffect } from 'preact/hooks';

/**
 * Popup
 * Props: title, text, buttons, onClose
 * buttons: [{label, callback, class}]
 */
export default function Popup({ title, text, buttons = [], onClose }) {
  // Close on backdrop click
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div class="popup-backdrop" onClick={onBackdrop} id="popup-backdrop">
      <div class="popup-box" role="dialog" aria-modal="true" aria-labelledby="popup-title">
        {title && <div class="popup-title" id="popup-title">{title}</div>}
        {text  && <div class="popup-text">{text}</div>}
        {buttons.length > 0 && (
          <div class="popup-actions">
            {buttons.map((btn, i) => (
              <button
                key={i}
                id={`popup-btn-${i}`}
                class={`popup-btn ${btn.class || ''}`}
                onClick={() => {
                  if (btn.callback) btn.callback();
                  if (!btn.keepOpen) onClose();
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
