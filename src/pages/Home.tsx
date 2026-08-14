import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { useAudio } from '@/context/AudioContext';

/* ── Mensagens motivacionais por posição ────────────────── */
function getMotivationalMessage(pos: number | null, total: number): string[] {
  if (pos === null) return [
    '🎯 Jogue sua primeira partida e entre para o ranking!',
    '🚀 Todo campeão começa do zero. Que tal começar agora?',
    '📖 Conhecimento é poder. Mostre o seu!',
  ];
  if (pos === 1) return [
    '🏆 Você é o nº 1 do ranking! Continue assim!',
    '👑 Líder absoluto! Mantenha o trono!',
    '🌟 Número 1! Cada resposta certa te mantém no topo!',
  ];
  if (pos <= 3) return [
    `🥇 Você está no pódio! ${pos}º lugar — que desempenho!`,
    `🔥 Top 3! Só falta um empurrãozinho para o primeiro lugar!`,
    `⭐ ${pos}º lugar — você está entre os melhores!`,
  ];
  if (pos <= 10) return [
    `💪 ${pos}º lugar — você está no top 10! Continue firme!`,
    `🎯 Top 10! Cada partida pode te levar mais alto!`,
    `🧠 ${pos}º lugar — sua sabedoria bíblica é evidente!`,
  ];
  return [
    `📈 Você está em ${pos}º lugar — mas você tem potencial pra mais!`,
    `🎮 ${pos}º lugar agora, 1º lugar em breve? Vai em frente!`,
    `💡 ${pos}º de ${total}? Com dedicação, o topo é seu!`,
    `🔑 Cada pergunta respondida é um passo rumo ao ${pos - 1}º lugar!`,
    `🙏 Continue praticando! O ${pos - 1}º lugar está te esperando!`,
  ];
}

