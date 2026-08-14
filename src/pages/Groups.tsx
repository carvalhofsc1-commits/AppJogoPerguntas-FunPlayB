import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface InviteRow {
  id: string;
  from_player: string;
  from_nickname: string;
  status: string;
  created_at: string;
}

interface GroupSession {
  id: string;
  group_name: string;
  played_at: string;
  total_questions: number;
  member_scores: { player_id: string; nickname: string; score: number }[];
}

export default function Groups() {
  const { session } = useAuth();

  const [received, setReceived] = useState<InviteRow[]>([]);
  const [history, setHistory] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);

    // Convites recebidos pendentes
    const { data: inv } = await supabase
      .from('invites')
      .select('id, from_player, status, created_at, sender:players!invites_from_player_fkey(nickname)')
      .eq('to_player', session.player_id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    setReceived(
      ((inv ?? []) as any[]).map(i => ({
        id: i.id,
        from_player: i.from_player,
        from_nickname: i.sender?.nickname ?? '?',
        status: i.status,
        created_at: i.created_at,
      }))
    );

    // Histórico de partidas em grupo
    const { data: gs } = await supabase
      .from('group_sessions')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(20);

    setHistory((gs ?? []) as GroupSession[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const handleInviteAction = async (id: string, action: 'aceito' | 'recusado') => {
    await supabase!.from('invites').update({ status: action }).eq('id', id);
    load();
  };

  return (
    <div className="page-screen">
      {/* O cabeçalho agora fica na Navbar superior */}

      {/* Convites recebidos */}
      <div className="groups-section">
        <h2 className="section-title">Convites recebidos</h2>
        {loading ? (
          <div className="screen-center" style={{ minHeight: 'auto', padding: '1rem' }}>
            <div className="spinner" />
          </div>
        ) : received.length === 0 ? (
          <p className="empty-msg" style={{ padding: '0.5rem' }}>Nenhum convite pendente.</p>
        ) : (
          <div className="invite-received-list">
            {received.map(inv => (
              <div key={inv.id} className="invite-received-card">
                <div>
                  <p className="invite-from">{inv.from_nickname} te convidou para jogar!</p>
                  <p className="invite-time">{new Date(inv.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="invite-received-actions">
                  <button className="btn-tiny btn-tiny-green" onClick={() => handleInviteAction(inv.id, 'aceito')}>✓ Aceitar</button>
                  <button className="btn-tiny btn-tiny-danger" onClick={() => handleInviteAction(inv.id, 'recusado')}>✗ Recusar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de partidas em grupo */}
      <div className="groups-section">
        <h2 className="section-title">Histórico de partidas em grupo</h2>
        {history.length === 0 ? (
          <p className="empty-msg" style={{ padding: '0.5rem' }}>Nenhuma partida em grupo ainda.</p>
        ) : (
          <div className="groups-history-list">
            {history.map(gs => (
              <div key={gs.id} className="group-history-card">
                <div className="group-history-header">
                  <span className="group-history-name">{gs.group_name}</span>
                  <span className="group-history-date">{new Date(gs.played_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <p className="group-history-total">{gs.total_questions} perguntas</p>
                <div className="group-scores">
                  {((gs.member_scores ?? []) as any[]).map((m, i) => (
                    <div key={i} className="group-score-row">
                      <span className="group-score-pos">#{i + 1}</span>
                      <span className="group-score-nick">{m.nickname}</span>
                      <span className="group-score-pts">{m.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
