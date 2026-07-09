import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { kCharacters, writeCharacter } from '/client/assets';
import { Assets } from '/client/model/assets';
import { kHomePage, fetchUrl } from '/lib/base';
import { assetForCharacter } from '/lib/characters';

// Serial async mapping helper to loop through asset downloads sequentially
const mapAsync = (fn, args) => {
  const run = (index) => {
    if (index === args.length) return Promise.resolve(true);
    return fn(args[index]).then(() => run(index + 1));
  };
  return run(0);
};

export default function AssetsView({ onComplete }) {
  const [started, setStarted] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);

  const startDownload = async () => {
    setStarted(true);
    setError(null);
    try {
      const characters = await kCharacters;
      
      const targets = {};
      for (let character of Object.keys(characters || {})) {
        const asset = assetForCharacter(character);
        targets[asset] = (targets[asset] || 0) + characters[character];
      }
      const missingItems = [];
      for (const asset of Object.keys(targets)) {
        if (Assets.getVersion(asset) < targets[asset]) {
          missingItems.push({ asset: asset, version: targets[asset] });
        }
      }
      missingItems.sort((a, b) => a.asset.localeCompare(b.asset));

      if (missingItems.length === 0) {
        onComplete();
        return;
      }

      await mapAsync(
        async (item) => {
          const index = missingItems.indexOf(item);
          setProgressText(`Downloading file ${index + 1}/${missingItems.length}...`);
          setProgressPercent(Math.round((index / missingItems.length) * 100));
          
          const url = `${kHomePage}/assets/${item.asset}`;
          const data = await fetchUrl(url);
          const parsedCharacters = data.split('\n').filter((x) => x).map(JSON.parse);
          if (parsedCharacters.length === 0) throw new Error(`Empty asset data for ${item.asset}`);
          
          // Write character assets sequentially
          for (let i = 0; i < parsedCharacters.length; i++) {
            await writeCharacter(parsedCharacters[i]);
          }
          
          Assets.setVersion(item.asset, item.version);
        },
        missingItems
      );

      onComplete();
    } catch (err) {
      console.error(err);
      setError('Download failed. Please check your connection and try again.');
      setStarted(false);
    }
  };

  return (
    <div id="assets-view" class="assets-view-container">
      <div class="loader-card">
        <div class="assets-logo">石</div>
        <h2 class="assets-title">Setup Character Database</h2>
        
        {started ? (
          <div class="progress-container">
            <div class="status">{progressText}</div>
            <div class="progress-bar">
              <div class="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <p class="assets-warning">Please do not close or reload the app during this process.</p>
          </div>
        ) : (
          <div class="info-container">
            {error ? (
              <div class="error-msg">{error}</div>
            ) : (
              <p class="desc">
                Before using Inkstone, you must download the character stroke database files (~35MB total).
                This is a one-time setup and is recommended to run over WiFi.
              </p>
            )}
            <button class="btn-download" onClick={startDownload}>
              {error ? 'Retry Download' : 'Start Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
