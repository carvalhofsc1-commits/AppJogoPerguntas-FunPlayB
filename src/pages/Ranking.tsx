import { useState, useEffect } from 'react';
import { supabase, fetchAllPages } from '@/lib/supabase';

interface SpeedRecord {
  nickname: string;
  duration_secs: number;
  total_questions: number;
  helps_used: number;
}

interface RankingPlayer {
  player_id: string;
  nickname: string;
  total_score: number;
  total_games: number;
  total_corrects: number;
  total_errors: number;
  total_qs: number;
  total_skips: number;
  total_elim: number;
  total_help_ext: number;
  total_hints: number;
  // calculados
  pct: number;
  totalHelps: number;
  rankScore: number;
  best_time_secs: number | null;
  best_time_helps_used: number;
}

type SortKey = 'rank' | 'score' | 'pct' | 'corrects' | 'errors' | 'games';
type SortOrder = 'desc' | 'asc' | 'none';

/* ── Fórmula de pontuação composta ──────────────────────────
   rankScore = score × (1 + aproveitamento) − (ajudas × 2)
   Dois jogadores com 100 pts: quem usou menos ajudas e acertou
   mais fica à frente.
   ───────────────────────────────────────────────────────── */
function calcRankScore(p: Omit<RankingPlayer, 'pct' | 'totalHelps' | 'rankScore' | 'best_time_secs' | 'best_time_helps_used'>) {
  const pct = p.total_qs > 0 ? p.total_corrects / p.total_qs : 0;
  const helps = p.total_skips + p.total_elim + p.total_help_ext + p.total_hints;
  return Math.round(p.total_score * (1 + pct) - helps * 2);
}

const SORT_LABELS: Record<SortKey, string> = {
  rank:     'Score',
  score:    'Pontos',
  pct:      'Aproveit.',
  corrects: 'Acertos',
  errors:   'Erros',
  games:    'Jogos',
};

// Erros: ascendente = melhor (menos erros = melhor)
const SORT_ASC_IS_BETTER: Record<SortKey, boolean> = {
  rank: false, score: false, pct: false, corrects: false, errors: true, games: false,
};

const MIN_QUESTIONS_FOR_RECORD = 10;

