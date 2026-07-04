import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { Lists } from '/client/model/lists';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';
import { readList, removeList, writeList } from '/client/assets';

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

function ListToggle({ id, label, listKey, isCustom, onDelete, onAddWord }) {
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

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete list "${label}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      if (enabled) {
        Vocabulary.dropList(listKey);
        Lists.disable(listKey);
      }
      await removeList(listKey);
      Lists.deleteList(listKey);
      if (onDelete) onDelete();
    } catch(e) {
      console.error(e);
      alert('Delete failed: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [listKey, label, enabled, onDelete]);

  const handleAddClick = useCallback(() => {
    if (onAddWord) onAddWord();
  }, [onAddWord]);

  return (
    <div class="list-item">
      <span>{label}</span>
      <div class="list-item-actions">
        {listKey === 'manually' && (
          <button
            class="add-btn"
            onClick={handleAddClick}
            disabled={loading}
            title="Add words"
          >+</button>
        )}
        {isCustom && listKey !== 'manually' && (
          <button
            class="remove-btn"
            onClick={handleDelete}
            disabled={loading}
            title="Delete list"
          >✕</button>
        )}
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

const kStaticLists = Object.freeze([
  '100cr', 'manually', 'nhsk1', 'nhsk2', 'nhsk3', 'nhsk4', 'nhsk5', 'nhsk6',
]);

function AddWordView({ listKey, onBack }) {
  const [simplified, setSimplified] = useState('');
  const [traditional, setTraditional] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [definition, setDefinition] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addWord = useCallback(async () => {
    setError('');
    if (!simplified.trim() && !traditional.trim()) {
      setError('Please enter at least a simplified or traditional character.');
      return;
    }
    setSaving(true);
    try {
      // Read existing list data
      const existingRows = await readList(listKey).catch(() => []);
      const newRow = {
        simplified: simplified.trim(),
        traditional: traditional.trim() || simplified.trim(),
        numbered: pinyin.trim(),
        pinyin: pinyin.trim(),
        definition: definition.trim(),
      };
      // Append new word
      const allRows = [...existingRows, newRow];
      await writeList(listKey, allRows);
      // If list is enabled, add to vocabulary (skip if charset field is empty)
      if (Lists.isListEnabled(listKey)) {
        const charset = Settings.get('character_set');
        const word = newRow[charset];
        if (word) Vocabulary.addItem(word, listKey);
      }
      setSimplified('');
      setTraditional('');
      setPinyin('');
      setDefinition('');
    } catch(e) {
      setError('Failed to save: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [simplified, traditional, pinyin, definition, listKey]);

  // Allow Enter key to submit
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addWord();
    }
  }, [addWord]);

  return (
    <div class="add-word-view">
      <div class="add-word-header">
        <button class="btn-back" onClick={onBack}>← Back</button>
        <span class="add-word-title">Add Word</span>
        <div class="flex-spacer"></div>
      </div>
      <div class="add-word-body">
        {error && <div class="add-word-error">{error}</div>}
        <div class="modal-field">
          <label>Simplified</label>
          <input
            type="text"
            value={simplified}
            onInput={(e) => setSimplified(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 你好"
            autofocus
          />
        </div>
        <div class="modal-field">
          <label>Traditional</label>
          <input
            type="text"
            value={traditional}
            onInput={(e) => setTraditional(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 你好"
          />
        </div>
        <div class="modal-field">
          <label>Pinyin</label>
          <input
            type="text"
            value={pinyin}
            onInput={(e) => setPinyin(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. nǐ hǎo"
          />
        </div>
        <div class="modal-field">
          <label>Definition</label>
          <input
            type="text"
            value={definition}
            onInput={(e) => setDefinition(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. hello"
          />
        </div>
        <button
          class="add-word-submit"
          onClick={addWord}
          disabled={saving || (!simplified.trim() && !traditional.trim())}
        >
          {saving ? 'Saving…' : 'Add Word'}
        </button>
      </div>
    </div>
  );
}

export default function ListsView() {
  const [subview, setSubview] = useState(null); // null | 'blacklist' | 'addword'
  const [allLists, setAllLists] = useState(() => Lists.getAllLists());
  const groups = toListGroups(allLists);

  const refreshLists = useCallback(() => {
    setAllLists(Lists.getAllLists());
  }, []);

  // File import handler
  // Must trigger file picker directly from click (before any prompt() consumes the user gesture)
  const doImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,.txt';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;
      // Now prompt for metadata (no gesture needed for prompt())
      const category = prompt('Category name:');
      if (!category) return;
      const name = prompt('List name:');
      if (!name) return;
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
        alert('Import failed: ' + (err?.message || err));
      }
    };
    document.body.appendChild(input);
    input.click();
  }, []);

  if (subview === 'blacklist') {
    return <BlacklistView onBack={() => setSubview(null)} />;
  }
  if (subview === 'addword') {
    return <AddWordView listKey="manually" onBack={() => setSubview(null)} />;
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
                isCustom={!kStaticLists.includes(list.id)}
                onDelete={refreshLists}
                onAddWord={list.id === 'manually' ? () => setSubview('addword') : null}
              />
          ))}
        </div>
      ))}
    </div>
  );
}
