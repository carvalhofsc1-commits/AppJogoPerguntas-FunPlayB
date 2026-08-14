// Tipos do sistema FunPlayB

export interface Player {
  id: string;
  nickname: string;
  email: string;
  phone?: string;
  /** Nunca é lido de volta do banco (coluna bloqueada para anon/authenticated) — só existe ao gravar. */
  pin?: string;
  category: 'jogador' | 'admin';
  admin_initials?: string;
  avatar_url?: string;
  email_verified: boolean;
  status?: string;
  created_at: string;
  last_seen_at?: string;
  total_access?: number;
}

export interface PlayerSession {
  player_id: string;
  nickname: string;
  category: 'jogador' | 'admin';
  admin_initials?: string;
}

export interface Theme {
  id: string;
  name: string;
  created_by?: string;
  creator?: { nickname: string };
  is_private?: boolean;
  is_locked?: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  theme_id?: string;
  theme?: Theme;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'a' | 'b' | 'c' | 'd';
  difficulty: 'facil' | 'medio' | 'dificil';
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'inativa';
  reference?: string;
  question_number?: number;
  is_native: boolean;
  created_by?: string;
  creator?: Player;
  approved_by?: string;
  images: string[];
  reviewed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  countdown_phrases: string[];
  correct_phrases: string[];
  wrong_phrases: string[];
  timeout_phrases?: string[];
  skip_phrases: string[];
  finish_phrases: string[];
  mic_prompt: string;      // legado - compat retroativa
  mic_prompts: string[];   // substitui mic_prompt, suporte a múltiplas frases
  pause_on_wrong: boolean;
  created_at: string;
}

export interface GameSettings {
  id?: string;
  player_id?: string;
  allow_skip: boolean;
  max_skips: number;
  max_errors: number;
  allow_help_external: boolean;
  max_help_external: number;
  help_external_pause: number;
  allow_eliminate: boolean;
  max_eliminate: number;
  allow_image_hint: boolean;
  max_image_hint: number;
  timer_seconds: number;
  warning_seconds?: number;
  warning_overlap?: boolean;
  end_on_timeout: boolean;
  max_timeouts: number;
  questions_per_round: number;
  sort_mode: 'aleatorio' | 'gradativo';
  qty_facil: number;
  qty_medio: number;
  qty_dificil: number;
  pts_facil: number;
  pts_medio: number;
  pts_dificil: number;
  pts_help_penalty_pct: number;  // % de desconto nos pontos ao usar ajuda (0-100)
  pts_wrong_penalty: number;     // pontos descontados do total ao errar uma resposta
  allow_vibration: boolean;
  // Avatar/Animação
  avatar_mode: 'emoji' | 'svg';
  avatar_skin: 'clara' | 'media' | 'morena' | 'escura';
  avatar_style: number;  // hair + hat logic
  avatar_glasses: 0 | 1 | 2 | 3; // 0=nenhum, 1=redondo, 2=quadrado, 3=escuro
  avatar_beard: 0 | 1 | 2 | 3;   // 0=nenhum, 1=completa, 2=bigode, 3=cavanhaque
  avatar_eye_color: string;      // cor dos olhos
  avatar_hair_color: string;     // cor do cabelo
  ai_import_prompt?: string;
  sounds: {
    voice_profile_id?: string;
    tts_enabled?: boolean;
    tts_judge_answer?: boolean;
    tts_auto_next?: boolean;
    tts_auto_next_delay?: number;
    voice_input_enabled?: boolean;
    voice_input_prompt?: string;
    voice_input_confirm?: boolean;
    voice_input_timeout?: number;
    answer_suspense_time?: number; // Substitui voice_input_suspense (agora vale pra tudo)
    correct?: string;
    wrong?: string;
    tick?: string;
    suspense?: string;
    timeout?: string;
    next?: string;
    game_start?: string;  // Som tocado ao iniciar o jogo (botão "Toque para Iniciar")
    warning?: string;
    click?: string;
    help_skip?: string;
    help_eliminate?: string;
    help_external?: string;
    result?: string;
    draw_spin?: string;
    draw_stop?: string;
    draw_eliminate?: string;
    volumes?: Record<string, number>;
    filenames?: Record<string, string>;
    active?: Record<string, boolean>;
    beta_message?: string;
    tts_voice_uri?: string;
    tts_rate?: number;
  };
}

export const DEFAULT_SETTINGS: GameSettings = {
  allow_skip: true,
  max_skips: 3,
  max_errors: 0,
  allow_help_external: true,
  max_help_external: 1,
  help_external_pause: 20,
  allow_eliminate: true,
  max_eliminate: 1,
  allow_image_hint: true,
  max_image_hint: 1,
  timer_seconds: 60,
  warning_seconds: 20,
  warning_overlap: false,
  end_on_timeout: true,
  max_timeouts: 1,
  questions_per_round: 10,
  sort_mode: 'gradativo',
  qty_facil: 3,
  qty_medio: 5,
  qty_dificil: 2,
  pts_facil: 5,
  pts_medio: 10,
  pts_dificil: 22,
  pts_help_penalty_pct: 50,  // com ajuda ganha 50% dos pontos
  pts_wrong_penalty: 3,      // perde 3 pts ao errar
  allow_vibration: true,
  avatar_mode: 'svg',
  avatar_skin: 'media',
  avatar_style: 1,
  avatar_glasses: 0,
  avatar_beard: 0,
  avatar_eye_color: '#1C0D00',
  avatar_hair_color: 'preto',
  ai_import_prompt: '',
  sounds: {
    voice_profile_id: '',
    tts_enabled: false,
    tts_judge_answer: false,
    tts_auto_next: false,
    tts_auto_next_delay: 5,
    voice_input_enabled: false,
    voice_input_prompt: 'Pode responder',
    voice_input_confirm: true,
    voice_input_timeout: 10,
    beta_message: 'Bem Vindo ao FunPlayB!',
    volumes: {
      click: 100,
      help_skip: 100,
      help_eliminate: 100,
      help_external: 100,
      correct: 100,
      wrong: 100,
      tick: 50,
      timeout: 100,
      next: 100,
      game_start: 100,
      warning: 60,
      result: 100,
      draw_spin: 80,
      draw_stop: 100,
      draw_eliminate: 100,
    },
    active: {
      click: true,
      help_skip: true,
      help_eliminate: true,
      help_external: true,
      correct: true,
      wrong: true,
      tick: true,
      timeout: true,
      next: true,
      game_start: true,
      warning: true,
      result: true,
      draw_spin: true,
      draw_stop: true,
      draw_eliminate: true,
    }
  },
};

export interface OnlinePlayer {
  player_id: string;
  nickname: string;
  last_ping: string;
}

export interface Invite {
  id: string;
  from_player: string;
  to_player: string;
  from_nickname?: string;
  status: 'pendente' | 'aceito' | 'recusado';
  created_at: string;
}
