import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initLocalDb } from '@/db/localDb';
import { syncOfficialCatalog } from '@/services/catalogService';
import App from '@/App';
import '@/index.css';

function showBootError() {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;
                justify-content:center;gap:1rem;padding:2rem;text-align:center;
                font-family:system-ui,-apple-system,sans-serif;background:#1a1a3e;color:#fff;">
      <p style="font-size:1.1rem;margin:0;">Algo deu errado ao iniciar o app.</p>
      <p style="font-size:0.9rem;opacity:0.75;margin:0;max-width:320px;">
        Verifique sua conexão com a internet e tente novamente.
      </p>
      <button id="boot-retry-btn" style="padding:0.7rem 1.6rem;border-radius:8px;border:none;
              background:#9b59b6;color:#fff;font-size:1rem;cursor:pointer;">
        Tentar novamente
      </button>
    </div>
  `;
  document.getElementById('boot-retry-btn')?.addEventListener('click', () => window.location.reload());
}

async function boot() {
  try {
    await initLocalDb();
    const remote = import.meta.env.VITE_OFFICIAL_REMOTE_URL || undefined;
    await syncOfficialCatalog(remote);
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (err) {
    console.error('[boot] Falha ao iniciar o app:', err);
    showBootError();
  }
}

void boot();
