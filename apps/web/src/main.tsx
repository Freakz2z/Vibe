import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyInitialTheme } from './hooks/useTheme';
import './styles.css';

applyInitialTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('缺少应用挂载节点 #root。');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
