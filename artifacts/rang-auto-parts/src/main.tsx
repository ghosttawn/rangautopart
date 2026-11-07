import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

import './index.css';

setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);
setAuthTokenGetter(() => {
  try {
    return localStorage.getItem('rang_auth_token');
  } catch {
    return null;
  }
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
