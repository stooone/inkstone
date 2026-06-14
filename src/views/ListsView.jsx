import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { Lists } from '/client/model/lists';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';
import { readList } from '/client/assets';

// Sort key that pads trailing numbers so "HSK Level 2" < "HSK Level 10"
const comparisonKey = (name) => {
  const tokens = name.split(' ');
  const last = tokens[tokens.length - 1];
  if (!isNaN(parseInt(last, 10))) {
    tokens[tokens.length - 1] = last.padStart(8, '0');
  }
  return tokens.join(' ');
};

const toListGroups = (allLists) => {
  const groups = {};
  Object.entries(allLists).forEach(([id, meta]) => {
    if (!groups[meta.category]) groups[meta.category] = [];
    groups[meta.category].push({ id, label: meta.name, key: comparisonKey(meta.name) });
  });
  return Object.keys(groups).sort().map((cat) => ({
    label: cat,
    lists: groups[cat].sort((a, b) => a.key > b.key ? 1 : -1),
  }));
};

function ListToggle({ id, label, listKey }) {
  const [enabled, setEnabled] = useState(() => Lists.isListEnabled(listKey));
  const [loading, setLoading] = useState(false);

  const onChange = useCallback(async (e) => {
    const on = e.target.checked;
    setLoading(true);
    try {
      if (on) {
        const rows = await readList(listKey);
        const charset = Settings.get('character_set');
        rows.forEach((row) => Vocabulary.addItem(row[charset], listKey));
        Lists.enable(listKey);
      } else {
        Vocabulary.dropList(listKey);
        Lists.disable(listKey);
      }
      setEnabled(on);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [listKey]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <label class="toggle">
        <input
          id={`toggle-list-${id}`}
          type="checkbox"
          checked={enabled}
          disabled={loading}
          onChange={onChange}
        />
        <span class="toggle-thumb" style={loading ? 'opacity:.5' : ''}></span>
      </label>
    </div>
  );
}

function BlacklistView({ onBack }) {
  const [items, setItems] = useState(() => Vocabulary.getBlacklistedWords() || []);

  const removeItem = useCallback((item) => {
    Vocabulary.updateBlacklist(item, false);
    setItems((prev) => prev.filter(i => i.word !== item.word));
  }, []);

  const clearAll = useCallback(() => {
    if (!confirm('Clear the entire blacklist?')) return;
    items.forEach(i => Vocabulary.updateBlacklist(i, false));
    setItems([]);
    onBack();
  }, [items, onBack]);

  return (
    <div class="lists-list">
      <div class="section-divider">Manage Blacklist</div>
      {items.length === 0 ? (
        <div class="list-item clickable" id="btn-blacklist-back" onClick={onBack}>
          No blacklisted words. Tap to go back.
        </div>
      ) : (
        <>
          <div class="list-item clickable danger" id="btn-clear-blacklist" onClick={clearAll}>
            Clear blacklist
          </div>
          <div class="section-divider">Blacklisted Words</div>
          {items.map(item => (
            <div class="list-item" key={item.word}>
              <div class="blacklist-item">
                <span class="blacklist-word">{item.word}</span>
                <span class="blacklist-info">{item.pinyin} — {item.definition}</span>
              </div>
              <button
                class="remove-btn"
                onClick={() => removeItem(item)}
                title="Remove from blacklist"
              >✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function ListsView() {
  const [subview, setSubview] = useState(null); // null | 'blacklist'
  const [allLists, setAllLists] = useState(() => Lists.getAllLists());
  const groups = toListGroups(allLists);

  // File import handler
  const doImport = useCallback(() => {
    const category = prompt('Category name:');
    if (!category) return;
    const name = prompt('List name:');
    if (!name) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,.txt';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const rows = JSON.parse(text);
        const id = `custom.${Date.now()}`;
        // Persist the list data to assets store via IDB
        const { writeList } = await import('/client/assets');
        await writeList(id, rows);
        Lists.addList(id, { category, name });
        setAllLists(Lists.getAllLists());
      } catch(err) {
        alert('Import failed: ' + err.message);
      }
    };
    input.click();
  }, []);

  if (subview === 'blacklist') {
    return <BlacklistView onBack={() => setSubview(null)} />;
  }

  return (
    <div class="lists-list">
      {/* Actions */}
      <div class="section-divider">Customization</div>
      <div class="list-item clickable" id="btn-import-list" onClick={doImport}>
        Import a word list
      </div>
      <div class="list-item clickable" id="btn-manage-blacklist" onClick={() => setSubview('blacklist')}>
        Manage blacklist
      </div>

      {/* All lists grouped by category */}
      {groups.map(group => (
        <div key={group.label}>
          <div class="section-divider">{group.label}</div>
          {group.lists.map(list => (
            <ListToggle
              key={list.id}
              id={list.id}
              label={list.label}
              listKey={list.id}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
