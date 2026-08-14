import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AvatarAnimated } from '@/components/AvatarAnimated';
import { EmoticonAnimated } from '@/components/EmoticonAnimated';
interface ResultState {
  score: number;
  corrects: number;
  errors: number;
  total: number;
  duration: number;
  mode: string;
  helps?: {
    skips: number;
    eliminations: number;
    external: number;
    images: number;
  };
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioVol, setAudioVol] = useState(1);
  const [settings, setSettings] = useState<any>(null);

  const state = location.state as ResultState | null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('funplayb_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings(parsed);
        const url = parsed.sounds?.result;
        const vol = (parsed.sounds?.volumes?.result ?? 100) / 100;
        const active = parsed.sounds?.active?.result ?? true;
        if (url && active) {
          setAudioUrl(url);
          setAudioVol(vol);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.volume = audioVol;
      audioRef.current.play().catch(e => console.warn('Autoplay blocked:', e));
    }
  }, [audioUrl, audioVol]);

  const stopAudioAndNavigate = (path: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    navigate(path, { replace: true });
  };
  if (!state) {
    navigate('/', { replace: true });
    return null;
  }

  const { score, corrects, errors, total, duration, mode, helps } = state;
  const pct = total > 0 ? Math.round((corrects / total) * 100) : 0;
  const msg = pct === 100 ? 'Você foi fantástico! Gabaritou o jogo!' : pct >= 80 ? 'Excelente!' : pct >= 60 ? 'Muito bem!' : pct >= 40 ? 'Pode melhorar!' : 'Continue treinando!';

  const totalHelps = helps ? (helps.skips + helps.eliminations + helps.external + helps.images) : 0;

  return (
    <div className="result-screen">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
      <div className="result-card">
        <div className="result-header-row">
          <img 
            src="/logo.png" 
            alt="FunPlayB" 
            className="result-logo-mini" 
            onClick={() => stopAudioAndNavigate('/about')}
            style={{ cursor: 'pointer' }}
            title="Sobre / Ajuda"
          />
          {settings?.avatar_mode === 'svg' ? (
            <div style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            </div>
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
            <span className="result-stat-lbl">Aproveit.</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{formatTime(duration)}</span>
            <span className="result-stat-lbl">Tempo</span>
          </div>
        </div>

        {helps && totalHelps > 0 && (
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

        <div className="result-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <button
            className="btn-primary"
            onClick={() => stopAudioAndNavigate(`/select-theme?mode=${mode}`)}
          >
            🔄 Jogar novamente
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => stopAudioAndNavigate('/ranking')} style={{ flex: 1 }}>
              🏆 Ver Ranking
            </button>
            <button className="btn-secondary" onClick={() => stopAudioAndNavigate('/')} style={{ flex: 1 }}>
              🏠 Início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
