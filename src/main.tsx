import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import Workspaces from './Workspaces';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
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
  </React.StrictMode>,
);
