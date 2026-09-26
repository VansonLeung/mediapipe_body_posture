import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
const KioskStudio = lazy(() => import('./kiosk/KioskStudio'));
const currentWorkspace = () =>
  location.hash === '#kiosk'
    ? 'kiosk'
    : location.hash === '#posture'
      ? 'posture'
      : 'studio';
const PostureMonitor = lazy(() => import('./components/PostureMonitor'));

export default function Workspaces() {
  const [workspace, setWorkspace] = useState(currentWorkspace);
  useEffect(() => {
    const update = () => setWorkspace(currentWorkspace());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const navigate = (next: 'studio' | 'posture' | 'kiosk') => {
    location.hash = next;
    setWorkspace(next);
  };
  return workspace === 'kiosk' ? (
    <Suspense fallback={<div role="status">Loading kiosk…</div>}>
      <KioskStudio onExit={() => navigate('studio')} />
    </Suspense>
  ) : workspace === 'posture' ? (
    <Suspense
      fallback={
        <div
          style={{
            padding: 48,
            background: '#071523',
            color: '#e5f3ff',
            minHeight: '100vh',
          }}
        >
          Forma · 坐姿監測 / Posture Monitor…
        </div>
      }
    >
      <PostureMonitor onOpenStudio={() => navigate('studio')} />
    </Suspense>
  ) : (
    <App
      onOpenPosture={() => navigate('posture')}
      onOpenKiosk={() => navigate('kiosk')}
    />
  );
}
