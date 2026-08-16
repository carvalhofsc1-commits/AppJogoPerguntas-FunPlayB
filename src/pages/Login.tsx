import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const { login, session } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await login(identifier.trim(), pin.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/', { replace: true });
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(v);
  };

  return (
    <div className="auth-screen">
      {/* Moldura decorativa — puramente visual (pointer-events: none). */}
      <div className="screen-frame" aria-hidden="true" />

      {/* Logo + Título — sem card */}
      <div className="login-logo-block">
        <img src="/logo.png" alt="FunPlayB" className="login-logo-img" />
        <h1 className="login-title">Entrar</h1>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label className="form-label">Nickname ou E-mail</label>
          <input
            type="text"
            className="form-input"
            placeholder="seu_nickname ou email@exemplo.com"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">PIN (4 dígitos)</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="form-input pin-input"
            placeholder="• • • •"
            value={pin}
            onChange={handlePinChange}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary login-btn" disabled={loading}>
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>

      <div className="auth-links" style={{ marginTop: '0.8rem', marginBottom: '1.5rem' }}>
        <Link to="/recover-pin" className="auth-link">Esqueci meu PIN?</Link>
      </div>

      <button type="button" className="btn-welcome-register" onClick={() => navigate('/register')} style={{ fontSize: '1rem', padding: '0.7rem', width: '100%', maxWidth: '300px' }}>
        Criar conta
      </button>

      <button className="btn-back-welcome" onClick={() => navigate('/welcome')} style={{ marginTop: '0.5rem' }}>
        ← Voltar
      </button>
    </div>
  );
}