export default function Ranking() {
  const [ranking, setRanking]   = useState<RankingPlayer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sort, setSort]         = useState<{ key: SortKey; order: SortOrder }>({ key: 'rank', order: 'desc' });
  const [recordSemAjuda, setRecordSemAjuda] = useState<SpeedRecord | null>(null);
  const [recordComAjuda, setRecordComAjuda] = useState<SpeedRecord | null>(null);

  useEffect(() => {
    const loadRanking = async () => {
      if (!supabase) return;

      // Busca paginada — game_sessions pode ultrapassar o limite padrão de
      // 1000 linhas do Supabase, o que truncaria o ranking silenciosamente.
      const sessions = await fetchAllPages<{
        player_id: string;
        score: number;
        correct_answers: number;
        errors: number;
        total_questions: number;
        skips: number;
        skips_used: number | null;
        elim_used: number | null;
        help_ext_used: number | null;
        hints_used: number | null;
        duration_secs: number;
        player: { nickname: string } | null;
      }>((from, to) =>
        supabase!
          .from('game_sessions')
          .select('player_id, score, correct_answers, errors, total_questions, skips, skips_used, elim_used, help_ext_used, hints_used, duration_secs, player:players(nickname)')
          .range(from, to) as any
      );

      if (sessions) {
        // ── Records de partida mais rápida gabaritada ────────
        const perfectGames = sessions.filter((s: any) => {
          if (s.correct_answers <= 0) return false;
          if (s.correct_answers !== s.total_questions) return false;
          if (s.duration_secs <= 0) return false;
          if ((s.total_questions ?? 0) < MIN_QUESTIONS_FOR_RECORD) return false;
          return true;
        });

        const semAjuda = perfectGames
          .filter((s: any) => ((s.skips_used ?? s.skips ?? 0) + (s.elim_used ?? 0) + (s.help_ext_used ?? 0) + (s.hints_used ?? 0)) === 0)
          .sort((a: any, b: any) => a.duration_secs - b.duration_secs)[0];

        const comAjuda = perfectGames
          .filter((s: any) => ((s.skips_used ?? s.skips ?? 0) + (s.elim_used ?? 0) + (s.help_ext_used ?? 0) + (s.hints_used ?? 0)) > 0)
          .sort((a: any, b: any) => a.duration_secs - b.duration_secs)[0];

        if (semAjuda) setRecordSemAjuda({
          nickname: semAjuda.player?.nickname || 'Jogador',
          duration_secs: semAjuda.duration_secs,
          total_questions: semAjuda.total_questions,
          helps_used: 0,
        });

        if (comAjuda) setRecordComAjuda({
          nickname: comAjuda.player?.nickname || 'Jogador',
          duration_secs: comAjuda.duration_secs,
          total_questions: comAjuda.total_questions,
          helps_used: (comAjuda.skips_used ?? comAjuda.skips ?? 0) + (comAjuda.elim_used ?? 0) + (comAjuda.help_ext_used ?? 0) + (comAjuda.hints_used ?? 0),
        });

        // ── Ranking geral ─────────────────────────────────────
        const map: Record<string, Omit<RankingPlayer, 'pct' | 'totalHelps' | 'rankScore' | 'best_time_secs' | 'best_time_helps_used'>> = {};
        // Mapa de melhor tempo por jogador (gabarito ≥10q, após reset)
        const bestTimeMap: Record<string, { secs: number; helps: number }> = {};

        sessions.forEach((s: any) => {
          const pid = s.player_id;
          if (!pid) return;
          if (!map[pid]) {
            map[pid] = {
              player_id: pid,
              nickname: s.player?.nickname || 'Jogador',
              total_score: 0, total_games: 0, total_corrects: 0,
              total_errors: 0, total_qs: 0, total_skips: 0,
              total_elim: 0, total_help_ext: 0, total_hints: 0,
            };
          }
          map[pid].total_score    += s.score || 0;
          map[pid].total_corrects += s.correct_answers || 0;
          map[pid].total_errors   += s.errors || 0;
          map[pid].total_qs       += s.total_questions || 0;
          map[pid].total_games    += 1;
          map[pid].total_skips    += (s.skips_used ?? s.skips ?? 0);
          map[pid].total_elim     += (s.elim_used || 0);
          map[pid].total_help_ext += (s.help_ext_used || 0);
          map[pid].total_hints    += (s.hints_used || 0);

          // Verifica se esta sessão é gabarito ≥10q
          const isQualified =
            s.correct_answers > 0 &&
            s.correct_answers === s.total_questions &&
            s.duration_secs > 0 &&
            (s.total_questions ?? 0) >= MIN_QUESTIONS_FOR_RECORD;

          if (isQualified) {
            const helps = (s.skips_used ?? s.skips ?? 0) + (s.elim_used ?? 0) + (s.help_ext_used ?? 0) + (s.hints_used ?? 0);
            if (!bestTimeMap[pid] || s.duration_secs < bestTimeMap[pid].secs) {
              bestTimeMap[pid] = { secs: s.duration_secs, helps };
            }
          }
        });

        const enriched: RankingPlayer[] = Object.values(map).map(p => {
          const pct        = p.total_qs > 0 ? Math.round((p.total_corrects / p.total_qs) * 100) : 0;
          const totalHelps = p.total_skips + p.total_elim + p.total_help_ext + p.total_hints;
          const rankScore  = calcRankScore(p);
          const bt         = bestTimeMap[p.player_id];
          return { ...p, pct, totalHelps, rankScore, best_time_secs: bt?.secs ?? null, best_time_helps_used: bt?.helps ?? 0 };
        });

        setRanking(enriched.slice(0, 50));
      }
      setLoading(false);
    };

    loadRanking();
  }, []);

  /* ── Ordenação dinâmica ─────────────────────────────── */
  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      const isAscBetter = SORT_ASC_IS_BETTER[key];
      
      if (prev.key !== key) {
        return { key, order: isAscBetter ? 'asc' : 'desc' };
      }

      if (isAscBetter) {
        if (prev.order === 'asc') return { key, order: 'desc' };
        if (prev.order === 'desc') return { key, order: 'none' };
        return { key, order: 'asc' }; // from none
      } else {
        if (prev.order === 'desc') return { key, order: 'asc' };
        if (prev.order === 'asc') return { key, order: 'none' };
        return { key, order: 'desc' }; // from none
      }
    });
  };

  const getVal = (p: RankingPlayer): number => {
    if (sort.key === 'rank')     return p.rankScore;
    if (sort.key === 'score')    return p.total_score;
    if (sort.key === 'pct')      return p.pct;
    if (sort.key === 'corrects') return p.total_corrects;
    if (sort.key === 'errors')   return p.total_errors;
    if (sort.key === 'games')    return p.total_games;
    return p.rankScore;
  };

  const sorted = [...ranking].sort((a, b) => {
    if (sort.order === 'none') return b.rankScore - a.rankScore;
    const diff = getVal(a) - getVal(b);
    return sort.order === 'asc' ? diff : -diff;
  });

  const SORT_KEYS: SortKey[] = ['rank', 'score', 'pct', 'corrects', 'errors', 'games'];

  /* ── Render ─────────────────────────────────────────── */
  const fmtTime = (secs: number) => `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;

  return (
    <div className="page-screen">

      {/* ── Records ── */}
      {(recordSemAjuda || recordComAjuda) && (
        <div style={{ padding: '0.6rem 0', marginBottom: '0.4rem', width: '100%' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, marginBottom: '0.4rem' }}>⚡ Recorde: Gabarito Mais Rápido ≥ {MIN_QUESTIONS_FOR_RECORD}q</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
            {recordSemAjuda && (
              <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '10px', padding: '0.5rem 0.7rem' }}>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, margin: 0 }}>🏅 Sem Ajudas</p>
                <p style={{ fontSize: '1rem', fontWeight: 800, margin: '0.1rem 0', color: '#ffd700' }}>{fmtTime(recordSemAjuda.duration_secs)}</p>
                <p style={{ fontSize: '0.7rem', margin: 0, opacity: 0.85 }}>{recordSemAjuda.nickname} · {recordSemAjuda.total_questions} perguntas</p>
              </div>
            )}
            {recordComAjuda && (
              <div style={{ flex: 1, minWidth: '120px', background: 'rgba(100,200,255,0.12)', border: '1px solid rgba(100,200,255,0.3)', borderRadius: '10px', padding: '0.5rem 0.7rem' }}>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, margin: 0 }}>🆘 Com Ajudas ({recordComAjuda.helps_used})</p>
                <p style={{ fontSize: '1rem', fontWeight: 800, margin: '0.1rem 0', color: '#64c8ff' }}>{fmtTime(recordComAjuda.duration_secs)}</p>
                <p style={{ fontSize: '0.7rem', margin: 0, opacity: 0.85 }}>{recordComAjuda.nickname} · {recordComAjuda.total_questions} perguntas</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra de ordenação */}
      <div className="ranking-sort-bar">
        {SORT_KEYS.map(key => {
          const isActive = sort.key === key && sort.order !== 'none';
          const arrow = sort.key === key
            ? (sort.order === 'asc' ? ' ↑' : sort.order === 'desc' ? ' ↓' : '')
            : '';
          return (
            <button
              key={key}
              className={`ranking-sort-btn ranking-sort-${key} ${isActive ? 'active' : ''}`}
              onClick={() => toggleSort(key)}
            >
              {SORT_LABELS[key]}{arrow}
            </button>
          );
        })}
      </div>

      <div className="ranking-list">
        {loading ? (
          <div className="screen-center"><div className="spinner" /></div>
        ) : sorted.length === 0 ? (
          <div className="ranking-empty">
            <p>Ainda não há pontuações registradas.</p>
          </div>
        ) : (
          sorted.map((item, index) => {
            const trophy = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
            const isTop3 = index < 3;

            return (
              <div key={item.player_id} className={`ranking-item ${isTop3 ? 'is-top' : ''}`}>
                {/* Linha 1: posição, nome, pontuação composta ★ em destaque */}
                <div className="ranking-row-main">
                  <div className="ranking-pos">
                    {trophy || <span className="ranking-pos-num">{index + 1}</span>}
                  </div>
                  <div className="ranking-info">
                    <span className="ranking-name">{item.nickname}</span>
                    <span className="ranking-simple-score-small">
                      Ponto Bruto: {item.total_score.toLocaleString()}
                    </span>
                  </div>
                  <div className="ranking-score ranking-score-composite">
                    <span className="ranking-score-val">{item.rankScore.toLocaleString()}</span>
                    <span className="ranking-score-lbl">SCORE</span>
                  </div>
                </div>

                {/* Linha 2: stats */}
                <div className="ranking-row-stats">
                  <span className="ranking-stat-pill pill-pts" title="Pontos Brutos">🏆 {item.total_score} pts</span>
                  <span className="ranking-stat-pill" title="Aproveitamento">🎯 {item.pct}%</span>
                  <span className="ranking-stat-pill" title="Acertos">✅ {item.total_corrects}</span>
                  <span className="ranking-stat-pill" title="Erros">❌ {item.total_errors}</span>
                  <span className="ranking-stat-pill" title="Jogos">📝 {item.total_games}j</span>
                  {item.totalHelps > 0 ? (
                    <span
                      className="ranking-stat-pill ranking-pill-help"
                      title={`Pulos: ${item.total_skips} | Elim: ${item.total_elim} | Ajuda: ${item.total_help_ext} | Dica: ${item.total_hints}`}
                    >
                      🆘 {item.totalHelps}
                    </span>
                  ) : (
                    <span className="ranking-stat-pill opacity-40">🆘 0</span>
                  )}
                  {item.best_time_secs !== null && (
                    <span
                      className="ranking-stat-pill"
                      title={`Gabarito mais rápido (${item.best_time_helps_used > 0 ? `com ${item.best_time_helps_used} ajuda(s)` : 'sem ajudas'})`}
                      style={{ color: item.best_time_helps_used === 0 ? '#ffd700' : '#64c8ff' }}
                    >
                      ⚡ {fmtTime(item.best_time_secs)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="ranking-disclaimer">
        ★ = Pontuação composta (pontos × aproveitamento − penalidade por ajudas) · 🆘 = ajudas usadas
      </p>
    </div>
  );
}
