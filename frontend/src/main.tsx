import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Axios interceptors live on the `http` instance in src/services/http.ts.
// The legacy global interceptor in src/utils/axiosConfig.ts has been removed
// to avoid double-processing requests.
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient, shouldPersistQuery } from './services/queryClient';

const VITE_PRELOAD_RECOVERY_KEY = 'sd:vite-preload-recovery';

// Recover once when a freshly deployed build invalidates a lazily-loaded chunk
// that the current tab still references.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  if (sessionStorage.getItem(VITE_PRELOAD_RECOVERY_KEY) === '1') {
    return;
  }

  sessionStorage.setItem(VITE_PRELOAD_RECOVERY_KEY, '1');
  window.location.reload();
});

window.addEventListener('pageshow', () => {
  sessionStorage.removeItem(VITE_PRELOAD_RECOVERY_KEY);
});

// Persist only non-PII query data (filter options, agent names) to localStorage.
// Tickets, tasks, and contacts contain customer PII and stay in-memory only.
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'sd:query-cache',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: localStoragePersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: import.meta.env.VITE_CACHE_BUSTER ?? '',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
);
