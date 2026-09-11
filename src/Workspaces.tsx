import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
const PostureMonitor = lazy(() => import('./components/PostureMonitor'));

export default function Workspaces() {
  const [workspace, setWorkspace] = useState(() =>
    location.hash === '#posture' ? 'posture' : 'studio',
  );
  useEffect(() => {
    const update = () =>
      setWorkspace(location.hash === '#posture' ? 'posture' : 'studio');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const navigate = (next: 'studio' | 'posture') => {
    location.hash = next;
    setWorkspace(next);
  };
  return workspace === 'posture' ? (
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
    <App onOpenPosture={() => navigate('posture')} />
  );
}
