import { render, Component } from 'preact';
import './index.css';
import { App } from './app.jsx';

class ErrorBoundary extends Component {
  constructor() {
    super();
    this.state = { error: null };
  }
  componentDidCatch(error) {
    this.setState({ error });
  }
  render() {
    if (this.state.error) {
      return (
        <div class="error-boundary">
          <div class="error-boundary-card">
            <h1>Something went wrong</h1>
            <p>Inkstone encountered an unexpected error.</p>
            <pre>{this.state.error.message}</pre>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('app')
);