import { h } from 'preact';

export default function HelpView() {
  return (
    <div class="help-body">
      <h1 style="font-size:24px;margin-top:0">Inkstone Help</h1>

      <p style="background:var(--bg2);padding:12px 16px;border-radius:8px;color:var(--fg2);font-size:14px;line-height:1.6">
        <strong>💾 Where your data lives:</strong> All your progress, settings, and
        vocabulary are stored <em>only on this device</em>, inside your browser or
        the Inkstone app. Your data is safe as long as you don't uninstall the app
        or clear your browser's site data. On iOS, Safari may automatically free up
        storage if your device runs low on space, which could delete app data.
      </p>
      <p style="background:var(--bg2);padding:12px 16px;border-radius:8px;color:var(--fg2);font-size:14px;line-height:1.6">
        <strong>🔒 Preventing data loss:</strong> Use the{' '}
        <strong>Backup</strong> feature in <strong>Settings</strong> regularly to
        save a backup file. Store the file somewhere safe (e.g., cloud storage).
        You can restore it later via <strong>Settings → Restore from a file</strong>{' '}
        if you switch devices or lose your data.
      </p>

      <h2>Installing the App</h2>
      <p>
        Inkstone can be installed as a standalone app on your phone or computer.
        This gives you a home screen icon, a full-screen experience without the
        browser address bar, and offline access.
      </p>
      <p>
        <strong>Android (Chrome):</strong> Visit <strong>inkstoneapp.net</strong>,
        then tap <em>"Add to Home screen"</em> from the browser menu or the
        install banner.
      </p>
      <p>
        <strong>iPhone / iPad (Safari):</strong> Visit <strong>inkstoneapp.net</strong>,
        tap the <strong>Share</strong> icon (rectangle with arrow) and select{' '}
        <em>"Add to Home Screen"</em>.
      </p>
      <p>
        <strong>Desktop (Chrome / Edge):</strong> Click the install icon (⊕) in
        the address bar, or use the browser menu → <em>"Install Inkstone…"</em>.
      </p>

      <h2>SRS Review</h2>
      <p>
        Tap <strong>SRS Review</strong> on the home screen to begin your study session.
        Draw each stroke on the canvas using your finger or mouse.
        The app will match your stroke to the expected stroke order.
      </p>
      <p>
        <strong>Single tap</strong> on the canvas after completing all strokes to advance,
        or to get a hint if you are stuck (costs penalties).
        <strong>Double tap</strong> when fully stuck to reveal the full character.
      </p>

      <h2>Rote Review</h2>
      <p>
        Tap <strong>Rote Review</strong> for extra practice on your <em>leeches</em> —
        characters you consistently struggle with (at least 5 reviews, success rate below 20%) that are due
        within the next 3 days. Each character is automatically revealed and repeated
        3 times, like writing it on paper over and over. No spaced repetition updates
        occur, so your SRS schedule is unaffected.
      </p>
      <p>
        Use the <strong>⏭ Skip</strong> button to move to the next character at any time.
        The <strong>↩ Redo</strong> button clears the canvas and re-reveals the character.
      </p>

      <h2>Toolbar Buttons</h2>
      <p>
        <strong>⌂ Home</strong> – Return to the home screen.<br/>
        <strong>↩ Redo</strong> – Clear and redo the current character.<br/>
        <strong>✕ Blacklist</strong> – Skip this word forever (manageable in Lists).<br/>
        <strong>👁 Peek</strong> – Temporarily reveal the character for a few seconds (this still counts as a failed attempt).<br/>
        <strong>⏭ Skip</strong> – (Rote Review only) Skip to the next character.<br/>
        <strong>🔍 Show</strong> – View stroke order and character details.
      </p>

      <h2>Grading</h2>
      <p>
        After completing a character, the canvas glows with one of four colors
        indicating how well you wrote it. You can also manually re-grade by
        swiping down on the canvas (the flag icon will appear if enabled).
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:14px">
        <thead>
          <tr style="background:var(--bg2)">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Result</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Color</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)">Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 12px">⭐ Perfect</td>
            <td style="padding:6px 12px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:#84b4d8;vertical-align:middle;margin-right:6px"></span>Blue</td>
            <td style="padding:6px 12px">No mistakes, flawless execution</td>
          </tr>
          <tr>
            <td style="padding:6px 12px">✓ Good</td>
            <td style="padding:6px 12px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:#88c874;vertical-align:middle;margin-right:6px"></span>Green</td>
            <td style="padding:6px 12px">Minor mistakes, essentially correct</td>
          </tr>
          <tr>
            <td style="padding:6px 12px">⏸ Okay</td>
            <td style="padding:6px 12px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:#c0c080;vertical-align:middle;margin-right:6px"></span>Yellow</td>
            <td style="padding:6px 12px">Several mistakes, partial correctness</td>
          </tr>
          <tr>
            <td style="padding:6px 12px">✕ Wrong</td>
            <td style="padding:6px 12px"><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:#e87878;vertical-align:middle;margin-right:6px"></span>Red</td>
            <td style="padding:6px 12px">Too many mistakes, counts as wrong</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:8px;color:var(--fg2);font-size:13px">
        Penalties accumulate from wrong strokes, tapping for hints, or using the Peek button.
        The fewer penalties, the better the result.
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

      <h2>Leeches & Maximum Leeches</h2>
      <p>
        <strong>Leeches</strong> are characters that you consistently struggle with —
        items with at least 5 reviews, a success rate below 20%, that are due for review within the next
        3 days. You can view your current leeches on the <strong>Stats</strong> screen
        under the <strong>Activity</strong> section.
      </p>
      <p>
        The <strong>Maximum Leeches</strong> setting (in <strong>Settings → Scheduling</strong>)
        lets you set a cap on how many leeches are acceptable. If the number of leeches
        reaches or exceeds this limit, no <em>new</em> cards will be introduced,
        overriding the "New Cards Per Day" setting. This helps you focus on reviewing
        and improving your problematic characters before adding more to your workload.
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

      <h2>Support</h2>
      <p>
        If you find Inkstone useful, you can support hosting and development costs via{' '}
        <a href="https://paypal.me/inkstoneapp" target="_blank" rel="noopener">PayPal</a>.
        Every contribution helps keep the app running and improving. Thank you!
      </p>
    </div>
  );
}
