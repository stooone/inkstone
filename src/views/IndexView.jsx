import { h } from 'preact';

export default function IndexView({ navigate }) {
  return (
    <div id="view-index">
      <div class="index-logo">石</div>
      <div class="index-title">Inkstone</div>
      <div class="index-version">Beta</div>

      <div class="index-main-buttons">
        <button
          id="btn-write"
          class="btn-write"
          onClick={() => navigate('teach')}
        >
          SRS Review
        </button>
        <button
          id="btn-rote"
          class="btn-rote"
          onClick={() => navigate('rote')}
        >
          Rote Review
        </button>
      </div>

      <div class="index-options">
        <button
          id="btn-nav-lists"
          class="btn-option"
          onClick={() => navigate('lists')}
        >
          <span class="icon">☰</span>
          Lists
        </button>
        <button
          id="btn-nav-settings"
          class="btn-option"
          onClick={() => navigate('settings')}
        >
          <span class="icon">⚙</span>
          Settings
        </button>
        <button
          id="btn-nav-help"
          class="btn-option"
          onClick={() => navigate('help')}
        >
          <span class="icon">?</span>
          Help
        </button>
        <button
          id="btn-nav-stats"
          class="btn-option"
          onClick={() => navigate('stats')}
        >
          <span class="icon">📊</span>
          Stats
        </button>
      </div>
      <div class="index-version index-website">inkstoneapp.net</div>
    </div>
  );
}
