import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import Workspaces from './Workspaces';
import { useReducedMotion } from './hooks/useReducedMotion';
import './styles.css';
function StudioProvider() {
  const reducedMotion = useReducedMotion();
  return (
    <ConfigProvider
      theme={{
        token: {
          motion: !reducedMotion,
          colorPrimary: '#236e59',
          colorInfo: '#236e59',
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          borderRadius: 10,
          controlHeight: 40,
          colorText: '#263b34',
        },
      }}
    >
      <Workspaces />
    </ConfigProvider>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudioProvider />
  </React.StrictMode>,
);
