import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import './index.css';

import IndexView from './views/IndexView';
import TeachView from './views/TeachView';
import SettingsView from './views/SettingsView';
import ListsView from './views/ListsView';
import HelpView from './views/HelpView';
import StatisticsView from './views/StatisticsView';
import WelcomeView from './views/WelcomeView';
import AnswerPanel from './views/AnswerPanel';
import Popup from './views/Popup';

import { Timing } from '/client/model/timing';
import { useReactive } from './hooks/useReactive';
import { waitForDataLoad } from '/client/model/persistence';
import { Lists } from '/client/model/lists';

function formatRemainder(r) {
  if (!r) return '…';
  const total = r.adds + r.reviews + r.extras + r.failures;
  return `${total} left`;
}

const VIEWS = ['index', 'teach', 'rote', 'settings', 'lists', 'help', 'stats'];

export function App() {
  const [route, setRoute] = useState('index');
  const [prevRoute, setPrevRoute] = useState(null);
  const [popup, setPopup] = useState(null);  // {title, text, buttons, content}
  const [answerChar, setAnswerChar] = useState(null);
  const [slideDir, setSlideDir] = useState('forward');
  const [needDownload, setNeedDownload] = useState(false);
  const [checkingAssets, setCheckingAssets] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('inkstone_welcome_seen');
  });

  // Track storage health: warn user if data can't be saved
  const [storageWarning, setStorageWarning] = useState(null);

  // Keep a ref to the current route so navigate's callback always has the latest value
  const routeRef = useRef(route);
  routeRef.current = route;

  const remainder  = useReactive(() => Timing.getRemainder(), []);

  // Listen for storage persistence failures and surface them to the user
  useEffect(() => {
    const onStorageError = (e) => {
      const { table, keyCount } = e.detail;
      setStorageWarning(`Failed to save ${keyCount} item(s) to table "${table}". Your progress may not be saved. Check that your browser has storage space available.`);
    };
    window.addEventListener('inkstone-storage-error', onStorageError);
    return () => window.removeEventListener('inkstone-storage-error', onStorageError);
  }, []);

  // Hash-based answer panel
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const cp = parseInt(hash, 10);
        // Validate: must be a finite integer within the valid Unicode code point range
        if (Number.isFinite(cp) && cp >= 0 && cp <= 0x10FFFF) {
          setAnswerChar(String.fromCodePoint(cp));
        } else {
          // Invalid code point — clear the hash to avoid repeated bad state
          window.location.hash = '';
        }
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

  // Wait for persistent data (vocabulary, lists, timing, settings) to load from localforage
  useEffect(() => {
    waitForDataLoad().then(() => {
      Lists.loadEnabledLists().then(() => {
        setDataReady(true);
      }).catch(() => {
        setDataReady(true);
      });
    }).catch(() => {
      // Even if loading fails, show the app (data will be empty/default)
      setDataReady(true);
    });
  }, []);

  const navigate = useCallback((view, dir = 'forward') => {
    const currentRoute = routeRef.current;
    setPrevRoute(currentRoute);
    setSlideDir(dir);
    setRoute(view);
    // Push a new history entry so the Android/browser back button can return here
    history.pushState({ route: view, prevRoute: currentRoute }, '', '');
  }, []);

  // Replace the initial history entry's state so popstate always has a route to read
  useEffect(() => {
    history.replaceState({ route: 'index', prevRoute: null }, '', '');
  }, []);

  // Listen for browser/Android back button presses
  useEffect(() => {
    const onPopState = (event) => {
      if (event.state && event.state.route) {
        setPrevRoute(event.state.prevRoute || 'index');
        setSlideDir('back');
        setRoute(event.state.route);
      }
      // Hash-only entries (no route state) are handled by hashchange listener
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const goBack = useCallback(() => {
    history.back();
  }, []);

  const showPopup = useCallback((config) => setPopup(config), []);
  const hidePopup = useCallback(() => setPopup(null), []);

  const headerTitle = {
    index: 'Inkstone',
    teach: 'SRS Review',
    rote: 'Rote Review',
    settings: 'Settings',
    lists: 'Lists',
    help: 'Help',
    stats: 'Statistics',
  }[route] || 'Inkstone';

  const showBack = route !== 'index' && route !== 'teach' && route !== 'rote';

  const isReady = dataReady && !checkingAssets;

  const dismissWelcome = useCallback(() => {
    localStorage.setItem('inkstone_welcome_seen', '1');
    setShowWelcome(false);
  }, []);

  if (showWelcome) {
    return <WelcomeView onDismiss={dismissWelcome} />;
  }

  if (!isReady) {
    return (
      <div class="assets-view-container">
        <div class="loader-card">
          <div class="assets-logo">石</div>
          <h2 class="assets-title">Loading Inkstone...</h2>
          <div class="spinner" />
          <div class="status">Loading your data</div>
        </div>
      </div>
    );
  }



  return (
    <>
      {storageWarning && (
        <div class="storage-warning-banner" id="storage-warning" onClick={() => setStorageWarning(null)}>
          ⚠️ {storageWarning} (tap to dismiss)
        </div>
      )}
      <header class="app-header">
        <div class="header-left">
          {showBack && (
            <button class="btn-back" onClick={goBack} id="btn-nav-back">
              ← Done
            </button>
          )}
          {(route === 'teach' || route === 'rote') && (
            <button class="btn-back" onClick={() => navigate('index', 'back')} id="btn-teach-home">
              ⌂
            </button>
          )}
        </div>
        <div class="header-center">{headerTitle}</div>
        <div class="header-right">
          {(route === 'index' || route === 'teach' || route === 'rote') && (
            <span class="header-remainder">{formatRemainder(remainder)}</span>
          )}
        </div>
      </header>

      <div class="view" id={`view-${route}`} key={route}>
        {route === 'index'    && <IndexView navigate={navigate} />}
        {route === 'teach'    && <TeachView showPopup={showPopup} hidePopup={hidePopup} navigate={navigate} roteMode={false} />}
        {route === 'rote'     && <TeachView showPopup={showPopup} hidePopup={hidePopup} navigate={navigate} roteMode={true} />}
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