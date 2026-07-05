import { h } from 'preact';

export default function WelcomeView({ onDismiss }) {
  return (
    <div id="view-welcome">
      <div class="welcome-card">
        <div class="welcome-logo">石</div>
        <h1 class="welcome-title">Welcome to Inkstone</h1>
        <p class="welcome-subtitle">
          Learn to write Chinese characters with handwriting recognition
          and intelligent review scheduling.
        </p>

        <div class="welcome-modes">
          <div class="welcome-mode">
            <div class="welcome-mode-icon">📝</div>
            <h3>SRS Review</h3>
            <p>
              Spaced repetition — cards are scheduled based on how well you write them.
            </p>
          </div>
          <div class="welcome-mode">
            <div class="welcome-mode-icon">🔄</div>
            <h3>Rote Review</h3>
            <p>
              Repetitive practice — characters repeat 3× with strokes revealed, no SRS impact.
            </p>
          </div>
        </div>

        <div class="welcome-tips">
          <ul>
            <li>Enable word lists in <strong>Lists</strong> to choose what to learn</li>
            <li>Import your own custom lists or adjust daily limits in <strong>Settings</strong></li>
          </ul>
        </div>

        <button
          class="welcome-btn"
          onClick={onDismiss}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
