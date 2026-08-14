import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

function generateSuggestions(base: string): string[] {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return [];
  const nums = [Math.floor(Math.random() * 99) + 1, Math.floor(Math.random() * 999) + 1];
  return [
    `${clean}${nums[0]}`,
    `${clean}_${nums[1]}`,
    `${clean}${new Date().getFullYear().toString().slice(2)}`,
  ];
}

export default function Register() {
  const { session, login } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [terms, setTerms] = useState(false);

  // Termos e Privacidade
  const [privacyPolicy, setPrivacyPolicy] = useState('Carregando...');
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);

  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('app_policies')
      .select('content')
      .eq('policy_type', 'privacy_policy_terms')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrivacyPolicy(data.content);
      });
  }, []);

  const checkNickname = useCallback(async (value: string) => {
    const clean = value.trim();
    if (clean.length < 3) { setNicknameStatus('idle'); return; }
    setNicknameStatus('checking');
    setSuggestions([]);
    const { data: available } = await supabase!.rpc('nickname_available', { p_nickname: clean });
    if (available === false) {
      setNicknameStatus('taken');
      setSuggestions(generateSuggestions(clean));
    } else {
      setNicknameStatus('ok');
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const t = setTimeout(() => checkNickname(nickname), 600);
    return () => clearTimeout(t);
  }, [nickname, checkNickname]);

  const handlePinChange = (setter: typeof setPin) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/\D/g, '').slice(0, 4));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nicknameStatus !== 'ok') return setError('Nickname inválido ou já em uso');
    if (pin.length !== 4) return setError('PIN deve ter exatamente 4 dígitos');
    if (pin !== pinConfirm) return setError('Os PINs não coincidem');
    if (!terms) return setError('Aceite os Termos de Uso para continuar');

    setLoading(true);
    const { error: dbErr } = await supabase!.from('players').insert({
      nickname: nickname.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      pin,
      category: 'jogador',
      email_verified: false,
    });

    if (dbErr) {
      setLoading(false);
      if (dbErr.message.includes('unique') && dbErr.message.includes('email')) {
        return setError('Este e-mail já está cadastrado');
      }
      return setError('Erro ao criar conta. Tente novamente.');
    }

    // Loga automaticamente após cadastro
    const loginErr = await login(nickname.trim(), pin);
    setLoading(false);
    if (loginErr) {
      navigate('/login');
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <header className="auth-header">
          <img src="/logo.png" alt="FunPlayB" className="auth-logo" />
          <h1 className="auth-title">Criar conta</h1>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Nickname */}
          <div className="form-group">
            <label className="form-label">
              Nickname <span className="form-hint">(nome no ranking)</span>
            </label>
            <div className="input-status-wrap">
              <input
                type="text"
                className={`form-input ${nicknameStatus === 'ok' ? 'input-ok' : nicknameStatus === 'taken' ? 'input-error' : ''}`}
                placeholder="seu_apelido"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                minLength={3}
                maxLength={20}
                autoCapitalize="none"
                required
              />
              {nicknameStatus === 'checking' && <span className="input-badge checking">⌛</span>}
              {nicknameStatus === 'ok' && <span className="input-badge ok">✓</span>}
              {nicknameStatus === 'taken' && <span className="input-badge error">✗</span>}
            </div>
            {nicknameStatus === 'taken' && (
              <div className="nickname-suggestions">
                <span className="suggestions-label">Sugestões:</span>
                {suggestions.map(s => (
                  <button key={s} type="button" className="suggestion-chip" onClick={() => setNickname(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>

          {/* E-mail */}
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-input"
              placeholder="email@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {/* Telefone */}
          <div className="form-group">
            <label className="form-label">Telefone <span className="form-hint">(opcional)</span></label>
            <input
              type="tel"
              className="form-input"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {/* PIN */}
          <div className="form-group">
            <label className="form-label">PIN de acesso (4 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="form-input pin-input"
              placeholder="• • • •"
              value={pin}
              onChange={handlePinChange(setPin)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirme o PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className={`form-input pin-input ${pinConfirm && pin !== pinConfirm ? 'input-error' : ''}`}
              placeholder="• • • •"
              value={pinConfirm}
              onChange={handlePinChange(setPinConfirm)}
              required
            />
          </div>

          {/* Termos */}
          {/* Termos e Política de Privacidade com Caixa Expansível */}
          <div className="form-group" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <label className="terms-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="checkbox" 
                checked={terms} 
                onChange={e => setTerms(e.target.checked)} 
                style={{ marginTop: '4px', width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', color: '#fff', lineHeight: '1.4' }}>
                Concordo obrigatoriamente com os <strong>Termos de Uso e Política de Privacidade</strong> descritos abaixo:
              </span>
            </label>

            <div style={{ marginTop: '8px' }}>
              {!isPrivacyExpanded ? (
                <div style={{ position: 'relative' }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.78rem',
                    lineHeight: '1.45',
                    color: 'rgba(255,255,255,0.65)',
                    textAlign: 'justify',
                    height: '55px',
                    overflow: 'hidden'
                  }}>
                    {privacyPolicy}
                  </p>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '25px',
                    background: 'linear-gradient(to bottom, rgba(30, 30, 40, 0), rgba(30, 30, 40, 0.95))',
                    pointerEvents: 'none'
                  }} />
                  <button 
                    type="button"
                    onClick={() => setIsPrivacyExpanded(true)}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      background: 'rgba(245, 200, 66, 0.15)',
                      border: '1px solid rgba(245, 200, 66, 0.3)',
                      color: '#f5c842',
                      padding: '5px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ▼ Expandir e ler todos os termos
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'justify',
                    fontSize: '0.78rem',
                    lineHeight: '1.45',
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {privacyPolicy}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPrivacyExpanded(false)}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      padding: '4px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ▲ Recolher termos
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || nicknameStatus !== 'ok'}
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-links">
          <span>Já tem conta?</span>
          <Link to="/login" className="auth-link">Entrar</Link>
        </div>

        <button className="btn-back-welcome" onClick={() => navigate('/welcome')}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}
