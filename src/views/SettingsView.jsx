import { h } from 'preact';
import { useCallback, useRef, useEffect, useState } from 'preact/hooks';
import localforage from 'localforage';
import { Settings } from '/client/model/settings';
import { useReactive } from '../hooks/useReactive';

function Toggle({ id, label, settingKey }) {
  const value = useReactive(() => Settings.get(settingKey), [settingKey]);
  const onChange = useCallback((e) => {
    Settings.set(settingKey, e.target.checked);
  }, [settingKey]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <label class="toggle">
        <input id={id} type="checkbox" checked={value} onChange={onChange} />
        <span class="toggle-thumb"></span>
      </label>
    </div>
  );
}

function NumberInput({ id, label, settingKey, min, max }) {
  // Uncontrolled input: no `value` prop, so Preact never resets it on re-renders.
  // The 1-second timer re-renders will NOT affect the typed value.
  const inputRef = useRef(null);

  // Set the initial value imperatively on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = String(Settings.get(settingKey) ?? '');
    }
  }, [settingKey]); // re-runs if settingKey changes (different input)

  const onBlur = useCallback(() => {
    const raw = inputRef.current?.value ?? '';
    const v = parseInt(raw, 10);
    if (!isNaN(v)) {
      const lo = min ?? 0;
      const hi = max ?? 9999;
      const clamped = Math.max(lo, Math.min(hi, v));
      Settings.set(settingKey, clamped);
      // Show the clamped value
      if (inputRef.current) inputRef.current.value = String(clamped);
    } else {
      // Restore last good saved value
      if (inputRef.current) inputRef.current.value = String(Settings.get(settingKey) ?? '');
    }
  }, [settingKey, min, max]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <input
        ref={inputRef}
        id={id}
        class="number-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        onBlur={onBlur}
      />
    </div>
  );
}

function SelectInput({ id, label, settingKey, options }) {
  const value = useReactive(() => Settings.get(settingKey), [settingKey]);
  const onChange = useCallback((e) => {
    Settings.set(settingKey, e.target.value);
  }, [settingKey]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <select id={id} class="select-input" value={value} onChange={onChange}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const charsets = [
  { value: 'simplified',  label: 'Simplified' },
  { value: 'traditional', label: 'Traditional' },
];

export default function SettingsView() {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const doBackup = useCallback(async () => {
    try {
      const keys = await localforage.keys();
      const data = {};
      for (const k of keys) {
        data[k] = JSON.stringify(await localforage.getItem(k));
      }
      const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inkstone-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert('Backup failed: ' + e.message);
    }
  }, []);

  const doRestore = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!confirm('Restoring will overwrite your current progress. Continue?')) return;
          await localforage.clear();
          for (const k of Object.keys(data)) {
            await localforage.setItem(k, JSON.parse(data[k]));
          }
          location.reload();
        } catch(err) {
          alert('Restore failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
  }, []);

  const doClearProgress = useCallback(async () => {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    const answer = prompt(`This cannot be undone. Type "${code}" to confirm:`);
    if (answer === code) {
      await localforage.clear();
      location.reload();
    }
  }, []);

  const doCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      if (!('serviceWorker' in navigator)) {
        alert('Service workers are not supported in this browser / context.');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.active) {
        alert('No active service worker found. App may not be installed as a PWA.');
        return;
      }
      // Listen for a new waiting worker
      const newWorkerPromise = new Promise((resolve) => {
        if (reg.waiting) {
          resolve(reg.waiting);
          return;
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              resolve(installing);
            }
          });
        });
      });
      await reg.update();
      // Wait up to 5 seconds for the new worker
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      try {
        const newWorker = await Promise.race([newWorkerPromise, timeout]);
        if (!newWorker) {
          alert('App is already up to date.');
          return;
        }
      } catch {
        alert('App is already up to date.');
        return;
      }
      if (!confirm('A new version is available. Reload to update?')) return;
      // Tell the waiting worker to skip waiting and activate immediately
      const w = reg.waiting;
      if (w) {
        w.postMessage({ type: 'SKIP_WAITING' });
        // Reload after the new worker takes over
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
        // Fallback reload in case controllerchange doesn't fire
        setTimeout(() => {
          if (!reloading) {
            reloading = true;
            window.location.reload();
          }
        }, 2000);
      }
    } catch(e) {
      alert('Update check failed: ' + (e?.message || e));
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  return (
    <div class="settings-list">
      {/* Backups */}
      <div class="section-divider">Backups</div>
      <div class="list-item clickable" id="btn-backup" onClick={doBackup}>
        Backup to a file
      </div>
      <div class="list-item clickable" id="btn-restore" onClick={doRestore}>
        Restore from a file
      </div>

      {/* Graphics */}
      <div class="section-divider">Graphics</div>
      <NumberInput id="setting-canvas-width"  label="Canvas Width (%)"  settingKey="canvas_width"  min={40} max={100} />
      <Toggle      id="setting-regrade-icon"  label="Show Regrading Icon" settingKey="show_regrading_icon" />

      {/* Scheduling */}
      <div class="section-divider">Scheduling</div>
      <NumberInput id="setting-max-adds"    label="New Cards Per Day"  settingKey="max_adds"    min={0} max={200} />
      <NumberInput id="setting-max-reviews" label="Maximum Reviews Per Day"    settingKey="max_reviews"  min={0} max={500} />
      <Toggle      id="setting-revisit"     label="Revisit Failures"  settingKey="revisit_failures" />

      {/* Writing */}
      <div class="section-divider">Writing</div>
      <SelectInput id="setting-charset"   label="Character Set"   settingKey="character_set" options={charsets} />
      <NumberInput id="setting-dbl-tap"   label="Double-tap (ms)" settingKey="double_tap_speed" min={100} max={2000} />
      <Toggle      id="setting-reveal"    label="Reveal Order"    settingKey="reveal_order" />
      <Toggle      id="setting-snap"      label="Snap Strokes"    settingKey="snap_strokes" />

      {/* Updates */}
      <div class="section-divider">Updates</div>
      <div class="list-item clickable" id="btn-check-update" onClick={checkingUpdate ? undefined : doCheckUpdate}>
        {checkingUpdate ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Checking for updates
            <div class="spinner" style={{ margin: 0 }}></div>
          </span>
        ) : (
          'Check for updates'
        )}
      </div>

      {/* Danger */}
      <div class="section-divider">Danger Zone</div>
      <div class="list-item clickable danger" id="btn-clear-progress" onClick={doClearProgress}>
        Clear all progress
      </div>
    </div>
  );
}
