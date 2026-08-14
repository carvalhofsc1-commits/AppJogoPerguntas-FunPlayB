import type { Question } from '@/types/question';

function difficultyFromPoints(p: number): Question['difficulty'] {
  if (p === 2) return 'Fácil';
  if (p === 10) return 'Média';
  if (p === 22) return 'Difícil';
  return 'Desconhecida';
}

/** Mesmo parser conceitual do `carregarPerguntas()` do HTML. */
export function parseOfficialDataLine(line: string, source: Question['source'] = 'official'): Question | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const campos = trimmed.match(/(".*?"|[^;]+)(?=;|$)/g);
  if (!campos || campos.length < 10) return null;
  const clean = (s: string) => s.replace(/"/g, '');
  const pontosValor = parseInt(clean(campos[8]), 10);
  return {
    id: `official:${clean(campos[0])}`,
    text: clean(campos[1]),
    options: [clean(campos[2]), clean(campos[3]), clean(campos[4]), clean(campos[5])] as [
      string,
      string,
      string,
      string,
    ],
    correctIndex: parseInt(clean(campos[6]), 10),
    sourceRef: clean(campos[7]),
    points: pontosValor,
    theme: clean(campos[9]),
    source,
    difficulty: difficultyFromPoints(pontosValor),
  };
}

export function parseOfficialBlock(raw: string): Question[] {
  const out: Question[] = [];
  for (const line of raw.trim().split('\n')) {
    const q = parseOfficialDataLine(line);
    if (q) out.push(q);
  }
  return out;
}