/* ── Home ────────────────────────────────────────────────── */
export default function Home() {
  const { session, logout, betaMessage } = useAuth();
  const { initAudio } = useAudio();
  const navigate = useNavigate();
  const [rankPos, setRankPos] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const msgs = useRef<string[]>([]);

  useEffect(() => {
    if (!supabase || !session) return;

    const loadRank = async () => {
      const { data } = await supabase!
        .from('game_sessions')
        .select('player_id, score, correct_answers, total_questions, skips, skips_used, elim_used, help_ext_used, hints_used');

      if (!data) return;

      // Agrega por jogador
      const byPlayer: Record<string, { score: number; corrects: number; qs: number; helps: number }> = {};
      for (const s of data as any[]) {
        const id = s.player_id;
        if (!byPlayer[id]) byPlayer[id] = { score: 0, corrects: 0, qs: 0, helps: 0 };
        byPlayer[id].score += s.score ?? 0;
        byPlayer[id].corrects += s.correct_answers ?? 0;
        byPlayer[id].qs += s.total_questions ?? 0;
        byPlayer[id].helps += (s.skips_used ?? s.skips ?? 0) + (s.elim_used ?? 0) + (s.help_ext_used ?? 0) + (s.hints_used ?? 0);
      }

      // Calcula rankScore para cada jogador (mesma fórmula do Ranking.tsx)
      const ranked = Object.entries(byPlayer)
        .map(([id, p]) => {
          const pct = p.qs > 0 ? p.corrects / p.qs : 0;
          const rankScore = Math.round(p.score * (1 + pct) - p.helps * 2);
          return { id, rankScore };
        })
        .sort((a, b) => b.rankScore - a.rankScore);

      const total = ranked.length;
      const pos = ranked.findIndex(r => r.id === session.player_id);
      setTotalPlayers(total);
      setRankPos(pos >= 0 ? pos + 1 : null);

      msgs.current = getMotivationalMessage(pos >= 0 ? pos + 1 : null, total);
      setMsgIndex(Math.floor(Math.random() * msgs.current.length));
    };

    const loadPending = async () => {
      if (session.category === 'admin') {
        const { count, error } = await supabase!
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
        if (!error && count !== null) {
          setPendingCount(count);
        }
      }
    };

    loadRank();
    loadPending();
  }, [session]);

  // Alterna a mensagem a cada 6 segundos
  useEffect(() => {
    if (msgs.current.length === 0) return;
    const iv = setInterval(() => {
      setMsgIndex(i => (i + 1) % msgs.current.length);
    }, 6000);
    return () => clearInterval(iv);
  }, [rankPos]);

  const handleLogout = () => {
    logout();
    navigate('/welcome', { replace: true });
  };

  const handleGameStart = () => {
    // Desbloqueia o AudioContext no iOS no clique (gesto síncrono do usuário)
    initAudio();
    navigate('/select-theme?mode=solo');
  };

  const currentMsg = msgs.current[msgIndex] ?? '';

  return (
    <div className="home-screen">
      <div className="home-card">
        {/* Logo */}
        <img 
          src="/logo.png" 
          alt="FunPlayB" 
          className="home-logo" 
          onClick={() => navigate('/about')}
          style={{ cursor: 'pointer' }}
          title="Sobre / Ajuda"
        />

        {/* Saudação personalizada */}
        <div className="home-greeting">
          Olá, <span className="home-greeting-name">{session!.nickname}</span>!
        </div>

        <p className="beta-badge">{betaMessage}</p>

        {/* Badge admin e alertas */}
        {session!.category === 'admin' && (
          <div className="home-player-bar" style={{ flexDirection: 'column', gap: '8px' }}>
            <span className="home-admin-badge">ADMIN</span>
            {pendingCount > 0 && (
              <div 
                className="home-admin-badge" 
                style={{ 
                  cursor: 'pointer', 
                  background: 'rgba(230, 126, 34, 0.9)', 
                  border: '1px solid #e67e22',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}
                onClick={() => navigate('/questions')}
                title="Ir para Adm. de Perguntas"
              >
                <span>🚩</span>
                <span>{pendingCount} {pendingCount === 1 ? 'pergunta aguardando' : 'perguntas aguardando'} aprovação</span>
              </div>
            )}
          </div>
        )}

        {/* Posição no ranking + mensagem motivacional */}
        {rankPos !== null && (
          <div className="home-rank-bar" onClick={() => navigate('/ranking')} style={{ cursor: 'pointer' }} title="Ver ranking completo">
            <span className="home-rank-position">
              🏆 {rankPos}º lugar
              {totalPlayers > 0 && <span className="home-rank-total"> de {totalPlayers}</span>}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>→ ver ranking</span>
          </div>
        )}
        {currentMsg && (
          <p className="home-rank-msg" key={msgIndex}>{currentMsg}</p>
        )}

        {/* Grupo de botões centralizado */}
        <div className="home-main-buttons">
          <button
            className="btn-home-primary"
            onClick={handleGameStart}
            style={{ 
              lineHeight: '1.2', 
              padding: '0.8rem 1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px' 
            }}
          >
            <div style={{ textAlign: 'right' }}>
              Iniciar jogo <br />
              <span style={{ fontSize: '0.75em', opacity: 0.9, fontWeight: 'normal' }}>escolher tema</span>
            </div>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="#ef4444" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}>
              <path d="M7 4.5v15a1.5 1.5 0 002.32 1.25l11-7.5a1.5 1.5 0 000-2.5l-11-7.5A1.5 1.5 0 007 4.5z"/>
            </svg>
          </button>

          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button 
              className="btn-home-menu btn-home-settings" 
              onClick={() => navigate('/settings')} 
              style={{ flex: 1, margin: 0, padding: '0.8rem 0', fontSize: '0.85rem' }}
            >
              ⚙️ Configurações
            </button>
            <button 
              className="btn-home-menu btn-home-logout" 
              onClick={handleLogout} 
              style={{ flex: 1, margin: 0, padding: '0.8rem 0', fontSize: '0.85rem' }}
            >
              🚪 Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
