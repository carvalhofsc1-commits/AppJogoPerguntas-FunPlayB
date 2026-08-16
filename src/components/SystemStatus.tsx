import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { VERSION_CONFIG } from '@/lib/version';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export function SystemStatus() {
  const location = useLocation();
  const { session } = useAuth();
  const { updating, needsUpdate, forceUpdate } = usePWAUpdate();
  const barRef = useRef<HTMLDivElement>(null);

  // Publica a altura REAL da barra em --bottom-bar-height (CSS custom property
  // global), para telas como Welcome saberem quanto descontar por baixo sem
  // hardcode. A barra não desmonta entre rotas (só alterna entre renderizar o
  // JSX ou `null`), por isso o efeito depende de location.pathname — refaz a
  // medição/observação sempre que ela some ou reaparece.
  useEffect(() => {
    const el = barRef.current;
    if (!el) {
      document.documentElement.style.setProperty('--bottom-bar-height', '0px');
      return;
    }
    const updateHeight = () => {
      document.documentElement.style.setProperty('--bottom-bar-height', `${el.offsetHeight}px`);
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [location.pathname]);

  // Não exibe na tela de Play
  if (location.pathname === '/play') {
    return null;
  }

  // Sempre força a verificação e atualização — limpa cache se necessário
  const handleRefresh = () => {
    forceUpdate(!!session);
  };

  return (
    <div className="system-status-bar" ref={barRef}>
      <div className="system-status-info">
        {session && (
          <span className="system-status-user">👤 {session.nickname}</span>
        )}
        <span className={`system-status-version ${needsUpdate ? 'has-update' : ''}`}>
          v{VERSION_CONFIG.version}
          {needsUpdate && <span className="update-dot" title="Nova versão disponível!" />}
        </span>
      </div>

      {/* Botão Atualizar — estilo ícone circular girando, igual ao app Vendas */}
      <button
        className={`system-refresh-btn ${updating ? 'is-spinning' : ''} ${needsUpdate ? 'has-update' : ''}`}
        onClick={handleRefresh}
        disabled={updating}
        title={needsUpdate ? 'Nova versão disponível! Clique para atualizar.' : 'Atualizar app'}
      >
        <svg
          className="refresh-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
        <span className="refresh-label">
          {updating ? 'Aguarde...' : 'Atualizar'}
        </span>
      </button>
    </div>
  );
}
