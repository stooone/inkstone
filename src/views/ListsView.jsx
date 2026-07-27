import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { Lists } from '/client/model/lists';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';
import { readList, removeList, writeList } from '/client/assets';
import { timestamp } from '/lib/base';

const kStaticLists = Object.freeze([
  '100cr', 'manually', 'nhsk1', 'nhsk2', 'nhsk3', 'nhsk4', 'nhsk5', 'nhsk6',
]);

const formatDue = (next) => {
  if (next == null) return '—';
  const now = timestamp();
  const diff = next - now;
  if (diff <= 0) return 'Due now';
  if (diff < 60) return 'Due <1m';
  if (diff < 3600) return `Due ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Due ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Due ${Math.floor(diff / 86400)}d`;
  return `Due ${Math.floor(diff / 86400)}d+`;
};

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

function ListToggle({ id, label, listKey, isCustom, onDelete, onAddWord, onViewWords }) {
  const [enabled, setEnabled] = useState(() => Lists.isListEnabled(listKey));
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readList(listKey).then((data) => {
      if (!cancelled) setCount(data.length);
    }).catch(() => {
      if (!cancelled) setCount(0);
    });
    return () => { cancelled = true; };
  }, [listKey]);

  const onChange = useCallback(async (e) => {
    const on = e.target.checked;
    setLoading(true);
    try {
      if (on) {
        const data = await readList(listKey);
        const charset = Settings.get('character_set');
        data.forEach((row) => {
          const word = row[charset];
          if (word) Vocabulary.addItem(word, listKey);
        });
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

  const handleAddClick = useCallback((e) => {
    e.stopPropagation();
    if (onAddWord) onAddWord();
  }, [onAddWord]);

  const handleClick = useCallback(() => {
    if (onViewWords) onViewWords(listKey);
  }, [listKey, onViewWords]);

  const countStr = count !== null ? ` (${count})` : '';

  return (
    <div class="list-toggle-group">
      <div class="list-item clickable" onClick={handleClick}>
        <span>{label}{countStr}</span>
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
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={loading}
              title="Delete list"
            >🗑</button>
          )}
          <label class="toggle" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

function ListWordView({ listKey, onBack, onAddWord }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingIdx, setDeletingIdx] = useState(null);
  const [blacklistingIdx, setBlacklistingIdx] = useState(null);

  const isBuiltIn = listKey !== 'manually' && kStaticLists.includes(listKey);
  const listName = Lists.getAllLists()[listKey]?.name || listKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readList(listKey);
        if (!cancelled) setRows(data || []);
      } catch(e) {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listKey]);

  const vocabItems = Vocabulary.getAllItems();
  const vocabIndex = {};
  vocabItems.forEach(item => { vocabIndex[item.word] = item; });
  const charset = Settings.get('character_set');

  const blacklistItem = useCallback(async (idx) => {
    const row = rows[idx];
    if (!row) return;
    setBlacklistingIdx(idx);
    try {
      const word = row[charset] || row.simplified || row.traditional;
      Vocabulary.updateBlacklist({ word, pinyin: row.pinyin, definition: row.definition }, true);
      setRows(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], _blacklisted: true };
        return updated;
      });
    } catch(e) {
      alert('Blacklist failed: ' + (e?.message || e));
    } finally {
      setBlacklistingIdx(null);
    }
  }, [rows, charset]);

  const deleteRow = useCallback(async (idx) => {
    const currentRows = rows;
    const rowToDelete = currentRows[idx];
    if (!rowToDelete) return;
    setDeletingIdx(idx);
    try {
      const enabled = Lists.isListEnabled(listKey);
      if (enabled) {
        const word = rowToDelete[charset] || rowToDelete.simplified || rowToDelete.traditional;
        if (word) {
          Vocabulary.dropList(listKey);
          const remaining = currentRows.filter((_, i) => i !== idx);
          remaining.forEach((row) => {
            const w = row[charset] || row.simplified || row.traditional;
            if (w) Vocabulary.addItem(w, listKey);
          });
        }
      }
      const updated = currentRows.filter((_, i) => i !== idx);
      await writeList(listKey, updated);
      setRows(updated);
    } catch(e) {
      alert('Delete failed: ' + (e?.message || e));
    } finally {
      setDeletingIdx(null);
    }
  }, [rows, listKey, charset]);

  const handleAddWord = useCallback(() => {
    if (onAddWord) {
      onAddWord();
    }
  }, [onAddWord]);

  return (
    <div class="lists-list">
      <div class="list-word-view-header">
        <button class="btn-back" onClick={onBack}>← Back</button>
        <span class="list-word-view-title">{listName}</span>
        {listKey === 'manually' && (
          <button class="add-btn" onClick={handleAddWord} title="Add words">+</button>
        )}
      </div>
      {loading ? (
        <div class="list-word-row muted">Loading…</div>
      ) : rows && rows.length > 0 ? (
        rows.map((row, idx) => {
          const word = row[charset] || row.simplified || row.traditional || '?';
          const vocabEntry = vocabIndex[word];
          const due = vocabEntry ? formatDue(vocabEntry.next) : '—';
          return (
            <div class="list-word-row" key={idx}>
              <div class="list-word-info">
                <span class="list-word-char" style={row._blacklisted ? 'opacity:0.4;text-decoration:line-through' : ''}>{word}</span>
                <span class="list-word-meta">{row.pinyin} — {row.definition}</span>
              </div>
              <span class="list-word-due">{due}</span>
              {isBuiltIn ? (
                <button
                  class="blacklist-btn"
                  onClick={() => blacklistItem(idx)}
                  disabled={blacklistingIdx === idx || row._blacklisted}
                  title="Blacklist word"
                >
                  {blacklistingIdx === idx ? '…' : row._blacklisted ? '✓' : '✕'}
                </button>
              ) : (
                <button
                  class="trash-btn"
                  onClick={() => deleteRow(idx)}
                  disabled={deletingIdx === idx}
                  title="Delete word"
                >
                  {deletingIdx === idx ? '…' : '🗑'}
                </button>
              )}
            </div>
          );
        })
      ) : (
        <div class="list-word-row muted">No words in this list.</div>
      )}
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
              >🗑</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AddWordView({ listKey, onBack }) {
  const [simplified, setSimplified] = useState('');
  const [traditional, setTraditional] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [definition, setDefinition] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: null, visible: false });

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => setToast({ message: null, visible: false }), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const addWord = useCallback(async () => {
    setError('');
    if (!simplified.trim() && !traditional.trim()) {
      setError('Please enter at least a simplified or traditional character.');
      return;
    }
    setSaving(true);
    try {
      const existingRows = await readList(listKey).catch(() => []);
      const newRow = {
        simplified: simplified.trim(),
        traditional: traditional.trim() || simplified.trim(),
        numbered: pinyin.trim(),
        pinyin: pinyin.trim(),
        definition: definition.trim(),
      };
      const allRows = [...existingRows, newRow];
      await writeList(listKey, allRows);
      if (Lists.isListEnabled(listKey)) {
        const charset = Settings.get('character_set');
        const word = newRow[charset];
        if (word) Vocabulary.addItem(word, listKey);
      }
      setSimplified('');
      setTraditional('');
      setPinyin('');
      setDefinition('');
      setToast({ message: 'Word added successfully!', visible: true });
    } catch(e) {
      setError('Failed to save: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [simplified, traditional, pinyin, definition, listKey]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addWord();
    }
  }, [addWord]);

  return (
    <div class="add-word-view">
      {toast.visible && <div class="srs-toast">{toast.message}</div>}
      <div class="add-word-header">
        <button class="btn-back" onClick={onBack}>← Back</button>
        <span class="add-word-title">Add Word</span>
        <div class="flex-spacer"></div>
      </div>
      <div class="add-word-body">
        {error && <div class="add-word-error">{error}</div>}
        <div class="add-word-info">
          Pinyin and definition are needed for every entry. Simplified or Traditional can be left empty, but if the field matching your Character Set setting (Settings → Writing → Character Set) is empty, the word won't be displayed during study. You can change the setting later.
        </div>
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
  const [subview, setSubview] = useState(null); // null | 'blacklist' | 'addword' | 'list-<key>'
  const [addWordListKey, setAddWordListKey] = useState('manually');
  const [allLists, setAllLists] = useState(() => Lists.getAllLists());
  const groups = toListGroups(allLists);

  const refreshLists = useCallback(() => {
    setAllLists(Lists.getAllLists());
  }, []);

  // Listen for back navigation so Android's back button goes back to the
  // main lists view instead of leaving the page.
  useEffect(() => {
    const onPopState = () => {
      if (subview !== null) {
        setSubview(null);
        refreshLists();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [subview, refreshLists]);

  const goToSubview = useCallback((view) => {
    history.pushState({ route: 'lists', subview: view }, '', '');
    setSubview(view);
  }, []);

  const goBackFromSubview = useCallback(() => {
    history.back();
  }, []);

  const viewWords = useCallback((listKey) => {
    goToSubview('list-' + listKey);
  }, [goToSubview]);

  const handleAddWord = useCallback((listKey) => {
    setAddWordListKey(listKey);
    goToSubview('addword');
  }, [goToSubview]);

  const doImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,.txt';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;
      const category = prompt('Category name:');
      if (!category) return;
      const name = prompt('List name:');
      if (!name) return;
      try {
        const text = await file.text();
        const rows = JSON.parse(text);

        // Validate that rows is a non-empty array
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('Imported data must be a non-empty array of word objects.');
        }

        // Validate each row has the required fields
        const requiredFields = ['simplified', 'traditional', 'pinyin', 'definition'];
        const validRows = [];
        const skippedRows = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || typeof row !== 'object') {
            skippedRows.push({ index: i, reason: 'not an object' });
            continue;
          }
          // Must have at least simplified or traditional
          if (!row.simplified && !row.traditional) {
            skippedRows.push({ index: i, reason: 'missing simplified and traditional' });
            continue;
          }
          // Must have pinyin and definition
          if (!row.pinyin || !row.definition) {
            skippedRows.push({ index: i, reason: 'missing pinyin or definition' });
            continue;
          }
          // Validate character fields contain only printable characters (no tabs, control chars)
          const charFields = ['simplified', 'traditional'];
          let hasInvalidChars = false;
          for (const field of charFields) {
            if (row[field] && typeof row[field] === 'string') {
              if (/[\t\r\n]/.test(row[field]) || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(row[field])) {
                skippedRows.push({ index: i, reason: `${field} contains invalid characters` });
                hasInvalidChars = true;
                break;
              }
            }
          }
          if (hasInvalidChars) continue;
          // Ensure string fields are strings
          validRows.push({
            simplified: row.simplified || '',
            traditional: row.traditional || '',
            pinyin: String(row.pinyin || ''),
            definition: String(row.definition || ''),
            numbered: row.numbered ? String(row.numbered) : '',
          });
        }

        if (validRows.length === 0) {
          throw new Error('No valid rows found in the imported file.');
        }

        if (skippedRows.length > 0) {
          const msg = `Imported ${validRows.length} row(s). ${skippedRows.length} row(s) were skipped (${skippedRows.map(s => `row ${s.index + 1}: ${s.reason}`).join('; ')}).`;
          if (!confirm(`${msg}\n\nContinue with the ${validRows.length} valid row(s)?`)) return;
        }

        const id = `custom.${Date.now()}`;
        await writeList(id, validRows);
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
    return <BlacklistView onBack={goBackFromSubview} />;
  }
  if (subview === 'addword') {
    return <AddWordView listKey={addWordListKey} onBack={goBackFromSubview} />;
  }
  if (subview && subview.startsWith('list-')) {
    const listKey = subview.slice(5);
    return (
      <ListWordView
        listKey={listKey}
        onBack={goBackFromSubview}
        onAddWord={listKey === 'manually' ? () => handleAddWord(listKey) : null}
      />
    );
  }

  return (
    <div class="lists-list">
      {/* Actions */}
      <div class="section-divider">Customization</div>
      <div class="list-item clickable" id="btn-import-list" onClick={doImport}>
        Import a word list
      </div>
      <div class="list-item clickable" id="btn-manage-blacklist" onClick={() => goToSubview('blacklist')}>
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
                onAddWord={list.id === 'manually' ? () => handleAddWord(list.id) : null}
                onViewWords={viewWords}
              />
          ))}
        </div>
      ))}
    </div>
  );
}