import { h } from 'preact';
import { useCallback } from 'preact/hooks';
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
  const value = useReactive(() => Settings.get(settingKey), [settingKey]);
  const onChange = useCallback((e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) {
      Settings.set(settingKey, v);
    }
  }, [settingKey]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <input
        id={id}
        class="number-input"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={onChange}
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
  const doBackup = useCallback(() => {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        data[k] = localStorage.getItem(k);
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
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!confirm('Restoring will overwrite your current progress. Continue?')) return;
          Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
          location.reload();
        } catch(err) {
          alert('Restore failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const doClearProgress = useCallback(() => {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    const answer = prompt(`This cannot be undone. Type "${code}" to confirm:`);
    if (answer === code) {
      localStorage.clear();
      location.reload();
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
      <Toggle      id="setting-paper-filter"  label="Paper Filter"       settingKey="paper_filter" />
      <Toggle      id="setting-regrade-icon"  label="Show Regrading Icon" settingKey="show_regrading_icon" />

      {/* Scheduling */}
      <div class="section-divider">Scheduling</div>
      <NumberInput id="setting-max-adds"    label="New Cards Per Day"  settingKey="max_adds"    min={0} max={200} />
      <NumberInput id="setting-max-reviews" label="Reviews Per Day"    settingKey="max_reviews"  min={0} max={500} />
      <Toggle      id="setting-revisit"     label="Revisit Failures"  settingKey="revisit_failures" />

      {/* Writing */}
      <div class="section-divider">Writing</div>
      <SelectInput id="setting-charset"   label="Character Set"   settingKey="character_set" options={charsets} />
      <NumberInput id="setting-dbl-tap"   label="Double-tap (ms)" settingKey="double_tap_speed" min={100} max={2000} />
      <Toggle      id="setting-reveal"    label="Reveal Order"    settingKey="reveal_order" />
      <Toggle      id="setting-snap"      label="Snap Strokes"    settingKey="snap_strokes" />

      {/* Danger */}
      <div class="section-divider">Danger Zone</div>
      <div class="list-item clickable danger" id="btn-clear-progress" onClick={doClearProgress}>
        Clear all progress
      </div>
    </div>
  );
}
