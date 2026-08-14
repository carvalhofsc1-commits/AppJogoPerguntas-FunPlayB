import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, fetchAllPages } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_SETTINGS, type GameSettings, type Question, type VoiceProfile } from '@/types/game';
import { VERSION_CONFIG } from '@/lib/version';
import { ResponsiveText } from '@/components/ResponsiveText';
import { useAudio } from '@/context/AudioContext';
import { AvatarAnimated } from '@/components/AvatarAnimated';
import { EmoticonAnimated } from '@/components/EmoticonAnimated';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';

/* ── Helpers ─────────────────────────────────────────────── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem('funplayb_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /**/ }
  return DEFAULT_SETTINGS;
}


/* ── Cronômetro Neon Ring ────────────────────────────────── */
function AnimClock({ seconds, total, warning }: { seconds: number; total: number; warning: boolean }) {
  const SIZE = 80;
  const STROKE = 7;
  const R = (SIZE - STROKE) / 2;           // raio interno
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const progress = total > 0 ? seconds / total : 0;
  const dashOffset = -CIRCUMFERENCE * (1 - progress); // negativo para esvaziar em sentido horário

  return (
    <div className="play-clock-wrap" style={{ transform: 'translateY(-20px)' }}>
      <div className="play-clock-neon">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="neon-ring-svg"
        >
          {/* Trilha de fundo */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={STROKE}
          />
          {/* Anel de progresso */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={warning ? '#f87171' : '#00e5ff'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className={`neon-ring-arc ${warning ? 'neon-ring-warn' : ''}`}
          />
        </svg>
        {/* Número centralizado */}
        <div className={`play-clock-num ${warning ? 'clock-warn' : ''}`}>
          {seconds}
        </div>
      </div>
    </div>
  );
}

const LETTERS = ['a', 'b', 'c', 'd'] as const;

/* ── Barra de progresso ──────────────────────────────────── */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div
      className="play-progress-bar"
      style={{
        width: '100%',
        height: '6px',
        minHeight: '6px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '3px',
        marginBottom: '10px',
        marginTop: '4px',
        overflow: 'hidden'
      }}
    >
      <div
        className="play-progress-fill"
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: '#f5c842',
          transition: 'width 0.3s ease'
        }}
      />
    </div>
  );
}

/* ── Feedback de Vibração ────────────────────────────────── */
const vibrate = async (pattern: number | number[]) => {
  try {
    if (Capacitor.isNativePlatform()) {
      if (Array.isArray(pattern)) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else {
        await Haptics.vibrate({ duration: pattern as number });
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    }
  } catch (e) {
    console.warn('Vibration failed', e);
  }
};

let globalSpeechId = 0;

const cancelSpeech = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    globalSpeechId++; // Invalida callbacks de onEnd agendados
    window.speechSynthesis.cancel();
  }
};

const speak = (text: string, onStart?: () => void, onEnd?: () => void) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    globalSpeechId++;
    const thisSpeechId = globalSpeechId;
    
    // Não cancela aqui para permitir fila intencional (ex: contagem 3, 2, 1)
    // O caller deve fazer cancel() antes se quiser limpar o estado

    const utterance = new SpeechSynthesisUtterance(text);

    let storedVoiceURI: string | undefined = undefined;
    let storedRate = 1.1;
    try {
      const raw = localStorage.getItem('funplayb_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sounds?.tts_voice_uri !== undefined) {
          storedVoiceURI = parsed.sounds.tts_voice_uri;
        }
        if (parsed.sounds?.tts_rate) storedRate = parsed.sounds.tts_rate;
      }
    } catch { }

    utterance.lang = 'pt-BR';
    utterance.rate = storedRate;

    const voices = window.speechSynthesis.getVoices();
    if (storedVoiceURI === undefined) {
      const googleVoice = voices.find(v => v.name === 'Google português do Brasil');
      if (googleVoice) storedVoiceURI = googleVoice.voiceURI;
    }

    if (storedVoiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === storedVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    if (onStart) {
      utterance.onstart = () => {
        if (thisSpeechId === globalSpeechId) onStart();
      };
    }
    if (onEnd) {
      utterance.onend = () => {
        if (thisSpeechId === globalSpeechId) onEnd();
      };
      utterance.onerror = () => {
        if (thisSpeechId === globalSpeechId) onEnd();
      };
    }
    
    window.speechSynthesis.speak(utterance);
    return utterance;
  }
  return null;
};

/* ── Componente de animação de eliminação ────────────────── */
function EliminationAnimation({ onDone, options, correct, onEliminated, cfg, playSfx, stopSfx }: {
  onDone: () => void;
  options: { letter: string; text: string }[];
  correct: string;
  onEliminated: (letters: string[]) => void;
  cfg: any;
  playSfx: (url?: string, volume?: number, loop?: boolean) => any;
  stopSfx: (source: any) => void;
}) {
  const [spinNumber, setSpinNumber] = useState(1);
  const [finalNumber, setFinalNumber] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(true);
  const spinAudioRef = useRef<any>(null);

  useEffect(() => {
    let spinInterval: any;
    if (isSpinning) {
      // Inicia som de sorteio em loop
      const volSpin = (cfg.sounds?.volumes?.draw_spin ?? 80) / 100;
      const spinActive = cfg.sounds?.active?.draw_spin ?? true;
      if (spinActive && cfg.sounds?.draw_spin) {
        spinAudioRef.current = playSfx(cfg.sounds.draw_spin, volSpin, true);
      }

      spinInterval = setInterval(() => {
        setSpinNumber(n => (n % 3) + 1);
      }, 80); // Um pouco mais rápido para dar emoção
    }
    return () => {
      clearInterval(spinInterval);
      if (spinAudioRef.current) stopSfx(spinAudioRef.current);
    };
  }, [isSpinning, cfg, playSfx, stopSfx]);

  const handleStop = () => {
    setIsSpinning(false);
    if (spinAudioRef.current) {
      stopSfx(spinAudioRef.current);
      spinAudioRef.current = null;
    }

    // Toca som de parada
    const volStop = (cfg.sounds?.volumes?.draw_stop ?? 100) / 100;
    const stopActive = cfg.sounds?.active?.draw_stop ?? true;
    if (stopActive && cfg.sounds?.draw_stop) {
      playSfx(cfg.sounds.draw_stop, volStop, false);
    }

    const lucky = Math.floor(Math.random() * 3) + 1;
    setFinalNumber(lucky);
  };

  const handleApply = () => {
    if (finalNumber === null) return;

    // Toca som de eliminação após sorteio
    const volElim = (cfg.sounds?.volumes?.draw_eliminate ?? 100) / 100;
    const elimActive = cfg.sounds?.active?.draw_eliminate ?? true;
    if (elimActive && cfg.sounds?.draw_eliminate) {
      playSfx(cfg.sounds.draw_eliminate, volElim, false);
    }

    const wrong = options.filter(o => o.letter !== correct);
    const toRemoveCount = Math.min(finalNumber, wrong.length);
    const toRemove = shuffle(wrong).slice(0, toRemoveCount);
    const letters = toRemove.map(o => o.letter);
    onEliminated(letters);
    onDone();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 20000 }}>
      <div className="modal-box draw-modal">
        <h3 className="modal-title">🎲 Sua Sorte!</h3>
        <div className="draw-number-wrap">
          <span className={`draw-number ${!isSpinning ? 'draw-final' : 'draw-spinning'}`}>
            {finalNumber || spinNumber}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          {isSpinning ? (
            <button className="btn-primary" onClick={handleStop} style={{ padding: '0.8rem 2rem', fontSize: '1.2rem', boxShadow: '0 0 20px rgba(245, 200, 66, 0.4)' }}>
              ✋ PARAR AGORA!
            </button>
          ) : (
            <button className="btn-action-yellow" onClick={handleApply} style={{ padding: '1rem 2rem', width: '100%', fontSize: '1.1rem' }}>
              ✂️ Eliminar {finalNumber} errada{finalNumber! > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <p className="draw-subtitle" style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '15px' }}>
          {isSpinning ? '⚠️ O tempo não parou! Seja rápido!' : '✅ Sorteio finalizado! Aplique a ajuda.'}
        </p>
      </div>
    </div>
  );
}

/* ── Frases motivacionais ────────────────────────────────── */
function getMotivationalPhrase(pct: number, totalHelps: number, errors: number): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (pct === 100 && totalHelps === 0 && errors === 0)
    return pick([
      '🏆 LENDÁRIO! Gabaritou sem nenhuma ajuda — você faz parte da elite dos campeões!',
      '🌟 Perfeição absoluta! 100% sem ajuda! Você está no topo da elite do FunPlayB!',
      '💎 Gabaritou do jeito mais difícil: sem nenhuma ajuda! Parabéns, campeão!',
    ]);

  if (pct === 100)
    return pick([
      '🎉 Gabaritou! Na próxima, tente sem ajudas e conquiste a pontuação máxima!',
      '💡 Incrível! Gabaritou com ajudas. Sem elas, você pode ser ainda melhor!',
      '⭐ Perfeito! Agora o desafio é repetir isso sem usar nenhuma ajuda!',
    ]);

  if (pct >= 80)
    return pick([
      '🔥 Excelente! Você está quase perfeito. Faltou pouquinho para gabaritar!',
      '💪 Ótimo resultado! Com mais um pouco de prática você chega ao topo!',
      '⭐ Que desempenho! Você demonstra grande domínio do conteúdo!',
    ]);

  if (pct >= 60)
    return pick([
      '👏 Muito bem! Cada partida você evolui. A vitória total está próxima!',
      '📖 Bom jogo! A Palavra está sendo guardada no seu coração. Continue!',
      '🎯 Bom desempenho! A perfeição está ao seu alcance com mais prática!',
    ]);

  if (pct >= 40)
    return pick([
      '🌱 Continue praticando! O conhecimento vem com o tempo e a dedicação!',
      '💡 Cada erro é uma oportunidade de aprender algo novo. Vamos lá!',
      '🕊️ A Palavra é um tesouro — cada rodada te ajuda a descobrir mais!',
    ]);

  return pick([
    '💪 Não desanime! Os grandes campeões também erraram no início!',
    '🙏 Perseverança é a chave! Continue e você vai surpreender a todos!',
    '📚 O começo é o mais difícil. Jogue mais e evolua rapidamente!',
  ]);
}

