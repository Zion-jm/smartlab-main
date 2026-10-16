import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DataRefreshNotice from '../src/components/DataRefreshNotice';
import Toaster from '../src/components/shared/Toaster';
import { useAuthStore } from '../src/stores/authStore';
import '../src/index.css';

createRoot(document.getElementById('root')!).render(<StrictMode>
  <DataRefreshNotice /><Toaster />
  <label>Unsaved draft<input aria-label="Unsaved draft" /></label>
  <button onClick={() => useAuthStore.getState().logout()}>Sign out</button>
</StrictMode>);
