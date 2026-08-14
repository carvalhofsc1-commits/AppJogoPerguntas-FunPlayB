import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllPages } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Player } from '@/types/game';

export default function Users() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' | 'none' }>({ key: '', order: 'none' });
  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const [userStats, setUserStats] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadUsers();
    const iv = setInterval(loadOnlineStatus, 30000);
    return () => clearInterval(iv);
  }, [isAdmin]);

  async function loadOnlineStatus() {
    if (!supabase) return;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('online_presence')
      .select('player_id')
      .gte('last_ping', cutoff);
    
    if (data) {
      setOnlinePlayers(new Set(data.map(p => p.player_id)));
    }
  }

  async function loadUsers() {
    if (!supabase) return;
    setLoading(true);
    
    const playersData = await fetchAllPages((from, to) =>
      supabase!.from('players')
        .select('id, nickname, email, phone, category, admin_initials, avatar_url, email_verified, status, created_at, last_seen_at, total_access')
        .order('nickname', { ascending: true }).range(from, to)
    );
    
    if (playersData) {
      setUsers(playersData as Player[]);
      
      // Estatísticas agregadas
      const [sessionsData, questionsData] = await Promise.all([
        fetchAllPages((from, to) => supabase!.from('game_sessions').select('player_id, score').range(from, to)),
        fetchAllPages((from, to) => supabase!.from('questions').select('created_by').range(from, to))
      ]);

      const stats: Record<string, any> = {};
      sessionsData?.forEach((s: any) => {
        if (!stats[s.player_id]) stats[s.player_id] = { games: 0, score: 0, questions: 0 };
        stats[s.player_id].games++;
        stats[s.player_id].score += (s.score || 0);
      });

      questionsData?.forEach((q: any) => {
        if (q.created_by) {
          if (!stats[q.created_by]) stats[q.created_by] = { games: 0, score: 0, questions: 0 };
          stats[q.created_by].questions++;
        }
      });

      setUserStats(stats);
    }
    
    await loadOnlineStatus();
    setLoading(false);
  }

  const [editingUser, setEditingUser] = useState<Player | null>(null);
  const [newNickname, setNewNickname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Mensagem Admin -> Player
  const [messageTarget, setMessageTarget] = useState<Player | null>(null);
  const [messageTitle, setMessageTitle] = useState('Aviso do Administrador');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Histórico de Mensagens Admin -> Player
  const [historyTarget, setHistoryTarget] = useState<Player | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadHistory(player: Player) {
    if (!supabase) return;
    setHistoryTarget(player);
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setHistoryList(data);
    }
    setLoadingHistory(false);
  }

  async function handleSendMessage() {
    if (!supabase || !messageTarget || !messageText.trim()) return;
    setSendingMessage(true);
    const { error } = await supabase.from('notifications').insert({
      player_id: messageTarget.id,
      title: messageTitle.trim() || 'Aviso do Administrador',
      message: messageText.trim()
    });
    setSendingMessage(false);
    if (error) {
      alert('Erro ao enviar mensagem: ' + error.message);
    } else {
      alert('Mensagem enviada com sucesso!');
      setMessageTarget(null);
      setMessageText('');
      setMessageTitle('Aviso do Administrador');
    }
  }

  async function handleUpdateStatus(u: Player, newStatus: string) {
    if (!supabase) return;
    if (!confirm(`Deseja realmente mudar o status de "${u.nickname}" para ${newStatus.toUpperCase()}?`)) return;
    
    setUpdatingId(u.id);
    const { error } = await supabase.from('players').update({ status: newStatus }).eq('id', u.id);
    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, status: newStatus } : user));
    }
    setUpdatingId(null);
  }

  async function handleDeleteUser(u: Player) {
    if (!supabase) return;
    if (!confirm(`Deseja realmente DELETAR o usuário "${u.nickname}"? Esta ação não pode ser desfeita.`)) return;
    
    setUpdatingId(u.id);
    const { error } = await supabase.from('players').delete().eq('id', u.id);
    if (error) {
      alert('Não é possível deletar o usuário pois ele possui vínculos (perguntas, temas, etc.). Por favor, INATIVE-O em vez de deletar.\nDetalhes: ' + error.message);
    } else {
      setUsers(prev => prev.filter(user => user.id !== u.id));
      alert('Usuário deletado com sucesso.');
    }
    setUpdatingId(null);
  }

  async function toggleAdmin(user: Player) {
    if (!supabase || updatingId) return;
    
    const newCategory = user.category === 'admin' ? 'jogador' : 'admin';
    const confirmMsg = newCategory === 'admin' 
      ? `Promover "${user.nickname}" a Administrador?`
      : `Remover privilégios de Admin de "${user.nickname}"?`;

    if (!confirm(confirmMsg)) return;

    setUpdatingId(user.id);
    
    const updates: any = { category: newCategory };
    if (newCategory === 'admin' && !user.admin_initials) {
      const initials = prompt("Digite as iniciais deste Admin (Ex: JD):", user.nickname.slice(0, 2).toUpperCase());
      if (initials) updates.admin_initials = initials.slice(0, 3).toUpperCase();
    }

    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      alert('Erro ao atualizar usuário');
    } else {
      loadUsers();
    }
    setUpdatingId(null);
  }

  async function handleSaveEdit() {
    if (!supabase || !editingUser) return;
    if (!newNickname.trim()) return alert('O apelido não pode ser vazio');

    setUpdatingId(editingUser.id);
    const updates: any = { 
      nickname: newNickname.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim()
    };

    // AVISO: A senha não pode ser salva na tabela 'players' diretamente.
    // Mantendo apenas Nickname, Email e Telefone.

    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', editingUser.id);

    if (error) {
      console.error('Erro detalhado:', error);
      alert(`Erro ao atualizar usuário: ${error.message}`);
    } else {
      setEditingUser(null);
      loadUsers();
    }
    setUpdatingId(null);
  }

  async function handleResetData() {
    if (!supabase || !editingUser) return;
    const confirmMsg = `⚠️ ATENÇÃO: Deseja realmente ZERAR TUDO de "${editingUser.nickname}"?\n\nIsso apagará permanentemente o histórico de partidas, acertos, erros, pontuação e removerá o jogador do ranking.\n\nESTA AÇÃO É IRREVERSÍVEL!`;
    if (!confirm(confirmMsg)) return;

    setUpdatingId(editingUser.id);

    const [res1, res2] = await Promise.all([
      supabase.from('game_sessions').delete().eq('player_id', editingUser.id),
      supabase.from('answered_questions').delete().eq('player_id', editingUser.id)
    ]);

    if (res1.error || res2.error) {
      alert('Erro ao zerar dados. Tente novamente.');
    } else {
      alert('Todos os dados foram zerados com sucesso!');
      setEditingUser(null);
      loadUsers();
    }
    setUpdatingId(null);
  }

  async function handleResetScoreOnly() {
    if (!supabase || !editingUser) return;
    const confirmMsg = `Deseja zerar SOMENTE A PONTUAÇÃO de "${editingUser.nickname}"?\n\nO histórico de partidas e perguntas respondidas será mantido, apenas o score de cada sessão será zerado.\n\nESTA AÇÃO É IRREVERSÍVEL!`;
    if (!confirm(confirmMsg)) return;

    setUpdatingId(editingUser.id);

    const { error } = await supabase
      .from('game_sessions')
      .update({ score: 0 })
      .eq('player_id', editingUser.id);

    if (error) {
      alert('Erro ao zerar pontuação. Tente novamente.');
    } else {
      alert('Pontuação zerada com sucesso! Histórico de jogos mantido.');
      setEditingUser(null);
      loadUsers();
    }
    setUpdatingId(null);
  }

  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }

  const toggleSort = (key: string) => {
    setSort(prev => {
      if (prev.key !== key) return { key, order: 'desc' };
      if (prev.order === 'none') return { key, order: 'desc' };
      if (prev.order === 'desc') return { key, order: 'asc' };
      return { key, order: 'none' };
    });
  };

  const filteredUsers = [...users]
    .filter(u => 
      u.nickname.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort.order === 'none') {
        return a.nickname.localeCompare(b.nickname);
      }

      const getVal = (u: Player) => {
        const s = userStats[u.id] || { games: 0, score: 0, questions: 0 };
        if (sort.key === 'games') return s.games;
        if (sort.key === 'accesses') return u.total_access || 0;
        if (sort.key === 'score') return s.score;
        if (sort.key === 'questions') return s.questions;
        return 0;
      };

      const valA = getVal(a);
      const valB = getVal(b);

      if (sort.order === 'asc') return valA - valB;
      return valB - valA;
    });

  function scrollToUser(id: string) {
    const el = document.getElementById(`user-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-card');
      setTimeout(() => el.classList.remove('highlight-card'), 2000);
    }
  }

  const onlineList = users.filter(u => onlinePlayers.has(u.id));

  return (
    <div className="page-screen users-screen">
      {/* Resumo de Usuários Online */}
      <div className="online-summary-panel">
        <h3 className="online-summary-title">
          🟢 Online Agora ({onlineList.length})
        </h3>
        {onlineList.length === 0 ? (
          <p className="online-summary-empty">Nenhum usuário ativo no momento.</p>
        ) : (
          <div className="online-summary-list">
            {onlineList.map(u => (
              <button 
                key={u.id} 
                className="online-summary-item"
                onClick={() => scrollToUser(u.id)}
              >
                {u.nickname}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="users-toolbar">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="🔍 Buscar por nome ou e-mail..." 
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="users-sort-bar">
          <button 
            className={`sort-btn ${sort.key === 'games' && sort.order !== 'none' ? 'active' : ''}`}
            onClick={() => toggleSort('games')}
          >
            Partidas {sort.key === 'games' && (sort.order === 'asc' ? '↑' : sort.order === 'desc' ? '↓' : '')}
          </button>
          <button 
            className={`sort-btn ${sort.key === 'accesses' && sort.order !== 'none' ? 'active' : ''}`}
            onClick={() => toggleSort('accesses')}
          >
            Acessos {sort.key === 'accesses' && (sort.order === 'asc' ? '↑' : sort.order === 'desc' ? '↓' : '')}
          </button>
          <button 
            className={`sort-btn ${sort.key === 'score' && sort.order !== 'none' ? 'active' : ''}`}
            onClick={() => toggleSort('score')}
          >
            Pontos {sort.key === 'score' && (sort.order === 'asc' ? '↑' : sort.order === 'desc' ? '↓' : '')}
          </button>
          <button 
            className={`sort-btn ${sort.key === 'questions' && sort.order !== 'none' ? 'active' : ''}`}
            onClick={() => toggleSort('questions')}
          >
            Perg. {sort.key === 'questions' && (sort.order === 'asc' ? '↑' : sort.order === 'desc' ? '↓' : '')}
          </button>
        </div>
      </div>

      <div className="users-container">
        {loading ? (
          <div className="screen-center">
            <div className="spinner" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="empty-msg">Nenhum usuário encontrado.</p>
        ) : (
          <div className="users-list">
            {filteredUsers.map(u => (
              <div key={u.id} id={`user-card-${u.id}`} className={`user-card ${u.category === 'admin' ? 'user-is-admin' : ''}`}>
                <div className="user-card-main">
                  <div className="user-info">
                    <div className="user-name-row">
                      <div className={`online-indicator-dot ${onlinePlayers.has(u.id) ? 'is-online' : ''}`} title={onlinePlayers.has(u.id) ? 'Online agora' : 'Offline'} />
                      <span className="user-nickname">{u.nickname}</span>
                      {u.category === 'admin' && <span className="admin-badge-tiny">ADMIN</span>}
                      {u.status === 'suspenso' && <span style={{ fontSize: '0.65rem', background: '#f39c12', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>SUSPENSO</span>}
                      {u.status === 'inativo' && <span style={{ fontSize: '0.65rem', background: '#e74c3c', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>INATIVO</span>}
                    </div>
                    
                    <div className="user-contact-row">
                      <span className="user-contact-item">📧 {u.email}</span>
                      
                      {u.phone && (
                        <a 
                          href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="user-phone-link user-contact-item"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {u.phone}
                        </a>
                      )}
                    </div>

                    <div className="user-stats-grid">
                      <div className="user-stat-mini">
                        <span className="stat-mini-label">Partidas</span>
                        <span className="stat-mini-val">{userStats[u.id]?.games || 0}</span>
                      </div>
                      <div className="user-stat-mini">
                        <span className="stat-mini-label">Pontos</span>
                        <span className="stat-mini-val">{userStats[u.id]?.score || 0}</span>
                      </div>
                      <div className="user-stat-mini">
                        <span className="stat-mini-label">Perguntas</span>
                        <span className="stat-mini-val">{userStats[u.id]?.questions || 0}</span>
                      </div>
                      <div className="user-stat-mini">
                        <span className="stat-mini-label">Acessos</span>
                        <span className="stat-mini-val">{u.total_access || 0}</span>
                      </div>
                      <div className="user-stat-mini">
                        <span className="stat-mini-label">Último Acesso</span>
                        <span className="stat-mini-val">
                          {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </span>
                      </div>
                    </div>

                    {u.admin_initials && (
                      <span className="user-initials-tag">Iniciais: {u.admin_initials}</span>
                    )}
                  </div>
                </div>

                <div className="user-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button 
                      className="btn-action-outline"
                      style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#f5c842', color: '#f5c842' }}
                      onClick={() => {
                        setEditingUser(u);
                        setNewNickname(u.nickname);
                        setNewEmail(u.email || '');
                        setNewPhone(u.phone || '');
                      }}
                      disabled={updatingId === u.id}
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      className="btn-action-outline"
                      style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: u.category === 'admin' ? '#e67e22' : '#00cec9', color: u.category === 'admin' ? '#e67e22' : '#00cec9' }}
                      onClick={() => toggleAdmin(u)}
                      disabled={updatingId === u.id || u.id === session?.player_id}
                    >
                      {updatingId === u.id ? '...' : u.category === 'admin' ? '⬇ Rebaixar' : '⭐ Tornar Admin'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button 
                      className="btn-action-outline"
                      style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#a29bfe', color: '#a29bfe' }}
                      onClick={() => { setMessageTarget(u); setMessageTitle('Aviso do Administrador'); setMessageText(''); }}
                    >
                      📨 Enviar Mensagem
                    </button>
                    <button 
                      className="btn-action-outline"
                      style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#74b9ff', color: '#74b9ff' }}
                      onClick={() => loadHistory(u)}
                    >
                      🕒 Histórico
                    </button>
                  </div>
                  
                  {u.id !== session?.player_id && (
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      {(!u.status || u.status === 'ativo') ? (
                        <>
                          <button className="btn-action-outline" style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#f39c12', color: '#f39c12' }} onClick={() => handleUpdateStatus(u, 'suspenso')} disabled={updatingId === u.id}>⏸ Suspender</button>
                          <button className="btn-action-outline" style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#e74c3c', color: '#e74c3c' }} onClick={() => handleUpdateStatus(u, 'inativo')} disabled={updatingId === u.id}>🛑 Inativar</button>
                        </>
                      ) : (
                        <button className="btn-action-outline" style={{ flex: 2, padding: '6px', fontSize: '0.75rem', borderColor: '#2ecc71', color: '#2ecc71' }} onClick={() => handleUpdateStatus(u, 'ativo')} disabled={updatingId === u.id}>▶ Ativar Conta</button>
                      )}
                      
                      <button className="btn-action-outline" style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderColor: '#c0392b', color: '#c0392b', background: 'rgba(192, 57, 43, 0.1)' }} onClick={() => handleDeleteUser(u)} disabled={updatingId === u.id}>🗑 Deletar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <h2 className="modal-title">✏️ Editar Usuário</h2>
            
            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label className="form-label">Apelido do Jogador</label>
              <input 
                type="text" 
                className="form-input"
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label className="form-label">E-mail</label>
              <input 
                type="email" 
                className="form-input"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label className="form-label">Telefone (Zap)</label>
              <input 
                type="text" 
                className="form-input"
                value={newPhone}
                onChange={e => setNewPhone(formatPhone(e.target.value))}
                placeholder="(99) 99999-9999"
                maxLength={15}
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button 
                className="btn-primary" 
                onClick={handleSaveEdit}
                disabled={updatingId === editingUser.id}
              >
                {updatingId === editingUser.id ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-reset-data"
                  onClick={handleResetData}
                  disabled={updatingId === editingUser.id}
                  title="Apaga todo o histórico de partidas e pontuação"
                  style={{ flex: 1 }}
                >
                  🗑️ Zerar Tudo
                </button>
                <button 
                  className="btn-reset-score"
                  onClick={handleResetScoreOnly}
                  disabled={updatingId === editingUser.id}
                  title="Zera somente a pontuação, mantendo o histórico de jogos"
                  style={{ flex: 1 }}
                >
                  📊 Zerar Pontos
                </button>
              </div>

              <button 
                className="btn-secondary" 
                onClick={() => setEditingUser(null)}
                disabled={updatingId === editingUser.id}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mensagem */}
      {messageTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '450px' }}>
            <h2 className="modal-title">📨 Enviar Mensagem</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem', marginTop: '0' }}>
              Para: <strong>{messageTarget.nickname}</strong>
            </p>
            
            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label className="form-label">Título da Notificação</label>
              <input 
                type="text" 
                className="form-input"
                value={messageTitle}
                onChange={e => setMessageTitle(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label className="form-label">Mensagem</label>
              <textarea 
                className="form-input"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', lineHeight: '1.4' }}
                placeholder="Escreva seu aviso aqui..."
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button 
                className="btn-primary" 
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
              >
                {sendingMessage ? 'Enviando...' : 'Enviar Agora'}
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={() => setMessageTarget(null)}
                disabled={sendingMessage}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {historyTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h2 className="modal-title">🕒 Histórico de Avisos</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem', marginTop: '0' }}>
              Usuário: <strong>{historyTarget.nickname}</strong>
            </p>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loadingHistory ? (
                <p style={{ textAlign: 'center', opacity: 0.7 }}>Carregando histórico...</p>
              ) : historyList.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.7 }}>Nenhuma notificação enviada para este usuário.</p>
              ) : (
                historyList.map(notif => (
                  <div key={notif.id} style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '12px', 
                    borderRadius: '8px',
                    borderLeft: `4px solid ${notif.is_read ? '#2ecc71' : '#f39c12'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{notif.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: notif.is_read ? '#2ecc71' : '#f39c12', fontWeight: 'bold' }}>
                        {notif.is_read ? '✅ Lido' : '⏳ Não lido'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>
                      {notif.message}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
                      {new Date(notif.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setHistoryTarget(null)}
                style={{ width: '100%' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