/* ── Overlay de Resultado ────────────────────────────────── */
function ResultOverlay({
  score, corrects, errors, total, duration, helps,
  onClose, onRestart, onRanking, onSettings,
  settings, diffBreakdown, abandoned, abandonedPenalty
}: {
  score: number; corrects: number; errors: number; total: number; duration: number;
  helps: any; onClose: () => void; onRestart: () => void; onRanking: () => void; onSettings: () => void;
  settings: GameSettings;
  diffBreakdown: { facil: { correct: number; pts: number }; medio: { correct: number; pts: number }; dificil: { correct: number; pts: number } };
  abandoned?: boolean;
  abandonedPenalty?: number;
}) {
  const { session } = useAuth();
  const { playSfx, stopSfx, stopAllSfx, initAudio } = useAudio();

  // Garante que TODOS os sons parem ao sair da página
  useEffect(() => {
    return () => {
      stopAllSfx();
    };
  }, [stopAllSfx]);

  const resultSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    initAudio(); // Garante que o contexto está ativo

    const url = settings.sounds?.result;
    const vol = (settings.sounds?.volumes?.result ?? 100) / 100;
    const active = settings.sounds?.active?.result ?? true;

    if (url && active) {
      resultSourceRef.current = playSfx(url, vol, false);
    }
    return () => {
      if (resultSourceRef.current) stopSfx(resultSourceRef.current);
    };
  }, [playSfx, stopSfx, initAudio, settings]);

  const pct = total > 0 ? Math.round((corrects / total) * 100) : 0;
  const msg = abandoned ? 'Partida Encerrada!' : (pct === 100 ? 'Você foi fantástico! Gabaritou o jogo!' : pct >= 80 ? 'Excelente!' : pct >= 60 ? 'Muito bem!' : pct >= 40 ? 'Pode melhorar!' : 'Continue treinando!');
  const totalHelps = helps ? (helps.skips + (helps.eliminations || 0) + (helps.external || 0) + (helps.images || 0)) : 0;
  const motivPhrase = abandoned ? '⚠️ A partida foi encerrada antes do fim. Os pontos das perguntas não respondidas foram descontados.' : getMotivationalPhrase(pct, totalHelps, errors);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-box result-modal-box">
        <div className="result-emoji-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', width: '60px', margin: '0.4rem auto' }}>
          {settings?.avatar_mode === 'svg' ? (
            <AvatarAnimated
              mood={pct === 100 ? 'feliz' : 'confiante'}
              skin={settings.avatar_skin}
              style={settings.avatar_style}
              glasses={settings.avatar_glasses}
              beard={settings.avatar_beard}
              eyeColor={settings.avatar_eye_color}
              hairColor={settings.avatar_hair_color}
              size={54}
            />
          ) : (
            <div style={{
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '1.4rem'
            }}>
              <EmoticonAnimated mood={pct === 100 ? 'feliz' : 'confiante'} />
            </div>
          )}
        </div>

        <h1 className="result-title">{msg}</h1>
        <p className="result-player">{session?.nickname}</p>

        <div className="result-score-big">
          <span className="result-score-num">{score}</span>
          <span className="result-score-lbl">pontos</span>
        </div>
        {abandoned && abandonedPenalty !== undefined && abandonedPenalty > 0 && (
          <div style={{ textAlign: 'center', marginTop: '-4px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.85rem', color: '#ff6b6b', fontWeight: 700 }}>
              🔻 -{abandonedPenalty} pts descontados por abandono
            </span>
          </div>
        )}

        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat-val">{corrects}</span>
            <span className="result-stat-lbl">✓ Acertos</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val result-stat-errors">{errors}</span>
            <span className="result-stat-lbl">✗ Erros</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{pct}%</span>
            <span className="result-stat-lbl">Aprovit.</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{formatTime(duration)}</span>
            <span className="result-stat-lbl">Tempo</span>
          </div>
        </div>

        {/* ── Breakdown por dificuldade ── */}
        {(diffBreakdown.facil.correct + diffBreakdown.medio.correct + diffBreakdown.dificil.correct) > 0 && (
          <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-around', flexWrap: 'wrap' }}>
            {diffBreakdown.facil.correct > 0 && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#4cff91', fontSize: '1rem' }}>{diffBreakdown.facil.correct} Fácil</span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>+{diffBreakdown.facil.pts} pts</span>
              </div>
            )}
            {diffBreakdown.facil.correct > 0 && diffBreakdown.medio.correct > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>│</span>}
            {diffBreakdown.medio.correct > 0 && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#f5c842', fontSize: '1rem' }}>{diffBreakdown.medio.correct} Médio</span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>+{diffBreakdown.medio.pts} pts</span>
              </div>
            )}
            {diffBreakdown.medio.correct > 0 && diffBreakdown.dificil.correct > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>│</span>}
            {diffBreakdown.dificil.correct > 0 && (
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#ff6b6b', fontSize: '1rem' }}>{diffBreakdown.dificil.correct} Difícil</span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>+{diffBreakdown.dificil.pts} pts</span>
              </div>
            )}
          </div>
        )}

        {totalHelps > 0 && (
          <div className="result-helps-box">
            <p className="result-helps-title">🆘 Ajudas Utilizadas: <strong>{totalHelps}</strong></p>
            <div className="result-helps-list">
              {helps.skips > 0 && <span>⏭ Pulos: {helps.skips}</span>}
              {helps.eliminations > 0 && <span>✂️ Eliminar: {helps.eliminations}</span>}
              {helps.external > 0 && <span>🙋 Ajuda: {helps.external}</span>}
              {helps.images > 0 && <span>🖼 Gravura: {helps.images}</span>}
            </div>
          </div>
        )}

        {motivPhrase && (
          <div className="result-motiv-phrase">
            {motivPhrase}
          </div>
        )}

        <div className="result-actions">
          <button className="btn-primary" onClick={onRestart}>🔄 Jogar novamente</button>
          <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
            <button className="btn-secondary" onClick={onRanking} style={{ flex: 1, padding: '0.45rem 0.1rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>🏆 Ranking</button>
            <button className="btn-secondary" onClick={onSettings} style={{ flex: 1, padding: '0.45rem 0.1rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>⚙️ Configurações</button>
            <button className="btn-secondary" onClick={onClose} style={{ flex: 1, padding: '0.45rem 0.1rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>🏠 Início</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAY — tela principal do jogo
   ══════════════════════════════════════════════════════════ */
export default function Play() {
  const { session } = useAuth();
  const { playSfx, stopSfx, stopAllSfx, preloadSfx, isPreloaded, isMuted, toggleMute } = useAudio();

  // Garante que TODOS os sons parem ao sair da página ou ao trocar de contexto
  useEffect(() => {
    return () => {
      stopAllSfx();
    };
  }, [stopAllSfx]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const themeIds = (searchParams.get('themes') ?? '').split(',').filter(Boolean);
  const mode = (searchParams.get('mode') ?? 'solo') as 'solo' | 'grupo';

  const settings = useRef<GameSettings>(loadSettings());
  const cfg = settings.current;

  const tickSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const warnSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const feedbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  /* ── Estado do jogo ──────────────────────────────────── */
  const [questions, setQuestions] = useState<Question[]>([]);
  const [extraQuestions, setExtraQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState('Iniciando...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [phase, setPhase] = useState<'question' | 'feedback' | 'done'>('question');
  const [themeStats, setThemeStats] = useState<Record<string, { total: number; available: number }>>({});
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [helpsThisQuestion, setHelpsThisQuestion] = useState(0);

  /* Placar */
  const [score, setScore] = useState(0);
  const [abandonedPenalty, setAbandonedPenalty] = useState(0);
  const [corrects, setCorrects] = useState(0);
  const [errors, setErrors] = useState(0);
  const [diffBreakdown, setDiffBreakdown] = useState<{
    facil: { correct: number; pts: number };
    medio: { correct: number; pts: number };
    dificil: { correct: number; pts: number };
  }>({ facil: { correct: 0, pts: 0 }, medio: { correct: 0, pts: 0 }, dificil: { correct: 0, pts: 0 } });
  const [skipsLeft, setSkipsLeft] = useState(cfg.allow_skip ? cfg.max_skips : 0);
  const [helpLeft, setHelpLeft] = useState(cfg.allow_help_external ? cfg.max_help_external : 0);
  const [elimLeft, setElimLeft] = useState(cfg.allow_eliminate ? cfg.max_eliminate : 0);
  const [imgHintLeft, setImgHintLeft] = useState(cfg.allow_image_hint ? cfg.max_image_hint : 0);
  const [timeoutsCount, setTimeoutsCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoRead, setAutoRead] = useState(!!(settings.current.sounds?.tts_enabled));

  /* ── Manter Tela Ativa ───────────────────────────────── */
  useEffect(() => {
    const keepScreenOn = async () => {
      try {
        await KeepAwake.keepAwake();
      } catch (err) {
        try {
          if ('wakeLock' in navigator) {
            await (navigator as any).wakeLock.request('screen');
          }
        } catch (e) {}
      }
    };

    const allowScreenSleep = async () => {
      try {
        await KeepAwake.allowSleep();
      } catch (err) {}
    };

    keepScreenOn();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        keepScreenOn();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      allowScreenSleep();
    };
  }, []);

  /* Contadores de uso de ajuda */
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [elimUsed, setElimUsed] = useState(0);
  const [helpExtUsed, setHelpExtUsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  /* Resposta */
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const selectedLetterRef = useRef<string | null>(null);
  useEffect(() => { selectedLetterRef.current = selectedLetter; }, [selectedLetter]);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const voiceMatchedRef = useRef(false);
  
  useEffect(() => { 
    setSecondChanceUsed(false); 
    voiceMatchedRef.current = false;
  }, [idx]);

  const [shuffledOptions, setShuffledOptions] = useState<{ id: string, text: string }[]>([]);
  const [revealCorrect, setRevealCorrect] = useState(false);
  const [eliminatedLetters, setEliminatedLetters] = useState<string[]>([]);
  const [showElimAnim, setShowElimAnim] = useState(false);
  const [showImageHint, setShowImageHint] = useState(false);
  const [micTimeLeft, setMicTimeLeft] = useState<number | null>(null);
  const micTimeLeftRef = useRef<number | null>(null);
  useEffect(() => { micTimeLeftRef.current = micTimeLeft; }, [micTimeLeft]);
  // Ref usado no timer principal para pausar o cronômetro enquanto o mic está aberto
  const isMicOpenRef = useRef(false);
  useEffect(() => { isMicOpenRef.current = micTimeLeft !== null; }, [micTimeLeft]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [persistentTranscript, setPersistentTranscript] = useState<string | null>(null);

  useEffect(() => {
    if (liveTranscript) setPersistentTranscript(liveTranscript);
  }, [liveTranscript]);

  useEffect(() => {
    if (micTimeLeft === null && persistentTranscript) {
      const t = setTimeout(() => {
        setPersistentTranscript(null);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [micTimeLeft, persistentTranscript]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showEndPreview, setShowEndPreview] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [showReviewReq, setShowReviewReq] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewedQIds, setReviewedQIds] = useState<Set<string>>(new Set());
  const [isRefExpanded, setIsRefExpanded] = useState(false);


  /* Cronômetro */
  const [timeLeft, setTimeLeft] = useState(cfg.timer_seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const totalTimeRef = useRef(0);

  /* Relógio de tempo total */
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const [pauseTicks, setPauseTicks] = useState(0);
  const [isPausedManually, setIsPausedManually] = useState(false);
  // iOS/Android bloqueiam áudio até o usuário tocar. Este estado indica que precisamos de um gesto
  // antes de iniciar a narração/microfone.
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const micPermissionGrantedRef = useRef<boolean | null>(null);
  const pendingCountdownRef = useRef<(() => void) | null>(null);


  const [aiConfidenceText, setAiConfidenceText] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiSuggestedLetter, setAiSuggestedLetter] = useState<string | null>(null);

  /* TV mode */
  const isTvMode = window.matchMedia('(min-width: 900px)').matches;

  /* Refs para estabilizar funções voláteis usadas no timer para evitar resets */
  const recordAuditRef = useRef<any>(null);
  const markAnsweredRef = useRef<any>(null);
  const playSfxRef = useRef<any>(null);
  const stopSfxRef = useRef<any>(null);
  const handleSubmitAnswerRef = useRef<any>(null);
  const voiceProfileRef = useRef<VoiceProfile | null>(null);
  /* Refs de estado para uso dentro do timer sem criar dependências instáveis */
  const questionsRef = useRef<Question[]>([]);
  const idxRef = useRef(0);
  /* Ref para acumular todas as perguntas respondidas e garantir o save em batch no finishGame */
  const answeredLocalRef = useRef<Set<string>>(new Set());
  /* Ref para o tick do microfone */
  const micTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recognitionRef = useRef<any>(null);
  const suspenseSoundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suspenseSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Relógio de tempo total ───────────────────────── */
  useEffect(() => {
    // Para o relógio quando o overlay de resultado está visível
    if (loading || phase === 'done') return;
    const iv = setInterval(() => {
      setElapsedSecs(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [loading, phase]);

  /* ── Intercepta botão voltar do Android/browser ──────────── */
  useEffect(() => {
    const handlePopState = () => {
      // Ao voltar durante o jogo, redireciona para a Home substituindo a entrada atual.
      // Sem o pushState extra, o histórico fica limpo e o Ranking funciona corretamente.
      navigate('/', { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  /* ── Carregar perguntas ───────────────────────────────── */
  useEffect(() => {
    if (!supabase || !session || themeIds.length === 0) {
      navigate('/select-theme');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingPhase('Buscando configurações...');
      setLoadingProgress(5);

      // Sons são SEMPRE carregados do admin (configuração universal).
      // Regras de jogo (timer, ajudas, etc.) vêm do próprio jogador se ele tiver configurações.
      const [
        allQs,
        answeredRows,
        { data: userSettings },
        { data: sessionSeq },
        { data: adminPlayer }
      ] = await Promise.all([
        fetchAllPages((from, to) => 
          supabase!.from('questions').select('*, theme:themes(name), creator:players!created_by(nickname)')
            .in('theme_id', themeIds).eq('status', 'aprovada').order('id').range(from, to)
        ),
        mode === 'solo'
          ? fetchAllPages((from, to) => supabase!.from('answered_questions').select('question_id').eq('player_id', session.player_id).range(from, to))
          : Promise.resolve([]),
        supabase!
          .from('game_settings')
          .select('*')
          .eq('player_id', session.player_id)
          .maybeSingle(),
        supabase!.rpc('get_next_game_session'),
        // Busca o admin REAL para obter os sons universais (exclui o player global 000...)
        supabase!.from('players').select('id').eq('category', 'admin').neq('id', '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: true }).limit(1).maybeSingle()
      ]);

      if (cancelled) return;
      setLoadingProgress(30);

      // Log de diagnóstico
      console.log('[Play] themeIds:', themeIds);
      console.log('[Play] allQs length:', allQs?.length ?? 'null');
      console.log('[Play] answeredRows length:', answeredRows?.length ?? 'null');

      // Guarda defensiva: se a query falhou (allQs = null ou array vazio), não exibe tela vazia
      if (!allQs || allQs.length === 0) {
        console.error('[Play] ALERTA: Query de perguntas retornou vazio. themeIds:', themeIds, 'allQs:', allQs);
        // Tenta uma segunda vez antes de redirecionar
        const retry = await supabase!.from('questions').select('id, theme_id, status').in('theme_id', themeIds).eq('status', 'aprovada').limit(1);
        console.error('[Play] Retry result:', retry.data?.length, 'error:', retry.error?.message);
        navigate('/select-theme', { replace: true });
        return;
      }

      if (sessionSeq) setSessionNumber(sessionSeq as number);

      // Regras de jogo: usa as do jogador se existirem, senão usa DEFAULT
      const playerSettings = userSettings
        ? (() => {
          const { id: _i, player_id: _p, updated_at: _u, ...rest } = userSettings as any;
          return { ...DEFAULT_SETTINGS, ...rest };
        })()
        : DEFAULT_SETTINGS;

      // Sons: busca SEMPRE do admin (único que configura)
      let adminSounds: any = null;
      if (adminPlayer) {
        const { data: adminCfg } = await supabase!
          .from('game_settings')
          .select('sounds')
          .eq('player_id', (adminPlayer as any).id)
          .maybeSingle();
        adminSounds = adminCfg?.sounds ?? null;
      }

      if (cancelled) return;

      // Configuração final: regras do jogador + sons do admin
      let effectiveSettings = { ...playerSettings };
      if (adminSounds) {
        effectiveSettings.sounds = {
          ...playerSettings.sounds, // Mantém preferências do jogador
          // Sobrescreve apenas os arquivos de áudio e configs globais do Admin
          volumes: adminSounds.volumes ?? playerSettings.sounds?.volumes,
          active: adminSounds.active ?? playerSettings.sounds?.active,
          beta_message: adminSounds.beta_message ?? playerSettings.sounds?.beta_message,
          click: adminSounds.click ?? playerSettings.sounds?.click,
          help_skip: adminSounds.help_skip ?? playerSettings.sounds?.help_skip,
          help_eliminate: adminSounds.help_eliminate ?? playerSettings.sounds?.help_eliminate,
          help_external: adminSounds.help_external ?? playerSettings.sounds?.help_external,
          correct: adminSounds.correct ?? playerSettings.sounds?.correct,
          wrong: adminSounds.wrong ?? playerSettings.sounds?.wrong,
          tick: adminSounds.tick ?? playerSettings.sounds?.tick,
          suspense: adminSounds.suspense ?? playerSettings.sounds?.suspense,
          timeout: adminSounds.timeout ?? playerSettings.sounds?.timeout,
          next: adminSounds.next ?? playerSettings.sounds?.next,
          game_start: adminSounds.game_start ?? playerSettings.sounds?.game_start,
          warning: adminSounds.warning ?? playerSettings.sounds?.warning,
          result: adminSounds.result ?? playerSettings.sounds?.result,
          draw_spin: adminSounds.draw_spin ?? playerSettings.sounds?.draw_spin,
          draw_stop: adminSounds.draw_stop ?? playerSettings.sounds?.draw_stop,
          draw_eliminate: adminSounds.draw_eliminate ?? playerSettings.sounds?.draw_eliminate,
          filenames: adminSounds.filenames ?? playerSettings.sounds?.filenames,
        };
      }

      // Sincroniza localmente para funções globais (como speak) poderem ler
      localStorage.setItem('funplayb_settings', JSON.stringify(effectiveSettings));

      // Busca Voice Profile se existir
      if (effectiveSettings.sounds?.voice_profile_id) {
        try {
          const { data: vpData } = await supabase!.from('voice_profiles').select('*').eq('id', effectiveSettings.sounds.voice_profile_id).maybeSingle();
          if (vpData) {
            voiceProfileRef.current = vpData;
          }
        } catch (e) {
          console.error('[Play] Erro ao buscar voice_profile', e);
        }
      }

      // APLICA OVERRIDES DE AJUSTES RÁPIDOS (sessionStorage)
      // Isso garante que mudanças feitas na tela de seleção persistam na partida atual
      try {
        const SESSION_KEY = 'funplayb_quick_settings';
        const rawQuick = sessionStorage.getItem(SESSION_KEY);
        if (rawQuick) {
          const quick = JSON.parse(rawQuick);
          effectiveSettings = {
            ...effectiveSettings,
            timer_seconds: quick.timer_seconds ?? effectiveSettings.timer_seconds,
            questions_per_round: quick.questions_per_round ?? effectiveSettings.questions_per_round,
            sort_mode: quick.sort_mode ?? effectiveSettings.sort_mode,
            qty_facil: quick.qty_facil ?? effectiveSettings.qty_facil,
            qty_medio: quick.qty_medio ?? effectiveSettings.qty_medio,
            qty_dificil: quick.qty_dificil ?? effectiveSettings.qty_dificil,
          };
          if (quick.voice_input_enabled !== undefined) {
            effectiveSettings.sounds = {
              ...effectiveSettings.sounds,
              voice_input_enabled: quick.voice_input_enabled,
              tts_enabled: quick.voice_input_enabled // Habilita/desabilita narração junto
            };
          }
          console.log('[Play] Overrides aplicados:', quick);
        }
      } catch (e) {
        console.error('[Play] Erro ao carregar quick settings:', e);
      }

      settings.current = effectiveSettings;
      setAutoRead(!!effectiveSettings.sounds?.tts_enabled);

      setSkipsLeft(effectiveSettings.allow_skip ? effectiveSettings.max_skips : 0);
      setHelpLeft(effectiveSettings.allow_help_external ? effectiveSettings.max_help_external : 0);
      setElimLeft(effectiveSettings.allow_eliminate ? effectiveSettings.max_eliminate : 0);
      setImgHintLeft(effectiveSettings.allow_image_hint ? effectiveSettings.max_image_hint : 0);
      setTimeLeft(effectiveSettings.timer_seconds);

      // Pré-carrega os sons com progresso real por arquivo
      setLoadingPhase('Carregando sons...');
      setLoadingProgress(35);
      const s = effectiveSettings.sounds as any;
      const soundUrls: string[] = s
        ? [s.click, s.correct, s.wrong, s.tick, s.timeout, s.warning, s.next, s.help_skip, s.help_eliminate, s.help_external, s.result, s.draw_spin, s.draw_stop, s.draw_eliminate, s.game_start].filter(Boolean) as string[]
        : [];

      await preloadSfx(soundUrls, (pct) => {
        if (!cancelled) {
          // Sons ocupam a faixa 35% → 90% da barra
          setLoadingProgress(35 + Math.round(pct * 0.55));
        }
      });

      if (cancelled) return;

      setLoadingPhase('Preparando partida...');

      const answeredSet = new Set((answeredRows ?? []).map((r: any) => r.question_id));

      const stats: Record<string, { total: number; available: number }> = {};
      const pool = (allQs ?? []).map((q: any) => {
        const themeName = q.theme?.name ?? '';
        if (themeName) {
          if (!stats[themeName]) stats[themeName] = { total: 0, available: 0 };
          stats[themeName].total++;
          if (!answeredSet.has(q.id)) stats[themeName].available++;
        }
        return {
          ...q,
          theme_id: q.theme?.id ?? q.theme_id,
          images: q.images ?? [],
          theme: themeName,
        };
      }) as Question[];

      setThemeStats(stats);

      let available = mode === 'solo' ? pool.filter(q => !answeredSet.has(q.id)) : pool;
      if (available.length === 0 && pool.length > 0) {
        alert("🎉 Parabéns! Você já respondeu todas as perguntas deste tema. O progresso do tema foi reiniciado para você jogar novamente.");

        // Remove from DB to actually reset the progress
        try {
          const poolIds = pool.map(q => q.id);
          // Dividir em chunks se for muito grande
          for (let i = 0; i < poolIds.length; i += 150) {
            const chunk = poolIds.slice(i, i + 150);
            await supabase!
              .from('answered_questions')
              .delete()
              .eq('player_id', session.player_id)
              .in('question_id', chunk);
          }
        } catch (err) {
          console.error('Erro ao resetar progresso do tema:', err);
        }

        available = pool; // reset automático se todas respondidas
      }

      let selected: Question[];
      if (effectiveSettings.sort_mode === 'gradativo') {
        // Embaralha TODO o pool disponível antes de separar por dificuldade
        // Isso garante que cada sessão tenha uma seleção diferente dentro de cada grupo
        const shuffledAvailable = shuffle(available);
        const byDiff: Record<string, Question[]> = { facil: [], medio: [], dificil: [] };

        shuffledAvailable.forEach(q => {
          const norm = (q.difficulty || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (norm.includes('facil')) byDiff.facil.push(q);
          else if (norm.includes('medio')) byDiff.medio.push(q);
          else if (norm.includes('dificil')) byDiff.dificil.push(q);
        });

        // Como shuffledAvailable já está embaralhado, cada grupo já é aleatório
        // slice() direto sem novo shuffle() para preservar a diversidade do embaralhamento inicial
        selected = [
          ...byDiff.facil.slice(0, effectiveSettings.qty_facil),
          ...byDiff.medio.slice(0, effectiveSettings.qty_medio),
          ...byDiff.dificil.slice(0, effectiveSettings.qty_dificil),
        ];

        if (selected.length < effectiveSettings.questions_per_round) {
          const extra = shuffledAvailable.filter(q => !selected.find(s => s.id === q.id));
          selected = [...selected, ...extra].slice(0, effectiveSettings.questions_per_round);
        }
      } else {
        selected = shuffle(available).slice(0, effectiveSettings.questions_per_round);
      }

      // Guarda defensiva: se selected ainda estiver vazio mas há perguntas no pool,
      // usa o pool diretamente para não deixar o jogador preso na tela vazia
      if (selected.length === 0 && available.length > 0) {
        console.warn('[Play] selected vazio após processamento. Usando fallback do pool.');
        selected = shuffle(available).slice(0, effectiveSettings.questions_per_round || available.length);
      }


      console.log('[Play] pool:', pool.length, '| available:', available.length, '| selected:', selected.length);

      setQuestions(selected);
      setExtraQuestions(shuffle(available.filter(q => !selected.some(s => s.id === q.id))));

      setLoadingPhase('Preparando partida...');
      setLoadingProgress(100);

      // Detecta se estamos em iOS/Android onde áudio exige gesto do usuário
      const isIOSOrMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
      const needsGesture = isIOSOrMobile && !!effectiveSettings.sounds?.tts_enabled;

      if (effectiveSettings.sounds?.tts_enabled) {
        let isCancelled = false;
        
        const playCountdown = (phrases: string[], index: number = 0) => {
          if (isCancelled) return;
          if (index >= phrases.length) {
            setLoading(false);
            startTimeRef.current = Date.now();
            return;
          }
          setLoadingPhase(phrases[index] + '...');
          
          const phraseStartedAt = Date.now();
          // Tempo mínimo por frase (Android pode disparar onend instantâneamente)
          const MIN_PHRASE_MS = 1300;

          let hasProceeded = false;
          const proceed = () => {
            if (hasProceeded || isCancelled) return;
            hasProceeded = true;
            // Garante que a próxima frase só começa após MIN_PHRASE_MS
            const elapsed = Date.now() - phraseStartedAt;
            const waitMs = Math.max(0, MIN_PHRASE_MS - elapsed);
            setTimeout(() => playCountdown(phrases, index + 1), waitMs);
          };

          speak(phrases[index], undefined, proceed);
          
          // Fallback ultra seguro: se o TTS não emitir 'onend' (iOS/Android)
          // começa próxima frase após timeout conservador
          setTimeout(proceed, Math.max(4000, phrases[index].length * 120 + 2000));
        };

        const doCountdown = () => {
          // Faz um cancel() limpo antes da primeira fala para garantir motor fresco
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          // Aguarda 250ms após cancel para Android processar antes de começar a falar
          setTimeout(() => {
            if (isCancelled) return;
            if (voiceProfileRef.current?.countdown_phrases?.length) {
              playCountdown(voiceProfileRef.current.countdown_phrases);
            } else {
              playCountdown(['3', '2', '1', 'Iniciando o jogo']);
            }
          }, 250);
        };

        if (needsGesture) {
          // Mobile: armazena o countdown e exibe botão para o usuário tocar
          setLoadingPhase('Pronto! Toque para iniciar...');
          pendingCountdownRef.current = doCountdown;
          setNeedsUserGesture(true);
        } else {
          // Desktop: inicia automaticamente
          setTimeout(() => {
            if (!isCancelled) doCountdown();
          }, 500);
        }

        // O return final fará o cleanup local
        return () => { isCancelled = true; cancelled = true; };

      } else {
        if (needsGesture) {
          // Mobile sem TTS: ainda pede gesto para garantir AudioContext desbloqueado
          setLoadingPhase('Pronto! Toque para iniciar...');
          pendingCountdownRef.current = () => {
            setLoading(false);
            startTimeRef.current = Date.now();
          };
          setNeedsUserGesture(true);
        } else {
          setTimeout(() => {
            if (!cancelled) {
              setLoading(false);
              startTimeRef.current = Date.now();
            }
          }, 300);
        }
      }
    };

    load();
    // Cleanup: cancela atualizações de estado se o componente desmontar
    // (necessário para o React StrictMode que monta/desmonta 2x em desenvolvimento)
    return () => { cancelled = true; };
  }, []);

  /* ── Cronômetro ───────────────────────────────────────── */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopSfx(tickSourceRef.current);
    tickSourceRef.current = null;
    stopSfx(warnSourceRef.current);
    warnSourceRef.current = null;
  }, [stopSfx]);

  /* ── Auditoria de Jogo ── */
  const recordAudit = useCallback(async (letter: string | null, isCorrect: boolean, timeSpent: number) => {
    if (!supabase || mode !== 'solo' || sessionNumber === null || !session) return;

    const q = questions[idx];
    if (!q) return;

    // Busca o ciclo atual do tema (se não existir, considera 1)
    const { data: cycleData, error: cycleErr } = await supabase
      .from('theme_cycles')
      .select('cycle')
      .eq('player_id', session.player_id)
      .eq('theme_id', q.theme_id)
      .maybeSingle();

    if (cycleErr) console.error('[recordAudit] Erro ao buscar theme_cycles:', cycleErr);

    const currentCycle = cycleData?.cycle || 1;

    // Mapeia letras (a/A/b/B...) para números 1-4
    const optionMap: Record<string, number> = {
      a: 1, A: 1, b: 2, B: 2, c: 3, C: 3, d: 4, D: 4
    };
    const selectedNum = letter ? (optionMap[letter] || 0) : 0;

    return supabase.from('question_audit').insert({
      player_id: session.player_id,
      question_id: q.id,
      session_number: sessionNumber,
      time_spent: timeSpent,
      is_correct: isCorrect,
      selected_option: selectedNum,
      helps_used: helpsThisQuestion,
      theme_cycle: currentCycle
    });
  }, [supabase, mode, sessionNumber, questions, idx, session, helpsThisQuestion]);

  /* ── Registrar respondida ────────────────────────────── */
  const markAnswered = useCallback(async (questionId: string) => {
    if (!supabase || mode !== 'solo' || !session) {
      console.warn('[markAnswered] SKIPPED — mode:', mode, 'session:', !!session);
      return;
    }
    // Rastreia localmente para o batch-save em finishGame
    answeredLocalRef.current.add(questionId);

    // Tenta salvar com retry automático (iOS Safari pode falhar na primeira tentativa de rede)
    let { error } = await supabase.from('answered_questions').upsert(
      { player_id: session.player_id, question_id: questionId },
      { onConflict: 'player_id,question_id' }
    );
    if (error) {
      // Retry silencioso após 1s
      await new Promise(r => setTimeout(r, 1000));
      const retry = await supabase.from('answered_questions').upsert(
        { player_id: session.player_id, question_id: questionId },
        { onConflict: 'player_id,question_id' }
      );
      if (retry.error) {
        console.error('[markAnswered] ERRO ao salvar questionId (após retry):', questionId, retry.error);
      }
    }
  }, [session, mode, supabase]);

  /* Atualiza os refs das funções sempre que elas mudarem, permitindo que o timer as use sem resetar */
  useEffect(() => { recordAuditRef.current = recordAudit; }, [recordAudit]);
  useEffect(() => { markAnsweredRef.current = markAnswered; }, [markAnswered]);
  useEffect(() => { playSfxRef.current = playSfx; }, [playSfx]);
  useEffect(() => { stopSfxRef.current = stopSfx; }, [stopSfx]);
  
  // Ref para garantir que o timeout sempre execute a versão mais recente
  useEffect(() => {
    // Definido mais abaixo, atualiza sempre que for recriado
  });
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  const isPausedManuallyRef = useRef(isPausedManually);
  useEffect(() => { isPausedManuallyRef.current = isPausedManually; }, [isPausedManually]);
  // Ref para pausar o timer enquanto o TTS está narrando a pergunta
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  const startTimer = useCallback(() => {
    stopTimer();
    const cfgNow = settings.current;
    setTimeLeft(cfgNow.timer_seconds);
    setPauseTicks(0);
    setIsPausedManually(false);

    const volTick = (cfgNow.sounds?.volumes?.tick ?? 50) / 100;
    const tickActive = cfgNow.sounds?.active?.tick ?? true;

    if (tickActive) {
      tickSourceRef.current = playSfxRef.current(cfgNow.sounds?.tick, volTick, true);
    }

    timerRef.current = setInterval(() => {
      if (isPausedManuallyRef.current) {
        if (tickSourceRef.current && tickSourceRef.current.playbackRate) tickSourceRef.current.playbackRate.value = 0;
        return;
      }
      // Pausa o timer enquanto o TTS está narrando (evita timeout durante a leitura da pergunta)
      if (isSpeakingRef.current) {
        if (tickSourceRef.current && tickSourceRef.current.playbackRate) tickSourceRef.current.playbackRate.value = 0;
        return;
      }
      // Pausa o timer enquanto o microfone está aberto (evita timeout durante a escuta da resposta)
      if (isMicOpenRef.current) {
        if (tickSourceRef.current && tickSourceRef.current.playbackRate) tickSourceRef.current.playbackRate.value = 0;
        return;
      }
      setPauseTicks(currentPause => {
        if (currentPause > 0) {
          // Se estiver pausado, o som de tick pode ser pausado (opcional), mas vamos apenas pular o tempo
          if (tickSourceRef.current && tickSourceRef.current.playbackRate) {
             tickSourceRef.current.playbackRate.value = 0.5; // Efeito de câmera lenta ou apenas ignorar
          }
          return currentPause - 1;
        }

        if (tickSourceRef.current && tickSourceRef.current.playbackRate) {
           tickSourceRef.current.playbackRate.value = 1.0;
        }

        setTimeLeft(prev => {
          if (prev <= 1) {
          stopTimer();
          const volTimeout = (cfgNow.sounds?.volumes?.timeout ?? 100) / 100;
          const timeoutActive = cfgNow.sounds?.active?.timeout ?? true;
          if (timeoutActive) playSfxRef.current(cfgNow.sounds?.timeout, volTimeout);

          // Timeout = erro automático
          setRevealCorrect(true);
          setPhase('feedback');
          setFeedbackReason('timeout');
          setErrors(e => e + 1);
          setTimeoutsCount(p => p + 1);

          // Auditoria (Timeout) e marca como respondida — usa refs para não criar deps instáveis
          const q = questionsRef.current[idxRef.current];
          if (q) markAnsweredRef.current(q.id);
          recordAuditRef.current(null, false, cfgNow.timer_seconds);

          return 0;
        }

        // Transição para música de aviso nos segundos finais configurados
        const warningMark = cfgNow.warning_seconds ?? Math.ceil(cfgNow.timer_seconds * 0.3);
        const warnActive = cfgNow.sounds?.active?.warning ?? true;
        if (prev - 1 === warningMark && cfgNow.sounds?.warning && warnActive) {
          if (!cfgNow.warning_overlap) {
            stopSfxRef.current(tickSourceRef.current);
            tickSourceRef.current = null;
          }
          const volWarn = (cfgNow.sounds?.volumes?.warning ?? 60) / 100;
          warnSourceRef.current = playSfxRef.current(cfgNow.sounds?.warning, volWarn, true);
        }

        return prev - 1;
      });
      return 0; // Para o setPauseTicks não reclamar
      }); // close setPauseTicks
    }, 1000);
    // startTimer é estável: questions e idx são lidos via refs, não via closure
  }, [stopTimer]);

  useEffect(() => {
    if (!loading && phase === 'question') startTimer();
    return stopTimer;
  }, [loading, idx, phase, startTimer, stopTimer]);

  /* ── Auto-close Ajuda Externa Modal ────────────────────── */
  useEffect(() => {
    if (showHelpModal && pauseTicks <= 0) {
      setShowHelpModal(false);
    }
  }, [pauseTicks, showHelpModal]);

  /* ── Reset Pause and Auto-Select Suggestion when Help Modal Closes ── */
  useEffect(() => {
    if (!showHelpModal) {
      setPauseTicks(0);
      if (aiSuggestedLetter) {
        handleSelectOption(aiSuggestedLetter);
        setAiSuggestedLetter(null);
      }
    }
  }, [showHelpModal, aiSuggestedLetter]);

  /* ── Embaralhar Opções ────────────────────────────────── */
  useEffect(() => {
    if (questions.length === 0 || idx >= questions.length) return;
    const q = questions[idx];
    const opts = ['a', 'b', 'c', 'd'].map(l => ({ id: l, text: q[`option_${l}` as 'option_a'] })).filter(o => o.text);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    setShuffledOptions(opts);

    // Cancela leitura anterior ao trocar de pergunta apenas se não estiver carregando
    // para não interromper a contagem regressiva inicial
    if (!loading && typeof window !== 'undefined' && window.speechSynthesis) {
      cancelSpeech();
      setIsSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, questions[idx]?.id]);

  /* ── Preload de imagens da pergunta atual ────────────────── */
  useEffect(() => {
    if (questions.length === 0 || idx >= questions.length) return;
    const q = questions[idx];
    if (q.images && q.images.length > 0) {
      q.images.forEach(url => {
        const img = new Image();
        img.src = url;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, questions[idx]?.id]);

  /* ── Leitura automática ao trocar de pergunta ────────────────── */
  useEffect(() => {
    if (loading || !autoRead || shuffledOptions.length === 0 || questions.length === 0) return;
    const q = questions[idx];
    if (!q) return;
    if (window.speechSynthesis) cancelSpeech();
    const optionsText = shuffledOptions.map((o, i) => `Opção ${LETTERS[i].toUpperCase()}: ${o.text}`).join('. ');
    const isLastQuestion = idx === questions.length - 1;
    const introText = isLastQuestion 
      ? `Vamos para a ${idx + 1}ª e última pergunta! ${q.statement}`
      : `${idx + 1}ª pergunta: ${q.statement}`;

    speak(
      `${introText}. ${optionsText}`,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        if (cfg.sounds?.voice_input_enabled && cfg.sounds?.tts_enabled) {
          setTimeout(() => {
            const vp = voiceProfileRef.current;
            let prompt = 'Pode responder';
            if (vp?.mic_prompts?.length) {
              prompt = vp.mic_prompts[phraseIndexRef.current.micPrompt % vp.mic_prompts.length];
              phraseIndexRef.current.micPrompt++;
            } else if (vp?.mic_prompt) {
              prompt = vp.mic_prompt;
            }
            speak(prompt, undefined, () => {
              setTimeout(() => {
                startVoiceRecognition();
              }, 600);
            });
          }, 500);
        }
      }
    );
  }, [shuffledOptions, autoRead, loading]);

  /* ── Encerrar jogo ────────────────────────────────────── */
  const finishGame = useCallback((forceTotal?: number, abandoned = false) => {
    stopTimer();
    stopAllSfx();
    const finalTotal = forceTotal ?? questions.length;
    // Para qualquer áudio de feedback/tick que estava tocando
    // Cancela leitura em voz alta
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      cancelSpeech();
      setIsSpeaking(false);
    }

    // Penalidade por abandono: desconta pts_wrong_penalty para cada pergunta não respondida
    let penaltyApplied = 0;
    if (abandoned) {
      const wrongPenalty = settings.current.pts_wrong_penalty ?? 3;
      const questionsAnswered = idx + (selectedLetter ? 1 : 0);
      const questionsRemaining = Math.max(0, finalTotal - questionsAnswered);
      penaltyApplied = wrongPenalty * questionsRemaining;
      if (penaltyApplied > 0) {
        setScore(s => Math.max(0, s - penaltyApplied));
      }
      setAbandonedPenalty(penaltyApplied);
    }

    totalTimeRef.current = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Narrar fim da rodada (frases de finish + frase motivacional)
    if (!abandoned && settings.current.sounds?.tts_enabled) {
      const vp = voiceProfileRef.current;
      const cleanArr = (arr?: string[]) => (arr || []).filter(s => s.trim() !== '');
      const finishPhrases = cleanArr(vp?.finish_phrases);
      const finishPhrase = finishPhrases.length
        ? finishPhrases[Math.floor(Math.random() * finishPhrases.length)]
        : 'Bravo! Chegou ao fim da rodada!';

      // Narrar finish
      speak(finishPhrase);
    }

    setPhase('done');
    setShowEndPreview(false);
    setShowHelpModal(false);
    setShowImageHint(false);

    // Salva sessão e aguarda para garantir persistência antes de liberar a UI
    const saveSession = async () => {
      if (!supabase || !session) return;
      try {
        const finalScore = abandoned ? Math.max(0, score - penaltyApplied) : score;
        const { error } = await supabase.from('game_sessions').insert({
          player_id: session.player_id,
          score: finalScore,
          total_questions: finalTotal,
          correct_answers: corrects,
          errors,
          skips: skipsUsed,
          skips_used: skipsUsed,
          elim_used: elimUsed,
          help_ext_used: helpExtUsed,
          hints_used: hintsUsed,
          duration_secs: totalTimeRef.current,
          themes_played: themeIds,
          mode,
        });
        if (error) throw error;
        console.log('✅ Sessão salva com sucesso');
      } catch (err) {
        console.error('❌ Erro ao salvar sessão:', err);
      }
    };

    // ── GARANTIA: Batch-save de todas as perguntas respondidas nesta sessão ──
    // Isso funciona como redundância caso alguma chamada individual de markAnswered
    // tenha falhado silenciosamente por problema de rede durante o jogo.
    const batchSaveAnswered = async () => {
      if (!supabase || !session || mode !== 'solo') return;
      const ids = Array.from(answeredLocalRef.current);
      if (ids.length === 0) return;
      // Divide em chunks de 50 para evitar requisições muito grandes
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const rows = chunk.map(qId => ({ player_id: session.player_id, question_id: qId }));
        const { error } = await supabase
          .from('answered_questions')
          .upsert(rows, { onConflict: 'player_id,question_id' });
        if (error) {
          console.error('[finishGame] Erro no batch-save de answered_questions:', error);
        } else {
          console.log(`[finishGame] Batch-save OK: ${chunk.length} perguntas salvas.`);
        }
      }
    };

    // Roda os dois salvamentos em paralelo (fire-and-forget, cada um já loga o
    // próprio erro). Como a navegação daqui pra frente é só troca de rota do
    // react-router (sem reload de página), essas Promises continuam rodando
    // em segundo plano normalmente mesmo se o usuário sair da tela de resultado
    // — só seriam perdidas se a aba/app fosse fechado no meio do caminho.
    Promise.all([saveSession(), batchSaveAnswered()]).catch(() => {});
  }, [score, corrects, errors, questions.length, idx, selectedLetter, skipsUsed, elimUsed, helpExtUsed, hintsUsed, themeIds, mode, session, navigate, stopTimer, settings]);


  /* ── Avançar para próxima pergunta ───────────────────── */
  const advanceQuestion = useCallback((forceSkip = false) => {
    if (phase !== 'feedback' && !forceSkip) return; // Segurança contra chamadas indevidas

    const errorLimitReached = errors > cfg.max_errors;
    const timeoutLimitReached = cfg.end_on_timeout && timeoutsCount >= cfg.max_timeouts;
    const isLast = idx >= questions.length - 1;

    if (isLast || errorLimitReached || timeoutLimitReached) {
      finishGame();
      return;
    }

    // Interrompe o som de resposta correta/incorreta
    stopSfx(feedbackSourceRef.current);
    feedbackSourceRef.current = null;

    const volNext = (cfg.sounds?.volumes?.next ?? 100) / 100;
    const nextActive = cfg.sounds?.active?.next ?? true;
    if (nextActive) playSfx(cfg.sounds?.next, volNext);

    setSelectedLetter(null);
    setRevealCorrect(false);
    setEliminatedLetters([]);
    setShowImageHint(false);
    setFeedbackReason(null);
    setHelpsThisQuestion(0);
    setShowReviewReq(false);
    setReviewSent(false);
    setReviewMsg('');
    setIsRefExpanded(false);
    setAiConfidenceText('');
    setAiSuggestedLetter(null);
    setIsAiThinking(false);
    setPhase('question');
    setIdx(idx + 1);
  }, [idx, questions.length, finishGame, phase, errors, timeoutsCount, cfg, stopSfx, playSfx]);

  const advanceQuestionRef = useRef<any>(null);
  useEffect(() => { advanceQuestionRef.current = advanceQuestion; }, [advanceQuestion]);

  const lastJudgedIdx = useRef(-1);
  const phraseIndexRef = useRef({ correct: 0, wrong: 0, timeout: 0, skip: 0, micPrompt: 0 });

  /* ── Controle de Voz e TTS Avançado ────────────────────── */
  useEffect(() => {
    if (phase === 'feedback' && questions[idx] && lastJudgedIdx.current !== idx) {
      lastJudgedIdx.current = idx;
      const isCorrect = selectedLetter === questions[idx].correct_answer;
      let ttsDurationMs = 0;

      if (cfg.sounds?.tts_enabled && cfg.sounds?.tts_judge_answer) {
        let defaultPhrases = isCorrect 
          ? ['Parabéns, você acertou!', 'Isso aí, correto!', 'Muito bem, exato!']
          : (feedbackReason === 'timeout' 
              ? ['O tempo acabou.', 'Tempo esgotado.', 'Que pena, o tempo acabou, seja mais rápido da próxima.'] 
              : ['Que pena, incorreto.', 'Ops, você errou.', 'Não é essa a resposta.']);
          
        let phrases = defaultPhrases;
        if (voiceProfileRef.current) {
           const vp = voiceProfileRef.current;
           if (isCorrect && vp.correct_phrases?.length > 0) phrases = vp.correct_phrases;
           if (!isCorrect) {
             if (feedbackReason === 'timeout' && vp.timeout_phrases && vp.timeout_phrases.length > 0) {
               phrases = vp.timeout_phrases;
             } else if (vp.wrong_phrases && vp.wrong_phrases.length > 0) {
               phrases = vp.wrong_phrases;
             }
           }
        }

        let phrase = '';
        if (isCorrect) {
           phrase = phrases[phraseIndexRef.current.correct % phrases.length];
           phraseIndexRef.current.correct++;
        } else if (feedbackReason === 'timeout') {
           phrase = phrases[phraseIndexRef.current.timeout % phrases.length];
           phraseIndexRef.current.timeout++;
        } else {
           phrase = phrases[phraseIndexRef.current.wrong % phrases.length];
           phraseIndexRef.current.wrong++;
        }

        const isLastQuestion = idx === questions.length - 1;
        if (isLastQuestion) {
           phrase += ' Fim do jogo. Terminamos aqui essa rodada.';
        }

        speak(phrase);
        ttsDurationMs = Math.max(2500, phrase.length * 70); // Estimativa de tempo falado
      }

      const shouldPause = !isCorrect && voiceProfileRef.current?.pause_on_wrong;

      if (cfg.sounds?.tts_enabled && cfg.sounds?.tts_auto_next && !shouldPause) {
        const delayMs = (cfg.sounds?.tts_auto_next_delay || 5) * 1000;
        const autoNextTimer = setTimeout(() => {
          // Usa ref para advanceQuestion para não depender de closures e evitar loops
          if (advanceQuestionRef.current) advanceQuestionRef.current(false);
        }, delayMs + ttsDurationMs);
        return () => clearTimeout(autoNextTimer);
      }
    }
  }, [phase, cfg.sounds?.tts_judge_answer, cfg.sounds?.tts_auto_next, cfg.sounds?.tts_auto_next_delay, selectedLetter, questions, idx]);

  /* ── Tick sonoro do microfone ────────────────────────── */
  const stopMicTick = () => {
    if (micTickIntervalRef.current) {
      clearInterval(micTickIntervalRef.current);
      micTickIntervalRef.current = null;
    }
    setMicTimeLeft(null);
  };

  const startMicTick = () => {
    stopMicTick();
    setLiveTranscript('');
    const micDuration = cfg.sounds?.voice_input_timeout ?? 10;
    setMicTimeLeft(micDuration);
    const playTick = () => {
      setMicTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch(e) {}
          }
          return null;
        }
        return prev - 1;
      });
    };
    playTick();
    micTickIntervalRef.current = setInterval(playTick, 1000);
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Só ativa mic se ainda há tempo suficiente (6 segundos hardcoded — limite seguro do Chrome Speech API)
    if (timeLeft < 6) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = (finalTranscript || interimTranscript).toLowerCase().trim();
      setLiveTranscript(currentText);

      let transcript = currentText.replace(/[.,!?]/g, '').trim();
      if (!transcript) return;
      console.log('[STT Result]:', transcript);

      const executeVoiceCommand = (action: () => void) => {
        voiceMatchedRef.current = true;
        try { recognition.stop(); } catch(e) {}
        stopMicTick();
        // Aguarda 1.8s para o SO restaurar o volume normal (Audio Ducking)
        setTimeout(action, 1800);
      };

      const unavailableMsg = "Essa ajuda não está mais disponível, prossiga na tela.";

      if (transcript.includes('pular') || transcript.includes('pula')) {
         executeVoiceCommand(() => {
           const cfgNow = settings.current;
           if (!cfgNow.allow_skip || (cfgNow.max_skips !== -1 && skipsLeft <= 0)) {
             speak(unavailableMsg);
           } else {
             handleSkip();
           }
         });
         return;
      }

      if (transcript.includes('pausa') || transcript.includes('para') || transcript.includes('pausar')) {
         executeVoiceCommand(() => {
           setIsPausedManually(true);
           if (typeof window !== 'undefined' && window.speechSynthesis) cancelSpeech();
         });
         return;
      }

      if (transcript.includes('eliminar') || transcript.includes('elimina')) {
        executeVoiceCommand(() => {
          const cfgNow = settings.current;
          if (!cfgNow.allow_eliminate || elimLeft <= 0 || phase !== 'question') {
            speak(unavailableMsg);
          } else {
            handleEliminate();
          }
        });
        return;
      }

      if (transcript.includes('ajuda') || transcript.includes('ajuda externa')) {
        executeVoiceCommand(() => {
          const cfgNow = settings.current;
          if (cfgNow.allow_help_external && helpLeft > 0) {
            const volExt = (cfgNow.sounds?.volumes?.help_external ?? 100) / 100;
            const extActive = cfgNow.sounds?.active?.help_external ?? true;
            if (extActive) playSfx(cfgNow.sounds?.help_external, volExt);
            setHelpLeft(h => h - 1);
            setHelpExtUsed(u => u + 1);
            setHelpsThisQuestion(prev => prev + 1);
            setPauseTicks(cfgNow.help_external_pause || 20);
            setAiConfidenceText('');
            setAiSuggestedLetter(null);
            setIsAiThinking(false);
            setShowHelpModal(true);
          } else {
            speak(unavailableMsg);
          }
        });
        return;
      }

      if (transcript.includes('gravura') || transcript.includes('imagem') || transcript.includes('dica')) {
        executeVoiceCommand(() => {
          const cfgNow = settings.current;
          const qNow = questions[idx];
          if (cfgNow.allow_image_hint && imgHintLeft > 0 && !showImageHint && qNow?.images?.length > 0) {
            setImgHintLeft(h => h - 1);
            setHintsUsed(u => u + 1);
            setHelpsThisQuestion(prev => prev + 1);
            setShowImageHint(true);
          } else {
            speak(unavailableMsg);
          }
        });
        return;
      }

      let matchedLetter: string | null = null;
      const prefix = "(?:letra|opção|opçao|alternativa|é a|é o|é|marca a|marca|vai na)";
      if (new RegExp(`\\b${prefix}\\s+(?:a|ah)\\b|^(?:a|ah)$`, 'i').test(transcript) && shuffledOptions[0]) matchedLetter = shuffledOptions[0].id;
      else if (new RegExp(`\\b${prefix}\\s+(?:b|be|bê)\\b|^(?:b|be|bê)$`, 'i').test(transcript) && shuffledOptions[1]) matchedLetter = shuffledOptions[1].id;
      else if (new RegExp(`\\b${prefix}\\s+(?:c|ce|cé|cê|se)\\b|^(?:c|ce|cé|cê|se)$`, 'i').test(transcript) && shuffledOptions[2]) matchedLetter = shuffledOptions[2].id;
      else if (new RegExp(`\\b${prefix}\\s+(?:d|de|dê)\\b|^(?:d|de|dê)$`, 'i').test(transcript) && shuffledOptions[3]) matchedLetter = shuffledOptions[3].id;

      // Match Semântico (Tentativa de achar pelo texto da opção)
      if (!matchedLetter && transcript.length > 2) {
        const normalizeStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "").trim();
        const normTranscript = normalizeStr(transcript);
        
        if (normTranscript) {
          let bestMatchId: string | null = null;
          let bestScore = 0;

          const transWords = normTranscript.split(/\s+/).filter(w => w.length > 2);

          shuffledOptions.forEach((opt) => {
            const normOpt = normalizeStr(opt.text);
            if (!normOpt) return;

            // Match Forte: Frase inteira contida
            if (normOpt.length > 2 && (normOpt === normTranscript || normTranscript.includes(normOpt) || normOpt.includes(normTranscript))) {
              bestScore = 999;
              bestMatchId = opt.id;
            } else if (transWords.length > 0 && bestScore !== 999) {
              // Match Parcial: Contagem de palavras chave
              const optWords = normOpt.split(/\s+/).filter(w => w.length > 2);
              if (optWords.length > 0) {
                let matches = 0;
                transWords.forEach(tw => {
                  if (optWords.some(ow => ow === tw)) matches++;
                });
                
                const score = matches / optWords.length;
                if (matches > 0 && score > bestScore) {
                  bestScore = score;
                  bestMatchId = opt.id;
                }
              }
            }
          });

          if (bestScore > 0) {
             matchedLetter = bestMatchId;
          }
        }
      }

      if (matchedLetter) {
        executeVoiceCommand(() => handleSelectOption(matchedLetter!, true));
      }
    };
    recognition.onerror = (event: any) => {
      const reason = event?.error || 'unknown';
      console.warn('[STT Error]:', reason);
      if (reason === 'not-allowed' || reason === 'service-not-allowed') {
        stopMicTick();
      }
    };
    // Quando onend dispara sem resultado (silêncio no mic) ou término de uma frase
    // tentamos mais uma vez automaticamente
    let gotResult = false;
    const originalOnResult = recognition.onresult;
    recognition.onresult = (event: any) => {
      gotResult = true;
      if (originalOnResult) originalOnResult(event);
    };
    recognition.onend = () => {
      if (!gotResult) {
        console.log('[STT] Nenhum resultado capturado (silêncio ou microfone não ativou).');
      }
      
      // Se o tempo ainda não acabou, pode ser o iOS derrubando o mic precocemente ou o fim de uma frase curta.
      // Reinicia silenciosamente após um pequeno delay para evitar loop infinito na CPU.
      if (micTimeLeftRef.current && micTimeLeftRef.current > 1) {
        setTimeout(() => {
          if (micTimeLeftRef.current && micTimeLeftRef.current > 1) {
            try { recognition.start(); } catch(e) {}
          }
        }, 300);
      } else {
        stopMicTick();
      }
    };
    startMicTick();
    try { recognition.start(); } catch(e) {}
  };

  /* ── Sistema de Segunda Chance do Microfone ──────────── */
  const prevMicTimeForRetryRef = useRef<number | null>(null);
  useEffect(() => {
    const wasOpen = prevMicTimeForRetryRef.current !== null;
    const isNowClosed = micTimeLeft === null;
    prevMicTimeForRetryRef.current = micTimeLeft;

    if (wasOpen && isNowClosed) {
      // O microfone acabou de fechar.
      const cfg = settings.current;
      if (cfg.sounds?.voice_input_enabled && timeLeft > 0 && phase === 'question' && !selectedLetterRef.current && !voiceMatchedRef.current) {
        if (!secondChanceUsed) {
          setSecondChanceUsed(true);
          // Aguarda um instante para garantir que não houve processamento atrasado do STT
          setTimeout(() => {
            if (!selectedLetterRef.current && !voiceMatchedRef.current && phase === 'question' && timeLeft > 0) {
              speak('Não consegui entender. Vamos tentar novamente? Fale agora a opção escolhida.', 
                () => setIsSpeaking(true), 
                () => {
                  setIsSpeaking(false);
                  setTimeout(() => {
                    startVoiceRecognition();
                  }, 600);
                }
              );
            }
          }, 1500);
        } else {
          // Segunda chance já foi usada e o mic fechou sem resultado novamente
          setTimeout(() => {
            if (!selectedLetterRef.current && !voiceMatchedRef.current && phase === 'question' && timeLeft > 0) {
              speak('Infelizmente não consegui entender ainda. Para continuar o jogo, selecione manualmente uma resposta.',
                () => setIsSpeaking(true),
                () => setIsSpeaking(false)
              );
            }
          }, 1500);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micTimeLeft, phase, timeLeft, secondChanceUsed]);

  /* ── Resposta do jogador ─────────────────────────────── */
  const handleSelectOption = useCallback((letter: string, isVoice = false) => {
    if (phase !== 'question') return;

    const cfg = settings.current;
    
    // Vibração Curta
    if (cfg.allow_vibration) vibrate(50);

    setSelectedLetter(letter);
    setAiSuggestedLetter(null);
    setShowImageHint(false);

    if (isVoice) {
      stopTimer();

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        cancelSpeech();
        setIsSpeaking(false);
      }

      const suspenseMs = (cfg.sounds?.answer_suspense_time ?? 0) * 1000;
      
      // Toca o som de clique
      const volClick = (cfg.sounds?.volumes?.click ?? 100) / 100;
      const activeClick = cfg.sounds?.active?.click ?? true;
      if (activeClick) playSfx(cfg.sounds?.click, volClick);

      // Toca o suspense logo em seguida (com um pequeno atraso para não engolir o clique)
      if (suspenseMs > 0) {
        if (suspenseSoundTimerRef.current) clearTimeout(suspenseSoundTimerRef.current);
        suspenseSoundTimerRef.current = setTimeout(() => {
          const volSuspense = (cfg.sounds?.volumes?.suspense ?? 100) / 100;
          const activeSuspense = cfg.sounds?.active?.suspense ?? true;
          if (activeSuspense) playSfx(cfg.sounds?.suspense, volSuspense);
        }, 400);
      }

      if (suspenseSubmitTimerRef.current) clearTimeout(suspenseSubmitTimerRef.current);
      suspenseSubmitTimerRef.current = setTimeout(() => {
        if (handleSubmitAnswerRef.current) handleSubmitAnswerRef.current(letter);
      }, suspenseMs > 0 ? suspenseMs : 0);
    } else {
      const vol = (cfg.sounds?.volumes?.click ?? 100) / 100;
      const active = cfg.sounds?.active?.click ?? true;
      if (active) playSfx(cfg.sounds?.click, vol);
    }

  }, [phase, selectedLetter, playSfx, stopTimer]);

  const handleSubmitAnswer = useCallback((overrideLetter?: string | React.MouseEvent) => {
    // Cancela os delays de suspense caso o usuário clique em 'Responder' antes do tempo
    if (suspenseSoundTimerRef.current) clearTimeout(suspenseSoundTimerRef.current);
    if (suspenseSubmitTimerRef.current) clearTimeout(suspenseSubmitTimerRef.current);

    const finalLetter = typeof overrideLetter === 'string' ? overrideLetter : selectedLetter;
    if (phase !== 'question' || !finalLetter) return;

    // Para o timer, áudios correntes (como o tick/suspense) e a leitura imediatamente
    stopAllSfx();
    stopTimer();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      cancelSpeech();
      setIsSpeaking(false);
    }

    const q = questions[idx];
    if (!q) return;
    
    const cfg = settings.current;
    const isCorrect = finalLetter === q.correct_answer;

    setRevealCorrect(true);
    setPhase('feedback');

    // Salva o timestamp da resposta para criar um pequeno delay no botão "Próxima"
    (window as any)._lastAnswerTime = Date.now();

    if (isCorrect) {
      const basePoints = q.difficulty === 'facil' ? (cfg.pts_facil ?? 5) : q.difficulty === 'medio' ? (cfg.pts_medio ?? 10) : (cfg.pts_dificil ?? 22);
      const penaltyPct = cfg.pts_help_penalty_pct ?? 50;
      const actualPoints = helpsThisQuestion > 0 ? Math.round(basePoints * (1 - penaltyPct / 100)) : basePoints;
      setScore(s => s + actualPoints);
      setCorrects(c => c + 1);
      setDiffBreakdown(prev => {
        const rawDiff = (q.difficulty || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const key: 'facil' | 'medio' | 'dificil' = rawDiff.includes('facil') ? 'facil' : rawDiff.includes('dificil') ? 'dificil' : 'medio';
        return { ...prev, [key]: { correct: prev[key].correct + 1, pts: prev[key].pts + actualPoints } };
      });
      setFeedbackReason('correct');
      const vol = (cfg.sounds?.volumes?.correct ?? 100) / 100;
      const active = cfg.sounds?.active?.correct ?? true;
      if (active) feedbackSourceRef.current = playSfx(cfg.sounds.correct, vol);

      if (cfg.allow_vibration) vibrate([100, 50, 100, 50, 100]);
    } else {
      const wrongPenalty = cfg.pts_wrong_penalty ?? 3;
      setScore(s => Math.max(0, s - wrongPenalty));
      setErrors(e => e + 1);
      setFeedbackReason('wrong');
      const vol = (cfg.sounds?.volumes?.wrong ?? 100) / 100;
      const active = cfg.sounds?.active?.wrong ?? true;
      if (active) feedbackSourceRef.current = playSfx(cfg.sounds.wrong, vol);

      if (cfg.allow_vibration) vibrate(500);
    }

    const timeSpent = settings.current.timer_seconds - timeLeft;

    Promise.all([
      markAnswered(q.id),
      recordAudit(finalLetter, isCorrect, timeSpent)
    ]).catch(err => console.error('Erro ao registrar resposta:', err));

  }, [phase, selectedLetter, idx, questions, errors, stopTimer, markAnswered, playSfx, timeLeft, recordAudit, finishGame, helpsThisQuestion]);



  useEffect(() => {
    handleSubmitAnswerRef.current = handleSubmitAnswer;
  }, [handleSubmitAnswer]);

  /* ── Pular ────────────────────────────────────────────── */
  const handleSkip = useCallback(() => {
    if (!cfg.allow_skip || (cfg.max_skips !== -1 && skipsLeft <= 0)) return;
    if (cfg.max_skips !== -1) setSkipsLeft(s => s - 1);
    setSkipsUsed(s => s + 1);
    stopTimer();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      cancelSpeech();
      setIsSpeaking(false);
    }

    const volSkip = (cfg.sounds?.volumes?.help_skip ?? 100) / 100;
    const skipActive = cfg.sounds?.active?.help_skip ?? true;
    if (skipActive) playSfx(cfg.sounds?.help_skip, volSkip);

    const doSkip = () => {
      // Pergunta pulada NÃO É marcada como respondida no banco de dados
      const currentDiff = questions[idx].difficulty;
      const newQs = [...questions];
      let newExtras = [...extraQuestions];

      // Tenta achar uma reserva da mesma dificuldade
      const sameDiffIdx = newExtras.findIndex(eq => eq.difficulty === currentDiff);
      let replacementQ: Question | undefined;

      if (sameDiffIdx !== -1) {
        replacementQ = newExtras[sameDiffIdx];
        newExtras.splice(sameDiffIdx, 1);
      } else if (newExtras.length > 0) {
        replacementQ = newExtras[0];
        newExtras.splice(0, 1);
      }

      if (replacementQ) {
        newQs[idx] = replacementQ;
        setExtraQuestions(newExtras);
        setQuestions(newQs);
      } else {
        // Se não tem reserva alguma, remove a questão (rodada fica menor)
        newQs.splice(idx, 1);
        setQuestions(newQs);
        if (idx >= newQs.length) {
          finishGame(newQs.length);
          return;
        }
      }

      setSelectedLetter(null);
      setRevealCorrect(false);
      setEliminatedLetters([]);
      setShowImageHint(false);
      setFeedbackReason(null);
      setAiConfidenceText('');
      setAiSuggestedLetter(null);
      setIsAiThinking(false);
      setPhase('question');
      startTimer();
    };

    // Narrar frase de pulo se TTS ativo
    if (cfg.sounds?.tts_enabled) {
      const vp = voiceProfileRef.current;
      const skipPhrases = (vp?.skip_phrases || []).filter(s => s.trim() !== '');
      const phrase = skipPhrases.length
        ? skipPhrases[phraseIndexRef.current.skip % skipPhrases.length]
        : 'Ok, pulando pergunta!';
      phraseIndexRef.current.skip++;
      
      speak(phrase, undefined, () => doSkip());
    } else {
      doSkip();
    }
  }, [cfg, skipsLeft, questions, extraQuestions, idx, stopTimer, playSfx, finishGame, startTimer]);

  /* ── Eliminar respostas ───────────────────────────────── */
  const handleEliminate = () => {
    if (!cfg.allow_eliminate || elimLeft <= 0 || phase !== 'question') return;
    setHelpsThisQuestion(prev => prev + 1);
    setElimLeft(e => e - 1);
    setElimUsed(u => u + 1);

    // Toca som de eliminar alternativas
    const volElim = (cfg.sounds?.volumes?.help_eliminate ?? 100) / 100;
    const elimActive = cfg.sounds?.active?.help_eliminate ?? true;
    if (elimActive) playSfx(cfg.sounds?.help_eliminate, volElim);

    setShowElimAnim(true);
  };

  /* ── Render ────────────────────────────────────────────── */
  if (loading || !isPreloaded) {
    // Handler do botão "Toque para iniciar" — desbloqueia AudioContext/TTS no mobile
    const handleUserGestureStart = () => {
      // 1. Toca o som de início configurado — isso desbloqueia o AudioContext no iOS via gesto
      const gameStartUrl = cfg.sounds?.game_start;
      const gameStartVol = (cfg.sounds?.volumes?.game_start ?? 100) / 100;
      const gameStartActive = cfg.sounds?.active?.game_start ?? true;
      let soundDurationMs = 0;
      if (gameStartUrl && gameStartActive) {
        playSfx(gameStartUrl, gameStartVol, false);
        soundDurationMs = 800;
      }

      // 2. Desbloqueia SpeechSynthesis no mobile com um utterance silencioso
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }

      // 3. Dispara o countdown logo após o som (NÃO espera a permissão do microfone)
      // CRÍTICO para Android: awaitar getUserMedia ANTES do countdown bloqueia o engine de TTS
      setNeedsUserGesture(false);
      setTimeout(() => {
        if (pendingCountdownRef.current) {
          pendingCountdownRef.current();
          pendingCountdownRef.current = null;
        }
      }, Math.max(300, soundDurationMs));

      // 4. Permissão do microfone em segundo plano — sem bloquear o TTS
      if (cfg.sounds?.voice_input_enabled) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            stream.getTracks().forEach(t => t.stop());
            micPermissionGrantedRef.current = true;
          })
          .catch(() => {
            micPermissionGrantedRef.current = false;
            console.warn('[FunPlayB] Permissão de microfone negada.');
          });
      }
    };

    return (
      <div className="play-screen" style={{ justifyContent: 'center', alignItems: 'center', height: '100dvh', gap: '1.5rem', flexDirection: 'column' }}>
        {!needsUserGesture && <div className="spinner" style={{ width: '50px', height: '50px' }} />}
        <div style={{ width: '80%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 500, textAlign: 'center', margin: 0 }}>
            {!isPreloaded ? 'Carregando sons...' : loadingPhase}
          </p>
          {!needsUserGesture && (
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${loadingProgress}%`,
                height: '100%',
                backgroundColor: '#f5c842',
                transition: 'width 0.4s ease-out'
              }} />
            </div>
          )}
          {needsUserGesture && (
            <button
              onClick={handleUserGestureStart}
              style={{
                marginTop: '12px',
                padding: '14px 36px',
                fontSize: '1.1rem',
                fontWeight: 700,
                borderRadius: '50px',
                border: 'none',
                background: 'linear-gradient(135deg, #f5c842, #f0a500)',
                color: '#1a1a2e',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(245,200,66,0.4)',
                animation: 'pulseBtn 1.5s ease-in-out infinite',
              }}
            >
              ▶ Toque para Iniciar
            </button>
          )}
        </div>
      </div>
    );
  }


  if (questions.length === 0) return (
    <div className="play-screen">
      <div className="play-empty">
        <p>Nenhuma pergunta disponível para os temas selecionados.</p>
        <button className="btn-primary" onClick={() => navigate('/select-theme')}>← Voltar</button>
      </div>
    </div>
  );

  const q = questions[idx];
  const warning = timeLeft <= (cfg.warning_seconds ?? Math.ceil(cfg.timer_seconds * 0.3));
  const diffLabel: Record<string, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

  // Calcular o progresso global do tema (Restantes no banco / Total no banco)
  const currentTheme = (q as any).theme;
  const stats = themeStats[currentTheme] || { total: 0, available: 0 };
  const playedOfThisTheme = questions.slice(0, idx).filter((x: any) => x.theme === currentTheme).length;
  const currentAvailable = Math.max(0, stats.available - playedOfThisTheme);

  return (
    <div className={`play-screen ${isTvMode ? 'play-tv' : ''}`}>
      {/* ── Cabeçalho ── */}
      <div className="play-header-bar">
        <div className="play-player-info">
          <img src="/logo.png" alt="" className="play-logo-sm" />
          <div>
            <span className="play-player-name">
              {session!.nickname} {sessionNumber !== null ? `(${sessionNumber})` : ''}
            </span>
            <span className="play-theme-label">
              {currentTheme ?? ''}
              <span style={{ opacity: 0.7, marginLeft: '0.4rem', fontSize: '0.75em' }}>
                ({currentAvailable}/{stats.total})
              </span>
            </span>

          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button
            className="play-btn-mute"
            onClick={toggleMute}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isMuted ? "Ativar som" : "Desativar som"}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button className="play-btn-end" onClick={() => {
            setShowEndPreview(true);
            if (typeof window !== 'undefined' && window.speechSynthesis) cancelSpeech();
            try { recognitionRef.current?.stop(); } catch(e) {}
            stopMicTick();
          }}>⏹ Encerrar</button>
        </div>
      </div>

      {/* ── Painel de pontuação superior ── */}
      <div className="play-score-bar">
        <div className="play-score-item">
          <span className="play-score-val">{corrects}</span>
          <span className="play-score-lbl">✓ Acertos</span>
        </div>
        <div className="play-score-item">
          <span className="play-score-val play-score-errors">{errors}/{cfg.max_errors}</span>
          <span className="play-score-lbl">✗ Erros</span>
        </div>
        <div className="play-score-item">
          <span className="play-score-val">{idx + 1}/{questions.length}</span>
          <span className="play-score-lbl">Pergunta</span>
        </div>
        <div className="play-score-item">
          <span className="play-score-val">
            {`${Math.floor(elapsedSecs / 60).toString().padStart(2, '0')}:${(elapsedSecs % 60).toString().padStart(2, '0')}`}
          </span>
          <span className="play-score-lbl">⏱ Tempo</span>
        </div>
      </div>

      <ProgressBar current={idx + 1} total={questions.length} />

      {/* ── Dashboard Central: Placar | Cronômetro | Emojis ── */}
      <div className="play-dashboard">
        <div className="play-dashboard-side">
          <div className="play-dashboard-score">
            <span className="play-dashboard-score-val">{score}</span>
            <span className="play-dashboard-score-lbl">PTS</span>
          </div>
        </div>

        <div className="play-dashboard-center" style={{ position: 'relative' }}>
          <AnimClock seconds={timeLeft} total={cfg.timer_seconds} warning={warning} />
        </div>

        <div className="play-dashboard-side">
          {cfg.avatar_mode === 'svg' ? (
            <AvatarAnimated
              mood={
                phase === 'question'
                  ? (timeLeft <= 5 ? 'medo' : warning ? 'preocupado' : 'pensativo')
                  : phase === 'feedback'
                    ? (feedbackReason === 'timeout' ? 'triste'
                      : selectedLetter === q.correct_answer ? 'feliz' : 'errou')
                    : 'feliz'
              }
              skin={cfg.avatar_skin ?? 'media'}
              style={cfg.avatar_style ?? 1}
              glasses={cfg.avatar_glasses ?? 0}
              beard={cfg.avatar_beard ?? 0}
              eyeColor={cfg.avatar_eye_color ?? '#1C0D00'}
              hairColor={cfg.avatar_hair_color ?? 'preto'}
              size={72}
            />
          ) : (
            <EmoticonAnimated
              mood={
                phase === 'question'
                  ? (warning ? 'preocupado' : 'pensativo')
                  : phase === 'feedback'
                    ? (selectedLetter === q.correct_answer ? 'feliz' : 'errou')
                    : 'feliz'
              }
            />
          )}
        </div>
      </div>

      {/* ── Dificuldade + Pergunta ── */}
      <div
        className="play-question-card"
        style={{
          background:
            q.difficulty === 'facil' ? '#e5aafdff' :
              q.difficulty === 'dificil' ? '#ff8b8bff' :
                '#fcfaa8ff',
          position: 'relative',
          marginTop: '-16px' // Reduz o vão livre acima do card da pergunta, igualando os espaçamentos
        }}
      >

        <span className="play-diff-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ flex: 1, textAlign: 'center' }}>
            {q.question_number ? `Pergunta #${q.question_number}` : `#${idx + 1}`}
            {' — '}{diffLabel[q.difficulty] ?? q.difficulty}
            {(() => {
              const basePts = q.difficulty === 'facil' ? (cfg.pts_facil ?? 5) : q.difficulty === 'medio' ? (cfg.pts_medio ?? 10) : (cfg.pts_dificil ?? 22);
              const penaltyPct = cfg.pts_help_penalty_pct ?? 50;
              const adjustedPts = helpsThisQuestion > 0 ? Math.round(basePts * (1 - penaltyPct / 100)) : basePts;
              return helpsThisQuestion > 0
                ? ` — Valendo ${adjustedPts} pts ⚠️(-${penaltyPct}%)`
                : ` — Valendo ${basePts} pontos`;
            })()}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Botão de leitura automática */}
            <button
              className={`play-btn-speak ${autoRead ? 'is-speaking' : ''}`}
              onClick={() => {
                const next = !autoRead;
                setAutoRead(next);
                if (!next && window.speechSynthesis) {
                  cancelSpeech();
                  setIsSpeaking(false);
                }
              }}
              title={autoRead ? 'Desativar leitura automática' : 'Ativar leitura automática de todas as perguntas'}
              style={{ width: 'auto', borderRadius: '14px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 700 }}
            >
              {autoRead ? '🔊 Auto' : '🔇 Auto'}
            </button>

            {/* Botão de leitura da pergunta atual */}
            <button
              className={`play-btn-speak ${isSpeaking ? 'is-speaking' : ''}`}
              onClick={() => {
                if (isSpeaking) {
                  cancelSpeech();
                  setIsSpeaking(false);
                } else {
                  const optionsText = shuffledOptions.map((o, i) => `Opção ${LETTERS[i].toUpperCase()}: ${o.text}`).join('. ');
                  const isLastQuestion = idx === questions.length - 1;
                  const introText = isLastQuestion 
                    ? `Vamos para a ${idx + 1}ª e última pergunta! ${q.statement}`
                    : `${idx + 1}ª pergunta: ${q.statement}`;
                  speak(
                    `${introText}. ${optionsText}`,
                    () => setIsSpeaking(true),
                    () => {
                      setIsSpeaking(false);
                      if (cfg.sounds?.voice_input_enabled && cfg.sounds?.tts_enabled) {
                        setTimeout(() => {
                           const vp = voiceProfileRef.current;
                           let prompt = 'Pode responder';
                           if (vp?.mic_prompts?.length) {
                             prompt = vp.mic_prompts[phraseIndexRef.current.micPrompt % vp.mic_prompts.length];
                             phraseIndexRef.current.micPrompt++;
                           } else if (vp?.mic_prompt) {
                             prompt = vp.mic_prompt;
                           }
                           speak(prompt, undefined, () => {
                             setTimeout(() => {
                               startVoiceRecognition();
                             }, 600);
                           });
                        }, 500);
                      }
                    }
                  );
                }
              }}
              title={isSpeaking ? 'Parar leitura' : 'Ouvir esta pergunta'}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isSpeaking ? '⏹' : '🔊'}
            </button>
          </div>
        </span>

        <ResponsiveText text={q.statement} className="play-statement" />

        {/* ── Rodapé do Card (Origem e Revisão) ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '12px',
          width: '100%'
        }}>
          {/* Origem da pergunta */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.05)',
            fontSize: '0.65rem',
            color: 'rgba(0,0,0,0.6)',
          }}>
            {(q as any).is_native
              ? <><span>🛡️</span><strong>Nativa do jogo</strong></>
              : <><span>👤</span><span>De: <strong>{(q as any).creator?.nickname ?? 'Usuário'}</strong></span></>
            }
          </div>

          {/* Indicador discreto de revisão */}
          <div style={{
            fontSize: '0.6rem',
            padding: '2px 6px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.4)',
            color: q.reviewed ? '#166534' : '#991b1b',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            border: q.reviewed ? '1px solid rgba(22,101,52,0.3)' : '1px solid rgba(153,27,27,0.3)'
          }}>
            {q.reviewed ? 'Rev. ✅' : 'Rev. ❌'}
          </div>
        </div>
      </div>

      {/* ── Opções ── */}
      <div className="play-options">
        {shuffledOptions.map((opt, i) => {
          const displayLetter = LETTERS[i]; // A, B, C, D visualmente
          const realLetter = opt.id;        // a, b, c, d real no BD
          const text = opt.text;
          const isElim = eliminatedLetters.includes(realLetter);
          const isSelected = selectedLetter === realLetter;
          const isCorrect = revealCorrect && realLetter === q.correct_answer;
          const isWrong = revealCorrect && isSelected && realLetter !== q.correct_answer;

          return (
            <button
              key={displayLetter}
              className={`play-option
                ${isElim ? 'play-option-elim' : ''}
                ${isCorrect ? 'play-option-correct' : ''}
                ${isWrong ? 'play-option-wrong' : ''}
                ${isSelected && !isWrong && !isCorrect ? 'play-option-selected' : ''}
              `}
              onClick={() => !isElim && handleSelectOption(realLetter)}
              disabled={isElim || phase !== 'question'}
            >
              <span className="play-option-letter">{displayLetter.toUpperCase()}</span>
              <span className="play-option-text">{text}</span>
            </button>
          );
        })}
      </div>

      {/* ── Botão Responder / Próxima ── */}
      <div className="play-submit-container" style={{ paddingBottom: '0px', marginBottom: '6px', marginTop: '4px' }}>
        {phase === 'question' ? (
          <button
            className="play-submit-btn"
            onClick={handleSubmitAnswer}
            disabled={!selectedLetter}
          >
            Responder
          </button>
        ) : (
          <div className="play-feedback-area">
            {q.reference && (
              <div
                className="play-reference-card"
                onClick={() => setIsRefExpanded(!isRefExpanded)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: '#faf5d080', // Amarelo claro com 85% de transparência (ajuste os 2 últimos dígitos para mudar a opacidade)
                  border: '1.5px solid #eab308',
                  borderRadius: '12px',
                  padding: isRefExpanded ? '8px 12px' : '4px 12px', // 👈 AQUI: Afina o card quando recolhido (5px) e dá mais espaço quando expandido (8px)
                  marginTop: '-5px', // Coladinho com a última opção de resposta
                  marginBottom: '4px', // Coladinho com o botão abaixo
                  textAlign: 'left',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#854d0e', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      📖 Fonte:
                    </span>
                    {!isRefExpanded && (
                      <span style={{
                        fontSize: '0.85rem',
                        color: '#451a03',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        lineHeight: '1.4',
                        marginLeft: '4px'
                      }}>
                        {q.reference}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#854d0e', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
                      {isRefExpanded ? '▲ recolher' : '▼ expandir'}
                    </span>
                  </div>

                  {isRefExpanded && (
                    <p style={{
                      margin: '6px 0 0 0',
                      fontSize: '0.88rem',
                      lineHeight: '1.45',
                      color: '#451a03',
                      textAlign: 'justify', // Justificado em todo o perímetro do card
                      width: '100%'
                    }}>
                      {q.reference}
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              className={`play-next-btn ${feedbackReason === 'correct' ? 'play-btn-correct' : 'play-btn-wrong'}`}
              onClick={() => {
                const now = Date.now();
                const last = (window as any)._lastAnswerTime || 0;
                if (now - last > 400) {
                  advanceQuestion();
                }
              }}
            >
              {(() => {
                const isLast = idx >= questions.length - 1;
                const errorLimitReached = errors > cfg.max_errors;
                const timeoutLimitReached = cfg.end_on_timeout && timeoutsCount >= cfg.max_timeouts;
                const shouldEnd = isLast || errorLimitReached || timeoutLimitReached;

                let prefix = 'Próxima pergunta';
                if (feedbackReason === 'correct') prefix = 'Parabéns, você acertou!';
                if (feedbackReason === 'wrong') prefix = 'Que pena, você errou';
                if (feedbackReason === 'timeout') prefix = 'Tempo esgotado';

                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    {prefix} — {shouldEnd ? 'Ver Resultado' : 'Continuar'}
                    {!shouldEnd && (
                      <ChevronsRight
                        size={32}
                        color="#f5c842"
                        strokeWidth={3.5}
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                      />
                    )}
                  </span>
                );
              })()}
            </button>

            {/* ── Botões de revisão: admin marca / todos podem solicitar ── */}
            <div style={{ textAlign: 'center', marginTop: '6px', display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>

              {/* Botão ADMIN: Marcar como revisada (some quando já está revisada) */}
              {session?.category === 'admin' && !q.reviewed && (
                <button
                  onClick={async () => {
                    if (!supabase) return;
                    const newVal = true;
                    const { error } = await supabase
                      .from('questions')
                      .update({ reviewed: newVal })
                      .eq('id', q.id);
                    if (!error) {
                      setQuestions(prev => prev.map(pq =>
                        pq.id === q.id ? { ...pq, reviewed: newVal } : pq
                      ));
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: 'rgba(255,255,255,0.7)',
                    borderRadius: '20px',
                    padding: '4px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s'
                  }}
                  title="Marcar esta pergunta como revisada"
                >
                  ☑️ Marcar como revisada
                </button>
              )}

              {/* Botão TODOS: Solicitar revisão (permanente até ser enviada) */}
              {!reviewSent && !reviewedQIds.has(q.id) && (
                !showReviewReq ? (
                  <button
                    className="btn-review-request"
                    onClick={() => setShowReviewReq(true)}
                    title="Solicitar revisão desta pergunta"
                  >
                    🚩 Solicitar revisão
                  </button>
                ) : (
                  <div className="review-request-box">
                    <p className="review-request-title">Solicitar revisão da pergunta</p>
                    <textarea
                      className="review-request-textarea"
                      placeholder="Motivo (opcional)..."
                      maxLength={300}
                      value={reviewMsg}
                      onChange={e => setReviewMsg(e.target.value)}
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-review-cancel"
                        onClick={() => { setShowReviewReq(false); setReviewMsg(''); }}
                      >Cancelar</button>
                      <button
                        className="btn-review-send"
                        onClick={async () => {
                          if (!supabase || !session) return;
                          let success = false;
                          try {
                            const sendReq = async () => {
                              return await supabase!.from('question_review_requests').insert({
                                question_id: q.id,
                                player_id: session.player_id,
                                message: reviewMsg.trim() || null,
                              });
                            };

                            // Primeira tentativa
                            let res = await sendReq();

                            // Se falhar no iOS com "Load failed", tenta mais uma vez após um breve delay
                            if (res.error && (res.error.message?.includes('Load failed') || res.error.message?.includes('fetch'))) {
                              await new Promise(resolve => setTimeout(resolve, 600));
                              res = await sendReq();
                            }

                            if (res.error) throw res.error;
                            success = true;
                          } catch (err: any) {
                            console.error('Erro ao enviar solicitação de revisão:', err);
                            const msg = err.message || String(err);
                            if (msg.includes('Load failed')) {
                              alert('Erro de conexão no iOS. Por favor, verifique sua internet ou tente novamente em instantes.');
                            } else {
                              alert('Erro ao enviar: ' + msg);
                            }
                            return;
                          }

                          if (success) {
                            setReviewSent(true);
                            setReviewedQIds(prev => new Set(prev).add(q.id));
                            setShowReviewReq(false);
                            setReviewMsg('');
                          }
                        }}
                      >Enviar</button>
                    </div>
                  </div>
                )
              )}
              {(reviewSent || reviewedQIds.has(q.id)) && (
                <p className="review-sent-msg">✅ Solicitação enviada!</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Animação de eliminação ── */}
      {showElimAnim && (
        <EliminationAnimation
          options={shuffledOptions.map(o => ({ letter: o.id, text: o.text }))}
          correct={q.correct_answer}
          onEliminated={letters => setEliminatedLetters(letters)}
          onDone={() => setShowElimAnim(false)}
          cfg={settings.current}
          playSfx={playSfx}
          stopSfx={stopSfx}
        />
      )}

      {/* ── Controles de ajuda ── */}
      {phase === 'question' && (() => {
        const activeCount = [
          cfg.allow_skip,
          cfg.allow_eliminate,
          cfg.allow_help_external,
          cfg.allow_image_hint && q.images?.length > 0
        ].filter(Boolean).length;

        return (
          <div className={`play-controls play-controls-${activeCount}`}>
            {cfg.allow_skip && (
              <button
                className={`play-ctrl-btn ${skipsLeft === 0 && cfg.max_skips !== -1 ? 'play-ctrl-disabled' : ''}`}
                onClick={handleSkip}
                disabled={skipsLeft === 0 && cfg.max_skips !== -1}
              >
                ⏭ Pular
                {cfg.max_skips !== -1 && <span className="play-ctrl-count">{skipsLeft}</span>}
              </button>
            )}

            {cfg.allow_eliminate && (
              <button
                className={`play-ctrl-btn ${elimLeft === 0 ? 'play-ctrl-disabled' : ''}`}
                onClick={handleEliminate}
                disabled={elimLeft === 0}
              >
                ✖ Elim.
                <span className="play-ctrl-count">{elimLeft}</span>
              </button>
            )}

            {cfg.allow_help_external && (
              <button
                className={`play-ctrl-btn ${helpLeft === 0 ? 'play-ctrl-disabled' : ''}`}
                onClick={() => {
                  if (helpLeft > 0) {
                    // Toca som de ajuda externa
                    const volExt = (cfg.sounds?.volumes?.help_external ?? 100) / 100;
                    const extActive = cfg.sounds?.active?.help_external ?? true;
                    if (extActive) playSfx(cfg.sounds?.help_external, volExt);

                    setHelpLeft(h => h - 1);
                    setHelpExtUsed(u => u + 1);
                    setHelpsThisQuestion(prev => prev + 1);
                    setPauseTicks(cfg.help_external_pause || 20);
                    setAiConfidenceText('');
                    setAiSuggestedLetter(null);
                    setIsAiThinking(false);
                    setShowHelpModal(true);
                  }
                }}
                disabled={helpLeft === 0}
              >
                🙋 Ajuda
                <span className="play-ctrl-count">{helpLeft}</span>
              </button>
            )}

            {cfg.allow_image_hint && q.images?.length > 0 && (
              <button
                className={`play-ctrl-btn ${imgHintLeft === 0 ? 'play-ctrl-disabled' : ''}`}
                onClick={() => { if (imgHintLeft > 0) { setImgHintLeft(h => h - 1); setHintsUsed(u => u + 1); setHelpsThisQuestion(prev => prev + 1); setShowImageHint(true); } }}
                disabled={imgHintLeft === 0 || showImageHint}
              >
                🖼 Gravura
                <span className="play-ctrl-count">{imgHintLeft}</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Modal de Gravura (Pop-up independente) ── */}
      {showImageHint && q && q.images?.length > 0 && phase !== 'done' && (
        <div className="image-hint-overlay">
          <div className="image-hint-box">
            <button className="image-hint-close" onClick={() => setShowImageHint(false)}>✕</button>
            <div style={{ position: 'absolute', color: 'rgba(255,255,255,0.5)', zIndex: 0, fontSize: '0.9rem', fontWeight: 600 }}>Carregando imagem...</div>
            {q.images.slice(0, 2).map((url, i) => (
              <img key={i} src={url} alt="Gravura" className="image-hint-modal-img" style={{ position: 'relative', zIndex: 1 }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: ajuda externa ── */}
      {showHelpModal && phase !== 'done' && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: '92%', maxWidth: '350px', padding: '12px 16px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.2rem', marginBottom: '6px' }}>🙋 Ajuda externa</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.3, marginBottom: '0.5rem', fontSize: '0.82rem' }}>
              Você pode pesquisar a pergunta atual na internet ou consultar nossa IA!
            </p>

            <div style={{ background: 'rgba(245, 197, 66, 0.1)', border: '1px dashed #f5c842', padding: '6px 8px', borderRadius: '6px', marginBottom: '0.6rem', textAlign: 'center' }}>
              <p style={{ color: '#f5c842', fontSize: '0.76rem', margin: 0, fontWeight: '500', lineHeight: 1.3 }}>
                ⚠️ Atenção: Tanto a ajuda da IA quanto as buscas no Google são apenas sugestões e não garantem que a resposta esteja correta!
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.6rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  if (q) {
                    const query = `${q.statement} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d}`;
                    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
                    if (isMobile) {
                      window.open(url, '_blank');
                    } else {
                      const width = 600;
                      const height = 650;
                      const left = window.screenX + (window.outerWidth - width) / 2;
                      const top = window.screenY + (window.outerHeight - height) / 2;
                      window.open(
                        url,
                        'GoogleSearchPopup',
                        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                      );
                    }
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.88rem' }}
              >
                🔍 Pesquisar no Google
              </button>
              
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (!isAiThinking && !aiConfidenceText && q) {
                    setIsAiThinking(true);
                    setTimeout(() => {
                      setIsAiThinking(false);
                      
                      // Carrega e incrementa a contagem de acessos à IA no localStorage
                      const currentCount = parseInt(localStorage.getItem('funplayb_ai_help_count') || '0', 10);
                      const newCount = currentCount + 1;
                      localStorage.setItem('funplayb_ai_help_count', newCount.toString());
                      
                      // Lógica de determinação de acerto por macro-ciclo de 12 (4 grupos de 3)
                      const macroIndex = (newCount - 1) % 12;
                      let isCorrect = true;
                      
                      if (macroIndex === 5) {
                        // 2º ciclo, 3ª vez (chamada 6) -> ERRO (chuta)
                        isCorrect = false;
                      } else if (macroIndex === 7) {
                        // 3º ciclo, 2ª vez (chamada 8) -> ERRO (chuta)
                        isCorrect = false;
                      } else if (macroIndex === 9) {
                        // 4º ciclo, 1ª vez (chamada 10) -> ERRO (chuta)
                        isCorrect = false;
                      }
                      
                      const diff = q.difficulty || 'facil';
                      let chosenLetter = q.correct_answer;
                      let confidenceText = '';
                      
                      const allOptions = ['a', 'b', 'c', 'd'];
                      const availableOptions = allOptions.filter(o => 
                        !eliminatedLetters.includes(o) &&
                        q[`option_${o}` as 'option_a']
                      );

                      if (!isCorrect) {
                        // Escolhe uma alternativa totalmente aleatória e chuta (pode ser a certa!)
                        if (availableOptions.length > 0) {
                          const randIdx = Math.floor(Math.random() * availableOptions.length);
                          chosenLetter = availableOptions[randIdx] as 'a' | 'b' | 'c' | 'd';
                        }
                      }
                      
                      // Encontra a letra visual correspondente a partir das opções embaralhadas (shuffledOptions)
                      const shuffledIndex = shuffledOptions.findIndex(o => o.id === chosenLetter);
                      const visualLetter = shuffledIndex !== -1 ? LETTERS[shuffledIndex] : chosenLetter;
                      const displayLetterUpper = visualLetter.toUpperCase();

                      // Gera texto de confiança com base na dificuldade
                      if (diff === 'facil') {
                        confidenceText = `Tenho 95% de certeza que é a Alternativa ${displayLetterUpper}`;
                      } else if (diff === 'medio') {
                        confidenceText = `Acho que é a Alternativa ${displayLetterUpper} (80% de certeza)`;
                      } else {
                        // Difícil
                        confidenceText = `Fiquei em dúvida, mas acho que é a Alternativa ${displayLetterUpper} (60% de certeza)`;
                      }
                      
                      setAiSuggestedLetter(chosenLetter);
                      setAiConfidenceText(confidenceText);
                    }, 2000);
                  }
                }}
                disabled={isAiThinking || !!aiConfidenceText}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.88rem' }}
              >
                🤖 {isAiThinking ? 'Consultando IA...' : aiConfidenceText ? 'IA Consultada!' : 'Consultar Inteligência Artificial'}
              </button>
            </div>

            {aiConfidenceText && (
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 10px', borderRadius: '8px', border: aiConfidenceText.includes('60%') ? '1px solid #f5c842' : '1px solid #4ade80', marginBottom: '0.6rem', textAlign: 'center' }}>
                <p style={{ color: aiConfidenceText.includes('60%') ? '#f5c842' : '#4ade80', margin: 0, fontWeight: 'bold', fontSize: '0.82rem' }}>A Inteligência Artificial sugere:</p>
                <p style={{ fontSize: '0.92rem', color: '#fff', margin: '4px 0 0 0', fontStyle: 'italic', lineHeight: 1.3 }}>"{aiConfidenceText}"</p>
              </div>
            )}

            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
              <strong style={{ color: '#f5c842', display: 'block', marginBottom: '8px', fontSize: '0.82rem' }}>
                ⏳ Fechando em {pauseTicks} segundo{pauseTicks !== 1 ? 's' : ''}...
              </strong>
              <button className="btn-secondary" onClick={() => setShowHelpModal(false)} style={{ padding: '6px 14px', fontSize: '0.88rem' }}>Voltar para o Jogo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Abandono ── */}
      {showEndPreview && phase !== 'done' && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ textAlign: 'center', padding: '24px', maxWidth: '340px' }}>
            <h3 className="modal-title" style={{ color: '#ff6b6b', fontSize: '1.4rem' }}>⚠️ Abandonar Partida?</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: '15px' }}>
              Tem certeza que deseja encerrar agora? A partida será considerada perdida por abandono.
            </p>

            {phase === 'question' && (
              <p style={{ color: '#f5c842', fontWeight: 800, marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                ⏳ O tempo continua correndo!
              </p>
            )}

            {(() => {
              const wrongPenalty = settings.current.pts_wrong_penalty ?? 3;
              const questionsAnswered = idx + (selectedLetter ? 1 : 0);
              const questionsRemaining = Math.max(0, questions.length - questionsAnswered);
              const penaltyApplied = wrongPenalty * questionsRemaining;

              return (
                <div style={{ background: 'rgba(255,107,107,0.15)', padding: '12px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,107,107,0.4)' }}>
                  <p style={{ margin: 0, color: '#ff6b6b', fontSize: '0.95rem', fontWeight: 600 }}>
                    Penalidade estimada: <br />
                    <strong style={{ fontSize: '1.5rem' }}>-{penaltyApplied} pontos</strong>
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
                    (Sua pontuação final não ficará negativa)
                  </p>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" style={{ flex: 1, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => {
                setShowEndPreview(false);
                if (phase === 'question' && settings.current.sounds?.voice_input_enabled && timeLeft > 0) {
                  startVoiceRecognition();
                }
              }}>
                Voltar
              </button>
              <button className="btn-primary" style={{ flex: 1, background: '#ff4757', color: '#fff', border: 'none' }} onClick={() => finishGame(undefined, true)}>
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup de Contagem do Microfone ── */}
      {micTimeLeft !== null && (
        <div className="mic-countdown-overlay" style={{ pointerEvents: 'none' }}>
          <div className="mic-countdown-circle" style={{ marginBottom: '20px' }}>
            <svg viewBox="0 0 100 100" className="mic-countdown-svg">
               <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="none" />
               <circle cx="50" cy="50" r="45" stroke="#f5c842" strokeWidth="10" fill="none" 
                  strokeDasharray="283" strokeDashoffset={283 - (283 * micTimeLeft) / (settings.current.sounds?.voice_input_timeout ?? 10)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
               />
            </svg>
            <div className="mic-countdown-text">{micTimeLeft}</div>
            <div className="mic-countdown-icon">🎤 Ouvindo...</div>
          </div>
        </div>
      )}
      {/* ── Overlay do Transcript Persistente ── */}
      {persistentTranscript && (
        <div style={{
          position: 'fixed',
          top: '35vh', // Posicionado abaixo do círculo centralizado
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1001
        }}>
          <div style={{ 
            maxWidth: '90%', 
            background: 'rgba(0,0,0,0.6)', 
            padding: '16px 24px', 
            borderRadius: '16px', 
            color: '#f5c842', 
            fontSize: '1.6rem', 
            fontWeight: 800,
            textAlign: 'center', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '2px solid rgba(245,200,66,0.4)',
            backdropFilter: 'blur(8px)'
          }}>
            "{persistentTranscript}"
          </div>
        </div>
      )}

      {/* ── Overlay de Resultado Final ── */}
      {phase === 'done' && (
        <ResultOverlay
          score={score}
          corrects={corrects}
          errors={errors}
          total={questions.length}
          duration={totalTimeRef.current}
          helps={{
            skips: skipsUsed,
            eliminations: elimUsed,
            external: helpExtUsed,
            images: hintsUsed
          }}
          settings={settings.current}
          diffBreakdown={diffBreakdown}
          abandoned={abandonedPenalty > 0}
          abandonedPenalty={abandonedPenalty}
          onClose={() => navigate('/', { replace: true })}
          onRestart={() => navigate('/select-theme', { replace: true })}
          onRanking={() => navigate('/ranking', { replace: true })}
          onSettings={() => navigate('/settings', { replace: true })}
        />
      )}

      {/* Rodapé */}
      <p className="play-footer">FunPlayB v{VERSION_CONFIG.version}</p>

      {/* Modal de Pausa */}
      {isPausedManually && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '5rem', marginBottom: '20px' }}>⏸️</div>
          <h1 style={{ color: '#fff', fontSize: '2.5rem', margin: 0 }}>JOGO PAUSADO</h1>
          <p style={{ color: '#ccc', marginBottom: '40px' }}>O tempo e as perguntas foram suspensas por comando de voz.</p>
          <button 
            className="btn-action" 
            style={{ fontSize: '1.2rem', padding: '15px 40px', backgroundColor: '#4caf50', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => {
              setIsPausedManually(false);
              // Restart tick sound se necessário
              if (tickSourceRef.current && tickSourceRef.current.playbackRate) {
                tickSourceRef.current.playbackRate.value = 1;
              }
            }}
          >
            ▶️ Continuar Jogando
          </button>
        </div>
      )}

      {/* Fim dos controles */}
    </div>
  );
}


