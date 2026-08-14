export type QuestionSource = 'official' | 'community' | 'imported';

export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string];
  /** 1–4 */
  correctIndex: number;
  points: number;
  theme: string;
  sourceRef: string;
  source: QuestionSource;
  packId?: string | null;
  difficulty: 'Fácil' | 'Média' | 'Difícil' | 'Desconhecida';
}

export interface QuestionPackMeta {
  id: string;
  title: string;
  description?: string | null;
  created_at: string;
  owner_id?: string;
}

export interface ShareFileV1 {
  format: 'jogo-perguntas-pack-v1';
  title: string;
  createdAt: string;
  questions: Array<{
    text: string;
    options: [string, string, string, string];
    correctIndex: number;
    points: number;
    theme: string;
    sourceRef: string;
  }>;
}

export interface QrPayloadV1 {
  v: 1;
  /** Pacote pequeno embutido; se grande, use packId + supabase */
  embedded?: ShareFileV1;
  /** ID remoto no Supabase */
  packId?: string;
}
