import { h } from 'preact';

export default function HelpView() {
  return (
    <div class="help-body">
      <h1 style="font-size:24px;margin-top:0">Inkstone Help</h1>

      <h2>Writing Characters</h2>
      <p>
        Tap <strong>Write</strong> on the home screen to begin your study session.
        Draw each stroke on the canvas using your finger or mouse.
        The app will match your stroke to the expected stroke order.
      </p>
      <p>
        <strong>Single tap</strong> on the canvas after completing all strokes to advance,
        or to get a hint if you are stuck (costs penalties).
        <strong>Double tap</strong> when fully stuck to reveal the full character.
      </p>

      <h2>Toolbar Buttons</h2>
      <p>
        <strong>⌂ Home</strong> – Return to the home screen.<br/>
        <strong>↩ Redo</strong> – Clear and redo the current character.<br/>
        <strong>✕ Blacklist</strong> – Skip this word forever (manageable in Lists).<br/>
        <strong>🔍 Show</strong> – View stroke order and character details.
      </p>

      <h2>Grading</h2>
      <p>
        After completing a character, you can manually re-grade it by
        swiping down on the canvas (the flag icon will appear if enabled).
        Grades: ⭐ Perfect · ✓ Good · ⏸ Okay · ✕ Wrong.
      </p>

      <h2>Word Lists</h2>
      <p>
        Go to <strong>Lists</strong> to enable or disable built-in vocabulary sets
        (HSK levels, radicals), import custom JSON lists, or manage your blacklist.
      </p>

      <h2>Spaced Repetition</h2>
      <p>
        Inkstone uses a spaced repetition system (SRS). Cards are scheduled based
        on how well you wrote them. New cards and reviews are limited per day
        (configurable in Settings).
      </p>

      <h2>Custom Lists Format</h2>
      <p>
        Custom lists are JSON arrays. Each entry should be an object with at least:
      </p>
      <pre style="background:var(--bg2);padding:10px;border-radius:8px;font-size:13px;overflow-x:auto">{`[
  {
    "simplified": "你",
    "traditional": "你",
    "pinyin": "nǐ",
    "definition": "you"
  },
  ...
]`}</pre>

      <h2>Credits</h2>
      <p>
        Original Inkstone by <a href="https://github.com/skishore" target="_blank" rel="noopener">Shaunak Kishore</a>.
        Character data from <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me a Hanzi</a>.
        PWA migration and further development by <a href="https://github.com/stooone/inkstone" target="_blank" rel="noopener">Juhász Péter Károly</a>.
      </p>
    </div>
  );
}
