import { ChartPanel } from './chart/ChartPanel';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Trade</span>
        <span className="badge demo">Demo data</span>
      </header>
      <main className="chart-area">
        <ChartPanel />
      </main>
      <footer className="footer">For informational purposes only. Not financial advice.</footer>
    </div>
  );
}
