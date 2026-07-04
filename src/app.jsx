import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import './index.css';

import IndexView from './views/IndexView';
import TeachView from './views/TeachView';
import SettingsView from './views/SettingsView';
import ListsView from './views/ListsView';
import HelpView from './views/HelpView';
import StatisticsView from './views/StatisticsView';
import AnswerPanel from './views/AnswerPanel';
import Popup from './views/Popup';

import { Timing } from '/client/model/timing';
import { useReactive } from './hooks/useReactive';

function formatRemainder(r) {
  if (!r) return '…';
  const total = r.adds + r.reviews + r.extras + r.failures;
  return `${total} left`;
}

const VIEWS = ['index', 'teach', 'settings', 'lists', 'help', 'stats'];

export function App() {
  const [route, setRoute] = useState('index');
  const [prevRoute, setPrevRoute] = useState(null);
  const [popup, setPopup] = useState(null);  // {title, text, buttons, content}
  const [answerChar, setAnswerChar] = useState(null);
  const [slideDir, setSlideDir] = useState('forward');
  const [needDownload, setNeedDownload] = useState(false);
  const [checkingAssets, setCheckingAssets] = useState(true);

  const remainder  = useReactive(() => Timing.getRemainder(), []);

  // Hash-based answer panel
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const ch = String.fromCodePoint(parseInt(hash, 10));
        setAnswerChar(ch);
      } else {
        setAnswerChar(null);
      }
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Check for missing character database assets on load (always ready since self-hosted)
  useEffect(() => {
    setNeedDownload(false);
    setCheckingAssets(false);
  }, []);


  const navigate = useCallback((view, dir = 'forward') => {
    setPrevRoute(route);
    setSlideDir(dir);
    setRoute(view);
  }, [route]);

  const goBack = useCallback(() => navigate('index', 'back'), [navigate]);

  const showPopup = useCallback((config) => setPopup(config), []);
  const hidePopup = useCallback(() => setPopup(null), []);

  const headerTitle = {
    index: 'Inkstone',
    teach: 'Write',
    settings: 'Settings',
    lists: 'Lists',
    help: 'Help',
    stats: 'Statistics',
  }[route] || 'Inkstone';

  const showBack = route !== 'index' && route !== 'teach';

  if (checkingAssets) {
    return (
      <div class="assets-view-container">
        <div class="loader-card">
          <div class="assets-logo">石</div>
          <h2 class="assets-title">Loading Inkstone...</h2>
          <div class="status">Checking database status</div>
        </div>
      </div>
    );
  }



  return (
    <>
      <header class="app-header">
        <div class="header-left">
          {showBack && (
            <button class="btn-back" onClick={goBack} id="btn-nav-back">
              ← Done
            </button>
          )}
          {route === 'teach' && (
            <button class="btn-back" onClick={() => navigate('index', 'back')} id="btn-teach-home">
              ⌂
            </button>
          )}
        </div>
        <div class="header-center">{headerTitle}</div>
        <div class="header-right">
          {(route === 'index' || route === 'teach') && (
            <span class="header-remainder">{formatRemainder(remainder)}</span>
          )}
        </div>
      </header>

      <div class="view" id={`view-${route}`} key={route}>
        {route === 'index'    && <IndexView navigate={navigate} />}
        {route === 'teach'    && <TeachView showPopup={showPopup} hidePopup={hidePopup} navigate={navigate} />}
        {route === 'settings' && <SettingsView />}
        {route === 'lists'    && <ListsView />}
        {route === 'help'     && <HelpView />}
        {route === 'stats'    && <StatisticsView />}
      </div>

      {answerChar && (
        <AnswerPanel
          character={answerChar}
          onClose={() => { window.location.hash = ''; }}
          onNavigate={(cp) => { window.location.hash = cp; }}
        />
      )}

      {popup && (
        <Popup {...popup} onClose={hidePopup} />
      )}
    </>
  );
}

