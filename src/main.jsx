import '/lib/base';  // Sets Date.timestamp and String.prototype.hash
import { render } from 'preact';
import './index.css';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));
