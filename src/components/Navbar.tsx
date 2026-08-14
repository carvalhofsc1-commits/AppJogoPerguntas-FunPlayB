import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { VERSION_CONFIG } from '@/lib/version';
import { supabase } from '@/lib/supabase';

import { useAudio } from '@/context/AudioContext';

export function Navbar() {
  const { session, isAdmin, logout } = useAuth();
  const { isMuted, toggleMute } = useAudio();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  // Verifica msgs não lidas (Admin ou Jogador)
  useEffect(() => {
    if (!session?.player_id || !supabase) return;
    const sb = supabase;
    const check = async () => {
      try {
        let count = 0;
        if (isAdmin) {
          const { count: adminCount } = await sb
            .from('contact_messages')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);
          count = adminCount ?? 0;
        } else {
          const { count: playerCount } = await sb
            .from('contact_messages')
            .select('*', { count: 'exact', head: true })
            .eq('player_id', session.player_id)
            .not('reply', 'is', null)
            .eq('reply_read', false);
          count = playerCount ?? 0;
        }
        setUnreadMsgs(count);
      } catch { /* tabela pode não existir ou coluna nova não criada */ }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, session?.player_id]);

  // GARANTIA: Fecha o menu lateral automaticamente sempre que a rota mudar
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Telas onde a Navbar deve ser OCULTADA completamente
  const hiddenRoutes = ['/play', '/welcome', '/login', '/register', '/recover-pin'];
  if (hiddenRoutes.includes(location.pathname)) return null;

  const menuItems = [
    { label: '🎮 Jogar / Início', path: '/' },
    { label: '🏆 Ranking Global', path: '/ranking' },
    { label: '📋 Adm. de Perguntas', path: '/questions' },
    { label: '⚙️ Configurações', path: '/settings' },
    { label: '👤 Meu Perfil', path: '/profile' },
    { label: 'ℹ️ Sobre / Ajuda', path: '/about' },
  ];

  if (isAdmin) {
    menuItems.push(
      { label: '👥 Usuários', path: '/users' }
    );
  }

  const handleNavigate = (path: string | number) => {
    if ((window as any).__isSettingsDirty) {
      if (!window.confirm('Existem alterações não salvas na tela de configurações. Se você sair, elas serão perdidas. Deseja sair assim mesmo?')) {
        return;
      }
    }

    if (typeof path === 'number') {
      navigate(path);
    } else {
      navigate(path);
    }
    setIsOpen(false);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Início';
      case '/welcome': return 'Bem-vindo';
      case '/login': return 'Acesso';
      case '/register': return 'Cadastro';
      case '/recover-pin': return 'Recuperar PIN';
      case '/ranking': return 'Ranking';
      case '/settings': return 'Ajustes';
      case '/profile': return 'Perfil';
      case '/questions': return 'Adm. de Perguntas';
      case '/users': return 'Usuários';
      case '/about': return 'Sobre';
      case '/groups': return 'Grupos';
      case '/result': return 'Resultado';
      default: return 'FunPlayB';
    }
  };

  return (
    <>
      <nav className="navbar-fixed">
        {session && (
          <button className="navbar-menu-btn" onClick={() => setIsOpen(true)} title="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        
        {location.pathname !== '/' && location.pathname !== '/welcome' && (
          <button className="navbar-back-btn" onClick={() => handleNavigate(-1)} title="Voltar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}

        <span className="navbar-title">{getPageTitle()}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <button 
            className="navbar-audio-btn" 
            onClick={toggleMute} 
            title={isMuted ? "Ativar Som" : "Mudar para Mudo"}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: isMuted ? 'rgba(255,255,255,0.4)' : '#f5c842',
              cursor: 'pointer',
              display: 'flex',
              padding: '5px'
            }}
          >
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            )}
          </button>
          <div className="navbar-logo-wrap" onClick={() => handleNavigate('/about')} style={{ cursor: 'pointer' }} title="Sobre / Ajuda">
            <img src="/logo.png" alt="Logo" className="navbar-logo-img" />
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar Drawer */}
      <div className={`sidebar-drawer ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <p className="sidebar-user-name">{session?.nickname}</p>
          <p className="sidebar-user-role">{isAdmin ? 'Administrador' : 'Jogador'}</p>
          <button className="sidebar-close" onClick={() => setIsOpen(false)}>×</button>
        </div>
        
        <div className="sidebar-menu">
          {menuItems.map(item => (
            <button 
              key={item.path} 
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigate(item.path)}
            >
              {item.label}
              {item.path === '/about' && unreadMsgs > 0 && (
                <span className="sidebar-unread-badge">{unreadMsgs}</span>
              )}
            </button>
          ))}
          
          <button 
            className="sidebar-link" 
            style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#ff4d4d' }}
            onClick={() => {
              if (confirm('Deseja realmente sair do aplicativo?')) {
                logout();
              }
            }}
          >
            🚪 Sair / Logoff
          </button>
        </div>
        
        <div className="sidebar-footer">
          <p>Versão {VERSION_CONFIG.version}</p>
        </div>
      </div>
    </>
  );
}
