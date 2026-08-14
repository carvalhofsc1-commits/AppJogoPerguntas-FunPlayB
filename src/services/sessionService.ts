import { supabase } from '@/lib/supabase';

export interface GameSession {
  id: string;
  player_name: string;
  score: number;
  total_questions: number;
  difficulty: string;
  played_at: string;
}

/**
 * Salva uma partida finalizada no Supabase (histórico global).
 * player_name pode ser o nome digitado pelo jogador ou "Anônimo".
 */
export async function saveGameSession(
  playerName: string,
  score: number,
  totalQuestions: number,
  difficulty: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' };

  const { error } = await supabase.from('game_sessions').insert({
    player_name: playerName.trim() || 'Anônimo',
    score,
    total_questions: totalQuestions,
    difficulty,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Busca as últimas partidas de todos os jogadores (dashboard global).
 */
export async function fetchRecentSessions(limit = 10): Promise<GameSession[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, player_name, score, total_questions, difficulty, played_at')
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as GameSession[];
}
