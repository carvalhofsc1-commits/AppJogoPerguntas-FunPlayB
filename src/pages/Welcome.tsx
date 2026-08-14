import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { VERSION_CONFIG } from '@/lib/version';

export default function Welcome() {
  const { session, betaMessage } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  return (
    <div className="welcome-screen">
      {/* Logo */}
      <div className="welcome-logo">
        <img src="/logo.png" alt="FunPlayB" className="logo-img" />
        <p className="beta-badge">{betaMessage}</p>
      </div>

      {/* Botões principais */}
      <div className="welcome-actions">
        <button
          className="btn-welcome-enter"
          onClick={() => navigate('/login')}
        >
          Entrar no jogo
        </button>

        <button
          className="btn-welcome-register"
          onClick={() => navigate('/register')}
        >
          Criar conta
        </button>

        {/* Versão logo abaixo do botão */}
        <p className="welcome-version">
          v{VERSION_CONFIG.version}
        </p>
      </div>
    </div>
  );
}
