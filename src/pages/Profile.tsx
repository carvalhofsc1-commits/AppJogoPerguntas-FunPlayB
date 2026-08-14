import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const { session, logout, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(session?.nickname ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [adminInitials, setAdminInitials] = useState(session?.admin_initials ?? '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!session || !supabase) return;
    supabase.from('players').select('email,phone,admin_initials').eq('id', session.player_id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmail(data.email ?? '');
          setPhone(data.phone ?? '');
          setAdminInitials(data.admin_initials ?? '');
        }
      });
  }, [session]);

  const handlePinChange = (setter: typeof setCurrentPin) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value.replace(/\D/g, '').slice(0, 4));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (!session || !supabase) return;

    // Valida PIN atual se quiser trocar (verificação roda no servidor,
    // o PIN/hash nunca é lido de volta para o navegador)
    if (newPin) {
      const { data: pinOk, error: pinErr } = await supabase.rpc('verify_own_pin', {
        p_player_id: session.player_id,
        p_pin: currentPin,
      });
      if (pinErr || !pinOk) return setError('PIN atual incorreto');
      if (newPin.length !== 4) return setError('Novo PIN deve ter 4 dígitos');
    }

    setLoading(true);
    const updates: Record<string, string> = {
      nickname: nickname.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
    };
    if (newPin) updates.pin = newPin;
    if (session.category === 'admin') updates.admin_initials = adminInitials.trim().toUpperCase().slice(0, 5);

    const { error: dbErr } = await supabase.from('players').update(updates).eq('id', session.player_id);
    setLoading(false);

    if (dbErr) return setError('Erro ao salvar. Tente novamente.');

    // Atualiza sessão no localStorage
    const raw = localStorage.getItem('funplayb_session');
    if (raw) {
      const sess = JSON.parse(raw);
      sess.nickname = updates.nickname;
      if (updates.admin_initials) sess.admin_initials = updates.admin_initials;
      localStorage.setItem('funplayb_session', JSON.stringify(sess));
      refreshSession();
    }

    setMsg('✅ Dados atualizados com sucesso!');
    setCurrentPin(''); setNewPin('');
  };

  const handleDelete = async () => {
    if (!session || !supabase) return;
    await supabase.from('players').delete().eq('id', session.player_id);
    logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="page-screen profile-page">
      <form onSubmit={handleSave} className="auth-form" style={{ maxWidth: '420px', margin: '0 auto', gap: '0.6rem' }}>
        
        {/* Grid para Nickname e Iniciais (se admin) */}
        <div style={{ display: 'grid', gridTemplateColumns: session?.category === 'admin' ? '1fr 100px' : '1fr', gap: '0.8rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Apelido / Nickname</label>
            <input 
              type="text" 
              className="form-input" 
              style={{ fontSize: '0.9rem', padding: '0.6rem' }} 
              value={nickname} 
              onChange={e => setNickname(e.target.value)} 
              minLength={3} 
              maxLength={20} 
              required 
            />
          </div>
          {session?.category === 'admin' && (
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Iniciais</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ fontSize: '0.9rem', padding: '0.6rem', textAlign: 'center' }} 
                value={adminInitials} 
                onChange={e => setAdminInitials(e.target.value.toUpperCase())} 
                maxLength={5} 
                placeholder="ADM" 
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.75rem' }}>E-mail de contato</label>
          <input 
            type="email" 
            className="form-input" 
            style={{ fontSize: '0.9rem', padding: '0.6rem' }} 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Telefone / WhatsApp</label>
          <input 
            type="tel" 
            className="form-input" 
            style={{ fontSize: '0.9rem', padding: '0.6rem' }} 
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            placeholder="(00) 00000-0000"
          />
        </div>

        {/* Bloco de Alteração de PIN - Mais compacto */}
        <div style={{ 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '12px', 
          padding: '0.8rem', 
          marginTop: '0.4rem',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.7rem', opacity: 0.7, textAlign: 'center', fontWeight: 600 }}>
            🔒 ALTERAR PIN DE ACESSO (4 DÍGITOS)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.7rem' }}>PIN Atual</label>
              <input 
                type="password" 
                inputMode="numeric" 
                maxLength={4} 
                className="form-input" 
                style={{ fontSize: '0.9rem', padding: '0.6rem', textAlign: 'center', letterSpacing: '4px' }} 
                value={currentPin} 
                onChange={handlePinChange(setCurrentPin)} 
                placeholder="••••" 
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Novo PIN</label>
              <input 
                type="password" 
                inputMode="numeric" 
                maxLength={4} 
                className="form-input" 
                style={{ fontSize: '0.9rem', padding: '0.6rem', textAlign: 'center', letterSpacing: '4px' }} 
                value={newPin} 
                onChange={handlePinChange(setNewPin)} 
                placeholder="••••" 
              />
            </div>
          </div>
        </div>

        {error && <p className="form-error" style={{ fontSize: '0.75rem', margin: '0.4rem 0' }}>{error}</p>}
        {msg && <p className="form-success" style={{ fontSize: '0.75rem', margin: '0.4rem 0' }}>{msg}</p>}

        <button type="submit" className="btn-primary" style={{ marginTop: '0.8rem' }} disabled={loading}>
          {loading ? 'Salvando...' : '✅ Salvar Alterações'}
        </button>
      </form>

      <div style={{ maxWidth: '420px', margin: '1rem auto 0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.9rem' }} onClick={() => navigate('/')}>
          ← Voltar ao Início
        </button>
        
        <button 
          className="btn-danger-outline" 
          style={{ 
            marginTop: '1rem', 
            background: 'none', 
            border: 'none', 
            fontSize: '0.75rem', 
            opacity: 0.5, 
            textDecoration: 'underline',
            padding: '0.5rem'
          }} 
          onClick={() => setShowDelete(true)}
        >
          Excluir minha conta permanentemente
        </button>
      </div>

      {showDelete && (
        <div className="confirm-modal">
          <p>⚠️ Tem certeza? Essa ação é irreversível.</p>
          <div className="confirm-actions">
            <button className="btn-danger" onClick={handleDelete}>Sim, excluir</button>
            <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
