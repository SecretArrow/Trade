import { useEffect } from 'react';
import { ChartPanel } from './chart/ChartPanel';
import { TopBar } from './ui/TopBar';
import { LeftToolbar } from './ui/LeftToolbar';
import { RightSidebar } from './ui/RightSidebar';
import { BottomNav, MobileSheet } from './ui/Mobile';
import { Toasts } from './ui/primitives';
import { ShortcutHelp, GlobalShortcuts } from './ui/Shortcuts';
import { ErrorBoundary } from './ErrorBoundary';
import { useStore } from './state/store';

export default function App() {
  const theme = useStore((s) => s.theme);
  const locale = useStore((s) => s.locale);
  const layout = useStore((s) => s.layout);
  const activePane = useStore((s) => s.activePane);
  const panes = useStore((s) => s.panes);

  // resolve system theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const current = useStore.getState().theme;
      const resolved = current === 'system' ? (mq.matches ? 'dark' : 'light') : current;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.lang = useStore.getState().locale;
    };
    apply();
    mq.addEventListener('change', apply);
    return useStore.subscribe(apply);
  }, []);

  const paneCount = layout === 'single' ? 1 : layout === '2-col' ? 2 : 4;
  const visiblePanes = panes.slice(0, paneCount);

  return (
    <ErrorBoundary>
      <div className="app">
        <TopBar />
        <div className="app-body">
          <div className="app-left desktop-only">
            <LeftToolbar />
          </div>
          <main className={`chart-area layout-${layout}`}>
            {visiblePanes.map((pane, index) => (
              <div key={pane.id} className="chart-cell">
                <ChartPanel
                  paneIndex={index}
                  active={index === activePane}
                  theme={resolvedTheme(theme)}
                  locale={locale}
                />
              </div>
            ))}
          </main>
          <div className="app-right desktop-only">
            <RightSidebar />
          </div>
        </div>
        <footer className="footer">
          For informational purposes only. Not financial advice. Charting engine: Lightweight Charts
          (Apache-2.0).
        </footer>
        <BottomNav />
        <MobileSheet />
        <Toasts />
        <ShortcutHelp />
        <GlobalShortcuts />
      </div>
    </ErrorBoundary>
  );
}

function resolvedTheme(theme: string): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
