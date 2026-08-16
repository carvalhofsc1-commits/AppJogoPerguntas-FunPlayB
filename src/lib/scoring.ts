// Fonte única de verdade para a pontuação de uma rodada: quanto vale o
// "máximo configurado" e como distribuir os pontos entre as perguntas
// EFETIVAMENTE sorteadas para que a soma nunca ultrapasse (nem fique abaixo)
// desse máximo, mesmo quando o sorteio real diverge das cotas por
// dificuldade (pool insuficiente, sort_mode 'aleatorio', etc.).

export interface DifficultyPointsConfig {
  qty_facil: number;
  pts_facil: number;
  qty_medio: number;
  pts_medio: number;
  qty_dificil: number;
  pts_dificil: number;
}

export type Difficulty = 'facil' | 'medio' | 'dificil';

/** Pontuação máxima configurada para a rodada (soma qty × pts por dificuldade). */
export function calcMaxScore(cfg: DifficultyPointsConfig): number {
  return (
    (cfg.qty_facil ?? 0) * (cfg.pts_facil ?? 0) +
    (cfg.qty_medio ?? 0) * (cfg.pts_medio ?? 0) +
    (cfg.qty_dificil ?? 0) * (cfg.pts_dificil ?? 0)
  );
}

/** Pontos "crus" configurados para uma dificuldade, antes de qualquer normalização. */
export function basePointsFor(difficulty: Difficulty | string, cfg: DifficultyPointsConfig): number {
  if (difficulty === 'facil') return cfg.pts_facil ?? 0;
  if (difficulty === 'medio') return cfg.pts_medio ?? 0;
  return cfg.pts_dificil ?? 0;
}

/**
 * Distribui `target` pontos entre os itens de `rawPoints`, proporcionalmente
 * ao peso original de cada um, garantindo que a soma final seja EXATAMENTE
 * `target` — nunca mais, nunca menos.
 *
 * Se a soma de `rawPoints` já bater com `target` (caso comum quando a
 * configuração e o sorteio estão alinhados), retorna os valores originais
 * sem alteração — evita arredondamento desnecessário no caminho feliz.
 */
export function distributeToTarget(rawPoints: number[], target: number): number[] {
  if (rawPoints.length === 0) return [];

  const rawSum = rawPoints.reduce((a, b) => a + b, 0);

  if (rawSum === target || target <= 0 || rawSum <= 0) {
    return rawPoints.slice();
  }

  const scale = target / rawSum;
  const floored = rawPoints.map(p => Math.floor(p * scale));
  const flooredSum = floored.reduce((a, b) => a + b, 0);
  let remainder = target - flooredSum;

  // Distribui o resto (inteiro >= 0) entre as primeiras perguntas, uma
  // unidade por vez, até a soma fechar exatamente no alvo.
  const result = floored.slice();
  for (let i = 0; i < result.length && remainder > 0; i++) {
    result[i]++;
    remainder--;
  }

  return result;
}
