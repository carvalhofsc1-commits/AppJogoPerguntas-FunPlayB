// AvatarAnimated.tsx — Avatar SVG animado de alta qualidade para o FunPlayB
import { useState, useEffect } from 'react';

export type AvatarMood = 'confiante' | 'pensativo' | 'preocupado' | 'feliz' | 'surpreso' | 'errou' | 'triste' | 'medo';
export type AvatarSkin = 'clara' | 'media' | 'morena' | 'escura';
export type AvatarStyle = 0 | 1 | 2 | 3 | 4 | 5;

const SKIN: Record<AvatarSkin, { face: string; shadow: string; hair: string; hairAlt: string }> = {
  clara: { face: '#FDDBB4', shadow: '#E8B88A', hair: '#7B3F00', hairAlt: '#5C2C00' },
  media: { face: '#F0A96B', shadow: '#C87840', hair: '#3B2106', hairAlt: '#1E0E00' },
  morena: { face: '#C8784A', shadow: '#A05030', hair: '#1C0D00', hairAlt: '#0A0500' },
  escura: { face: '#7B4A2D', shadow: '#5A3018', hair: '#080200', hairAlt: '#000000' },
};

const HAIR_COLORS: Record<string, { hair: string; hairAlt: string }> = {
  preto: { hair: '#1E1E1E', hairAlt: '#0A0A0A' },
  castanho: { hair: '#4A2E1B', hairAlt: '#2A1A0F' },
  loiro: { hair: '#F2C94C', hairAlt: '#D4A32A' },
  ruivo: { hair: '#C44900', hairAlt: '#8C3300' },
  grisalho: { hair: '#B0B0B0', hairAlt: '#8A8A8A' }
};

interface MoodConfig {
  eyeRy: number;         // abertura vertical
  eyeOfsY: number;       // deslocamento vertical
  eyeOfsX?: number;      // olhar p/ os lados
  browLift: number;      // levantamento das sobrancelhas
  browAngle: number;     // inclinação
  mouthD: string;        // SVG path ou ID
  cheek: number;         // blush
  showTears: boolean;
  showSweat: boolean;
  showHand: 'none' | 'chin' | 'peek' | 'facepalm' | 'scratch';
  showStars: boolean;
  showQuestion?: boolean;
  animClass: string;
}

// Helpers para bocas
const MOUTH = {
  neutral: 'neutral',
  smileSm: 'smileSm',
  smileBg: 'smileBg', // Sorriso aberto grande
  smileTh: 'smileTh', // Sorriso com dentes
  sad: 'sad',
  sadBg: 'sadBg',
  openO: 'openO',
  openU: 'openU',
  think: 'think',
  nervous: 'nervous',
};

// Configuração padrão
const base: MoodConfig = {
  eyeRy: 6, eyeOfsY: 0, eyeOfsX: 0, browLift: 0, browAngle: 0, mouthD: MOUTH.neutral,
  cheek: 0, showTears: false, showSweat: false, showHand: 'none', showStars: false, showQuestion: false, animClass: ''
};

// Sequências de 10 frames para cada humor! O Avatar é vivo!
const MOOD_SEQUENCES: Record<AvatarMood, MoodConfig[]> = {
  confiante: [
    { ...base, mouthD: MOUTH.smileSm, cheek: 0.2, animClass: 'av-idle' },
    { ...base, mouthD: MOUTH.smileSm, cheek: 0.2, eyeRy: 0, animClass: 'av-idle' }, // pisca
    { ...base, mouthD: MOUTH.smileSm, cheek: 0.2, animClass: 'av-idle' },
    { ...base, mouthD: MOUTH.neutral, cheek: 0.1, animClass: 'av-idle' },
  ],
  pensativo: [
    // 10 mudanças de expressão: alterna entre olhar pro lado/queixo e coçar a cabeça!
    { ...base, eyeOfsY: -2, eyeOfsX: -3, browLift: 2, browAngle: 1, mouthD: MOUTH.think, showHand: 'chin', animClass: 'av-thinking' },
    { ...base, eyeOfsY: -3, eyeOfsX: -4, browLift: 3, browAngle: 2, mouthD: MOUTH.openO, showHand: 'chin', animClass: 'av-thinking' },
    { ...base, eyeOfsY: -1, eyeOfsX: 0, browLift: 0, browAngle: 0, mouthD: MOUTH.think, showHand: 'chin', animClass: 'av-thinking' },
    // Aqui sobe a mão para coçar a cabeça
    { ...base, eyeOfsY: -2, eyeOfsX: 2, browLift: 4, browAngle: -1, mouthD: MOUTH.think, showHand: 'scratch', animClass: 'av-thinking' },
    { ...base, eyeOfsY: -2, eyeOfsX: 1, browLift: 4, browAngle: -2, mouthD: MOUTH.neutral, showHand: 'scratch', animClass: 'av-thinking' },
    { ...base, eyeOfsY: -2, eyeOfsX: 2, browLift: 3, browAngle: -1, mouthD: MOUTH.think, showHand: 'scratch', eyeRy: 0, animClass: 'av-thinking' }, // pisca
    { ...base, eyeOfsY: -2, eyeOfsX: 3, browLift: 4, browAngle: -1, mouthD: MOUTH.think, showHand: 'scratch', animClass: 'av-thinking' },
    // Volta a mão para o queixo
    { ...base, eyeOfsY: -1, eyeOfsX: -2, browLift: 2, browAngle: 3, mouthD: MOUTH.think, showHand: 'chin', animClass: 'av-thinking' },
    { ...base, eyeOfsY: 0, eyeOfsX: 0, browLift: 0, browAngle: 0, mouthD: MOUTH.neutral, showHand: 'chin', animClass: 'av-thinking' },
    { ...base, eyeOfsY: -3, eyeOfsX: 4, browLift: 2, browAngle: -2, mouthD: MOUTH.openO, showHand: 'chin', animClass: 'av-thinking' },
  ],
  preocupado: [
    { ...base, eyeRy: 6.5, browLift: 0, browAngle: 4, mouthD: MOUTH.nervous, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 7, browLift: -1, browAngle: 5, mouthD: MOUTH.sad, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 0, browLift: -1, browAngle: 5, mouthD: MOUTH.sad, showSweat: true, animClass: 'av-worried' }, // pisca de nervoso
    { ...base, eyeRy: 6, browLift: 1, browAngle: 3, mouthD: MOUTH.nervous, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 8, browLift: -2, browAngle: 6, mouthD: MOUTH.openO, showSweat: true, animClass: 'av-worried' }, // ofegante
    { ...base, eyeRy: 8, browLift: -2, browAngle: 6, mouthD: MOUTH.openO, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 5, browLift: 0, browAngle: 4, mouthD: MOUTH.sad, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 4, browLift: 0, browAngle: 5, mouthD: MOUTH.nervous, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 6, browLift: 1, browAngle: 3, mouthD: MOUTH.sad, showSweat: true, animClass: 'av-worried' },
    { ...base, eyeRy: 7, browLift: -1, browAngle: 5, mouthD: MOUTH.nervous, showSweat: true, animClass: 'av-worried' },
  ],
  feliz: [
    { ...base, eyeRy: 3.5, eyeOfsY: 2, browLift: 2, browAngle: -1, mouthD: MOUTH.smileBg, cheek: 0.7, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 2.5, eyeOfsY: 3, browLift: 3, browAngle: -2, mouthD: MOUTH.smileTh, cheek: 0.8, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 0, eyeOfsY: 3, browLift: 3, browAngle: -2, mouthD: MOUTH.smileTh, cheek: 0.8, showStars: true, animClass: 'av-happy' }, // pisca feliz
    { ...base, eyeRy: 3.5, eyeOfsY: 2, browLift: 2, browAngle: -1, mouthD: MOUTH.smileBg, cheek: 0.7, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 4, eyeOfsY: 1, browLift: 1, browAngle: 0, mouthD: MOUTH.smileSm, cheek: 0.5, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 3, eyeOfsY: 3, browLift: 4, browAngle: -3, mouthD: MOUTH.openU, cheek: 0.9, showStars: true, animClass: 'av-happy' }, // sorrisão aberto
    { ...base, eyeRy: 3, eyeOfsY: 3, browLift: 4, browAngle: -3, mouthD: MOUTH.openU, cheek: 0.9, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 3.5, eyeOfsY: 2, browLift: 2, browAngle: -1, mouthD: MOUTH.smileTh, cheek: 0.8, showStars: true, animClass: 'av-happy' },
    { ...base, eyeRy: 0, eyeOfsY: 2, browLift: 2, browAngle: -1, mouthD: MOUTH.smileTh, cheek: 0.8, showStars: true, animClass: 'av-happy' }, // pisca
    { ...base, eyeRy: 3.5, eyeOfsY: 2, browLift: 1, browAngle: 0, mouthD: MOUTH.smileBg, cheek: 0.6, showStars: true, animClass: 'av-happy' },
  ],
  errou: [
    { ...base, eyeRy: 6, browLift: -1, browAngle: 5, mouthD: MOUTH.sad, showTears: true, animClass: 'av-wrong' },
    { ...base, eyeRy: 4, browLift: -2, browAngle: 6, mouthD: MOUTH.nervous, showTears: true, animClass: 'av-wrong' },
    { ...base, eyeRy: 0, browLift: -3, browAngle: 7, mouthD: MOUTH.sadBg, showTears: true, showHand: 'facepalm', animClass: 'av-wrong' }, // esconde o rosto de vergonha
    { ...base, eyeRy: 0, browLift: -3, browAngle: 7, mouthD: MOUTH.sadBg, showTears: true, showHand: 'facepalm', animClass: 'av-wrong' },
    { ...base, eyeRy: 5, browLift: 0, browAngle: 4, mouthD: MOUTH.nervous, showTears: true, animClass: 'av-wrong' },
    { ...base, eyeRy: 7, browLift: 1, browAngle: 3, mouthD: MOUTH.openO, showTears: true, animClass: 'av-wrong' }, // suspira
    { ...base, eyeRy: 6, browLift: -1, browAngle: 5, mouthD: MOUTH.sad, showTears: true, animClass: 'av-wrong' },
    { ...base, eyeRy: 0, browLift: -2, browAngle: 6, mouthD: MOUTH.sad, showTears: true, animClass: 'av-wrong' }, // pisca apertado
    { ...base, eyeRy: 5, browLift: 0, browAngle: 4, mouthD: MOUTH.nervous, showTears: true, animClass: 'av-wrong' },
    { ...base, eyeRy: 6, browLift: -1, browAngle: 5, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-wrong' },
  ],
  triste: [
    { ...base, eyeRy: 5, eyeOfsY: 1, browLift: -3, browAngle: 6, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 4, eyeOfsY: 2, browLift: -4, browAngle: 7, mouthD: MOUTH.sad, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 0, eyeOfsY: 2, browLift: -4, browAngle: 7, mouthD: MOUTH.sad, showTears: true, animClass: 'av-sad' }, // chora de olhos fechados
    { ...base, eyeRy: 0, eyeOfsY: 2, browLift: -4, browAngle: 7, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 6, eyeOfsY: 0, browLift: -2, browAngle: 5, mouthD: MOUTH.openO, showTears: true, animClass: 'av-sad' }, // soluço
    { ...base, eyeRy: 4, eyeOfsY: 1, browLift: -3, browAngle: 6, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 3, eyeOfsY: 2, browLift: -4, browAngle: 7, mouthD: MOUTH.sad, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 0, eyeOfsY: 2, browLift: -4, browAngle: 7, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-sad' },
    { ...base, eyeRy: 5, eyeOfsY: 1, browLift: -2, browAngle: 5, mouthD: MOUTH.sad, showTears: true, animClass: 'av-sad' }, // fallback
    { ...base, eyeRy: 5, eyeOfsY: 1, browLift: -3, browAngle: 6, mouthD: MOUTH.sadBg, showTears: true, animClass: 'av-sad' },
  ],
  medo: [
    { ...base, eyeRy: 11, eyeOfsY: -3, browLift: 4, browAngle: -3, mouthD: MOUTH.nervous, showSweat: true, showHand: 'peek', animClass: 'av-scared' },
    { ...base, eyeRy: 12, eyeOfsY: -4, browLift: 5, browAngle: -4, mouthD: MOUTH.sadBg, showSweat: true, showHand: 'peek', animClass: 'av-scared' },
    { ...base, eyeRy: 0, eyeOfsY: -1, browLift: 6, browAngle: -5, mouthD: MOUTH.nervous, showSweat: true, showHand: 'peek', animClass: 'av-scared' }, // fecha o olho espiando
    { ...base, eyeRy: 10, eyeOfsY: -2, browLift: 3, browAngle: -2, mouthD: MOUTH.sad, showSweat: true, animClass: 'av-scared' },
    { ...base, eyeRy: 12, eyeOfsY: -4, browLift: 5, browAngle: -4, mouthD: MOUTH.openO, showSweat: true, animClass: 'av-scared' },
    { ...base, eyeRy: 13, eyeOfsY: -5, browLift: 6, browAngle: -5, mouthD: MOUTH.openU, showSweat: true, animClass: 'av-scared' }, // apavorado
    { ...base, eyeRy: 9, eyeOfsY: -1, browLift: 2, browAngle: -1, mouthD: MOUTH.nervous, showSweat: true, animClass: 'av-scared' },
    { ...base, eyeRy: 0, eyeOfsY: -1, browLift: 5, browAngle: -4, mouthD: MOUTH.sadBg, showSweat: true, showHand: 'peek', animClass: 'av-scared' },
    { ...base, eyeRy: 11, eyeOfsY: -3, browLift: 4, browAngle: -3, mouthD: MOUTH.openO, showSweat: true, showHand: 'peek', animClass: 'av-scared' },
    { ...base, eyeRy: 12, eyeOfsY: -4, browLift: 5, browAngle: -4, mouthD: MOUTH.sadBg, showSweat: true, animClass: 'av-scared' },
  ],
  surpreso: [
    { ...base, eyeRy: 12, eyeOfsY: -4, browLift: 7, browAngle: -1, mouthD: MOUTH.openO, cheek: 0.15, showQuestion: true, animClass: 'av-surprised' },
    { ...base, eyeRy: 13, eyeOfsY: -5, browLift: 8, browAngle: -2, mouthD: MOUTH.openU, cheek: 0.20, showQuestion: true, animClass: 'av-surprised' },
    { ...base, eyeRy: 12, eyeOfsY: -4, browLift: 7, browAngle: -1, mouthD: MOUTH.openO, cheek: 0.15, showQuestion: true, animClass: 'av-surprised' },
    { ...base, eyeRy: 0, eyeOfsY: -4, browLift: 7, browAngle: -1, mouthD: MOUTH.openO, cheek: 0.15, showQuestion: true, animClass: 'av-surprised' }, // pisca
  ]
};

/* ── Cabelo de fundo (atrás da cabeça) ── */
function HairBack({ style, hair }: { style: number; hair: string }) {
  if (style === 0 || style === 1 || style === 3) return null; // Careca, Curto, Tupete não usam back
  if (style === 2) return ( // Longo Liso (Massa sólida caindo)
    <path d="M 5 40 Q 5 10 40 5 Q 75 10 75 40 L 78 95 Q 78 105 65 105 L 60 50 L 20 50 L 15 105 Q 2 105 2 95 Z" fill={hair} />
  );
  if (style === 4) return ( // Black Power (Afro grande)
    <path d="M 0 50 C -5 10, 20 -15, 40 -15 C 60 -15, 85 10, 80 50 C 85 70, 70 85, 55 80 C 45 85, 35 85, 25 80 C 10 85, -5 70, 0 50 Z" fill={hair} />
  );
  if (style === 5) return ( // Ondulado (Caindo pelas laterais com volume inferior)
    <path d="M 5 40 Q 5 10 40 5 Q 75 10 75 40 L 78 70 Q 82 85 75 95 Q 68 105 60 95 L 55 50 L 25 50 L 20 95 Q 12 105 5 95 Q -2 85 2 70 Z" fill={hair} />
  );
  if (style === 6) return ( // Coque / Updo (Bola na nuca)
    <path d="M 25 15 C 20 -5, 60 -5, 55 15 Z" fill={hair} />
  );
  return null;
}

/* ── Cabelo frontal (franja) e Chapéu (na frente do rosto) ── */
function HairFront({ style, hasHat, hair }: { style: number; hasHat: boolean; hair: string }) {
  return (
    <g>
      {/* Franja se houver cabelo e não estiver usando chapéu */}
      {!hasHat && style === 1 && ( // Curto (Texturizado masculino)
        <path d="M 6 52 C 4 30, 10 15, 25 10 L 28 6 L 35 10 L 40 6 L 45 10 C 65 10, 76 25, 74 52 C 70 40, 65 30, 45 28 C 30 26, 18 35, 6 52 Z" fill={hair} />
      )}
      {!hasHat && style === 2 && ( // Longo Liso (Franja dividida ao meio)
        <path d="M 6 45 C 6 20, 20 5, 40 5 C 60 5, 74 20, 74 45 C 74 65, 68 75, 68 75 C 68 75, 62 55, 55 40 C 48 25, 40 28, 40 28 C 40 28, 32 25, 25 40 C 18 55, 12 75, 12 75 C 12 75, 6 65, 6 45 Z" fill={hair} />
      )}
      {!hasHat && style === 3 && ( // Tupete (Pompadour liso)
        <path d="M 4 48 C 2 20, 10 -5, 35 -10 C 60 -15, 78 15, 76 48 C 70 38, 55 25, 40 25 C 25 25, 10 38, 4 48 Z" fill={hair} />
      )}
      {!hasHat && style === 4 && ( // Black Power (Borda frontal enrolada)
        <path d="M 6 48 C 10 35, 15 28, 25 30 C 35 25, 45 25, 55 30 C 65 28, 70 35, 74 48 C 70 40, 60 33, 40 33 C 20 33, 10 40, 6 48 Z" fill={hair} />
      )}
      {!hasHat && style === 5 && ( // Ondulado (Franja lateral profunda)
        <path d="M 6 45 C 6 15, 25 5, 45 5 C 65 5, 74 20, 74 45 C 74 65, 70 75, 70 75 C 70 75, 60 55, 55 40 C 50 25, 35 20, 25 30 C 15 40, 10 65, 10 65 C 10 65, 6 55, 6 45 Z" fill={hair} />
      )}
      {!hasHat && style === 6 && ( // Coque (Fios soltos e cabelo puxado)
        <g fill={hair}>
          <path d="M 6 48 C 4 20, 20 5, 40 5 C 60 5, 76 20, 74 48 C 70 38, 60 25, 40 25 C 20 25, 10 38, 6 48 Z" />
          <path d="M 12 40 Q 6 60, 14 75 Q 16 65, 15 50 Z" />
          <path d="M 68 40 Q 74 60, 66 75 Q 64 65, 65 50 Z" />
        </g>
      )}

      {/* Chapéu se habilitado */}
      {hasHat && (
        <g>
          {/* Sombra projetada do chapéu na testa/rosto */}
          <path d="M 6 36 C 6 36, 40 50, 74 36 C 62 45, 18 45, 6 36 Z" fill="#000000" opacity="0.35" />

          {/* Cabelo lateral pequiadinho abaixo do chapéu (apenas se tiver cabelo) */}
          {style !== 0 && (
            <>
              <path d="M 10 38 Q 7 45 12 48 Q 14 43 12 38 Z" fill={hair} />
              <path d="M 70 38 Q 73 45 68 48 Q 66 43 68 38 Z" fill={hair} />
            </>
          )}

          {/* Copa do chapéu (Fedora ultra largo para cobrir contornos) */}
          <path d="M 8 36 C 4 -2, 22 1, 40 5 C 58 1, 76 -1, 72 36 Z" fill="url(#hat-crown-grad)" stroke="#7A5C43" strokeWidth="0.8" />
          {/* Faixa decorativa (Ribbon) que contorna o chapéu */}
          <path d="M 7.8 31 C 7.8 31, 40 35, 72.2 31 L 72.4 36 C 72.4 36, 40 40, 7.6 36 Z" fill="url(#hat-ribbon-grad)" />
          {/* Aba superior do chapéu */}
          <path d="M -2 36 C -2 30, 40 28, 82 36 C 82 40, 40 42, -2 36 Z" fill="url(#hat-brim-grad)" stroke="#7A5C43" strokeWidth="0.5" />
          {/* Borda inferior / espessura da aba para efeito 3D */}
          <path d="M -2 36 C 40 42, 82 40, 82 36 C 82 38, 81 41, 78 43 C 40 46, 2 44, -2 36 Z" fill="#7C593F" />
        </g>
      )}
    </g>
  );
}

/* ── Componente principal ───────────────────────────────────── */
interface AvatarProps {
  mood: AvatarMood;
  skin?: AvatarSkin;
  style?: number;         // Alterado de AvatarStyle para number
  glasses?: number;       // 0=nenhum, 1=redondo, 2=quadrado, 3=escuro
  beard?: number;         // 0=nenhum, 1=completa, 2=bigode, 3=cavanhaque
  eyeColor?: string;      // cor dos olhos
  hairColor?: string;     // cor do cabelo
  size?: number;
}

export function AvatarAnimated({
  mood,
  skin = 'media',
  style = 1,
  glasses = 0,
  beard = 0,
  eyeColor = '#1C0D00',
  hairColor = 'preto',
  size = 80
}: AvatarProps) {
  const [frame, setFrame] = useState(0);

  // Motor de animação: avança 1 frame a cada 600ms
  useEffect(() => {
    setFrame(0);
    const seq = MOOD_SEQUENCES[mood];
    if (!seq || seq.length <= 1) return;

    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % seq.length);
    }, 600);

    return () => clearInterval(interval);
  }, [mood]);

  const c = SKIN[skin];
  const hColor = HAIR_COLORS[hairColor] || { hair: c.hair, hairAlt: c.hairAlt };
  const seq = MOOD_SEQUENCES[mood];
  const m = seq ? seq[frame % seq.length] : base;

  // Interpretando o estilo e o chapéu com base nas dezenas
  let normStyle = style;
  const hasHat = normStyle >= 10;
  const hairStyle = normStyle % 10;

  // Posições base com deslocamentos aplicados
  const FACE_CX = 40, FACE_CY = 54, FACE_R = 30;
  const EYE_LX = 28 + (m.eyeOfsX || 0), EYE_RX = 52 + (m.eyeOfsX || 0);
  const EYE_Y = 50 + m.eyeOfsY;
  const EYE_RX_AXIS = 4.8;
  const BROW_Y_BASE = 38;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 98"
      className={`avatar-svg ${m.animClass}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* Degradê azul no topo da testa para indicar medo/pânico */}
        <linearGradient id="scared-forehead-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
        {/* Gradients para o Chapéu 3D */}
        <linearGradient id="hat-crown-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E6D3" />
          <stop offset="40%" stopColor="#D4A373" />
          <stop offset="100%" stopColor="#A98467" />
        </linearGradient>
        <linearGradient id="hat-brim-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9C46A" />
          <stop offset="100%" stopColor="#A98467" />
        </linearGradient>
        <linearGradient id="hat-ribbon-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* ── Cabelo traseiro (atrás da cabeça) ── */}
      <HairBack style={hairStyle} hair={hColor.hair} />

      {/* ── Rosto ── */}
      <circle cx={FACE_CX} cy={FACE_CY} r={FACE_R} fill={c.face} />

      {/* Sombra sutil no queixo */}
      <ellipse cx={FACE_CX} cy={FACE_CY + FACE_R - 4} rx={20} ry={8} fill={c.shadow} opacity="0.35" />

      {/* Degradê azul do pânico na testa do Scared */}
      {mood === 'medo' && (
        <path d="M 12 43 C 18 26, 62 26, 68 43 C 58 35, 22 35, 12 43 Z" fill="url(#scared-forehead-grad)" opacity="0.8" />
      )}

      {/* ── Bochechas (blush) ── */}
      {m.cheek > 0 && (
        <>
          <ellipse cx={17 + (m.eyeOfsX || 0) * 0.5} cy="60" rx="7" ry="5" fill="#FF8A80" opacity={m.cheek} className="av-cheek" />
          <ellipse cx={63 + (m.eyeOfsX || 0) * 0.5} cy="60" rx="7" ry="5" fill="#FF8A80" opacity={m.cheek} className="av-cheek" />
        </>
      )}

      {/* ── Sobrancelhas ── */}
      <path
        d={`M ${EYE_LX - 9} ${BROW_Y_BASE - m.browLift + m.browAngle}
            Q ${EYE_LX}     ${BROW_Y_BASE - m.browLift - 3}
              ${EYE_LX + 8} ${BROW_Y_BASE - m.browLift}`}
        stroke="#3B2000" strokeWidth="2.8" fill="none" strokeLinecap="round"
        className="av-brow-l"
      />
      <path
        d={`M ${EYE_RX - 8} ${BROW_Y_BASE - m.browLift}
            Q ${EYE_RX}     ${BROW_Y_BASE - m.browLift - 3}
              ${EYE_RX + 9} ${BROW_Y_BASE - m.browLift + m.browAngle}`}
        stroke="#3B2000" strokeWidth="2.8" fill="none" strokeLinecap="round"
        className="av-brow-r"
      />

      {/* ── Olhos ── */}
      <ellipse cx={EYE_LX} cy={EYE_Y} rx={EYE_RX_AXIS} ry={m.eyeRy} fill={eyeColor} className="av-eye-l" />
      <ellipse cx={EYE_RX} cy={EYE_Y} rx={EYE_RX_AXIS} ry={m.eyeRy} fill={eyeColor} className="av-eye-r" />

      {/* Pupilas pretas quando os olhos são coloridos */}
      {eyeColor !== '#1C0D00' && m.eyeRy > 3 && (
        <>
          <ellipse cx={EYE_LX} cy={EYE_Y} rx={EYE_RX_AXIS - 2} ry={m.eyeRy - 1.5} fill="#000000" />
          <ellipse cx={EYE_RX} cy={EYE_Y} rx={EYE_RX_AXIS - 2} ry={m.eyeRy - 1.5} fill="#000000" />
        </>
      )}

      {/* Brilho dos olhos */}
      {m.eyeRy > 3 && (
        <>
          <ellipse cx={EYE_LX + 1.8} cy={EYE_Y - 2.2} rx="1.8" ry="1.8" fill="white" opacity="0.95" />
          <ellipse cx={EYE_RX + 1.8} cy={EYE_Y - 2.2} rx="1.8" ry="1.8" fill="white" opacity="0.95" />
        </>
      )}

      {/* ── Óculos Customizáveis ── */}
      {/* 1: Redondo (Escurecido e Ampliado) */}
      {glasses === 1 && (
        <g stroke="#1E293B" strokeWidth="3.2" fill="none" opacity="0.98">
          <circle cx={EYE_LX} cy={EYE_Y} r="9.0" />
          <circle cx={EYE_RX} cy={EYE_Y} r="9.0" />
          <path d={`M ${EYE_LX + 9.0} ${EYE_Y} Q 40 ${EYE_Y - 2.5} ${EYE_RX - 9.0} ${EYE_Y}`} />
          <path d={`M ${EYE_LX - 9.0} ${EYE_Y} L 12 ${EYE_Y - 1.5}`} />
          <path d={`M ${EYE_RX + 9.0} ${EYE_Y} L 68 ${EYE_Y - 1.5}`} />
        </g>
      )}
      {/* 2: Quadrado (Engrossado e Ampliado) */}
      {glasses === 2 && (
        <g stroke="#1E293B" strokeWidth="3.2" fill="none" opacity="0.98">
          <rect x={EYE_LX - 9.0} y={EYE_Y - 7.5} width="18" height="15" rx="2" />
          <rect x={EYE_RX - 9.0} y={EYE_Y - 7.5} width="18" height="15" rx="2" />
          <path d={`M ${EYE_LX + 9.0} ${EYE_Y} H ${EYE_RX - 9.0}`} />
          <path d={`M ${EYE_LX - 9.0} ${EYE_Y} L 12 ${EYE_Y - 1.5}`} />
          <path d={`M ${EYE_RX + 9.0} ${EYE_Y} L 68 ${EYE_Y - 1.5}`} />
        </g>
      )}
      {/* 3: Escuro/Sunglasses */}
      {glasses === 3 && (
        <g stroke="#0f172a" strokeWidth="1.2" fill="#1e293b" opacity="0.98">
          <path d={`M ${EYE_LX - 8.5} ${EYE_Y - 4.5} H ${EYE_LX + 8.5} L ${EYE_LX + 6.5} ${EYE_Y + 5.5} Q ${EYE_LX} ${EYE_Y + 7.5} ${EYE_LX - 6.5} ${EYE_Y + 5.5} Z`} />
          <path d={`M ${EYE_RX - 8.5} ${EYE_Y - 4.5} H ${EYE_RX + 8.5} L ${EYE_RX + 6.5} ${EYE_Y + 5.5} Q ${EYE_RX} ${EYE_Y + 7.5} ${EYE_RX - 6.5} ${EYE_Y + 5.5} Z`} />
          <path d={`M ${EYE_LX + 8.5} ${EYE_Y - 1.5} Q 40 ${EYE_Y - 3.5} ${EYE_RX - 8.5} ${EYE_Y - 1.5}`} stroke="#000" strokeWidth="2.5" fill="none" />
          <path d={`M ${EYE_LX - 8.5} ${EYE_Y - 2.5} L 11 ${EYE_Y - 3}`} stroke="#000" strokeWidth="3" fill="none" />
          <path d={`M ${EYE_RX + 8.5} ${EYE_Y - 2.5} L 69 ${EYE_Y - 3}`} stroke="#000" strokeWidth="3" fill="none" />
          {/* Brilho da lente */}
          <path d={`M ${EYE_LX - 5} ${EYE_Y - 2} L ${EYE_LX - 1} ${EYE_Y + 4}`} stroke="#fff" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
          <path d={`M ${EYE_RX - 5} ${EYE_Y - 2} L ${EYE_RX - 1} ${EYE_Y + 4}`} stroke="#fff" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
        </g>
      )}


      {/* ── Cabelo Frontal / Franja ou Chapéu ── */}
      <HairFront style={hairStyle} hasHat={hasHat} hair={hColor.hair} />

      {/* ── Nariz Premium ── */}
      <path
        d={`M ${38.5 + (m.eyeOfsX || 0) * 0.3} ${58 + (m.eyeOfsY || 0) * 0.2} 
            Q ${40 + (m.eyeOfsX || 0) * 0.3} ${55.5 + (m.eyeOfsY || 0) * 0.2} 
              ${41.5 + (m.eyeOfsX || 0) * 0.3} ${58 + (m.eyeOfsY || 0) * 0.2}`}
        stroke={c.shadow}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Boca Customizada / Premium ── */}
      {m.mouthD === MOUTH.smileBg || m.mouthD === MOUTH.smileTh || m.mouthD === MOUTH.openU || m.mouthD === MOUTH.openO ? (
        <g className="av-mouth-group">
          {/* Fundo escuro da boca (sorriso cheio) */}
          <path
            d={m.mouthD === MOUTH.smileBg || m.mouthD === MOUTH.smileTh
              ? 'M 26 63.5 Q 40 66 54 63.5 Q 40 81 26 63.5 Z'
              : m.mouthD === MOUTH.openO
                ? 'M 35 65 C 35 60, 45 60, 45 65 C 45 73, 35 73, 35 65 Z'
                : 'M 30 63 Q 40 66 50 63 Q 40 79 30 63 Z'}
            fill="#721616"
            stroke="#3B2000"
            strokeWidth="2.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dentes Superiores (brancos) */}
          {(m.mouthD === MOUTH.smileTh || m.mouthD === MOUTH.openU) && (
            <path
              d={m.mouthD === MOUTH.smileTh
                ? 'M 28 64 Q 40 66.5 52 64 Q 40 70.5 28 64 Z'
                : 'M 31 63.5 Q 40 66 49 63.5 Q 40 68.5 31 63.5 Z'}
              fill="#FFFFFF"
            />
          )}

          {/* Língua (rosa) */}
          {m.mouthD !== MOUTH.openO && (
            <path
              d={m.mouthD === MOUTH.smileBg || m.mouthD === MOUTH.smileTh
                ? 'M 33 72.5 Q 40 69.5 47 72.5 Q 40 80 33 72.5 Z'
                : 'M 35 71.5 Q 40 68.5 45 71.5 Q 40 78 35 71.5 Z'}
              fill="#FFA0A0"
            />
          )}
        </g>
      ) : m.mouthD === MOUTH.nervous ? (
        /* Boca tremendo assustado / nervoso (linhas zigue-zague) */
        <path
          d="M 30 68 L 33 65 L 36 69 L 39 65 L 42 69 L 45 65 L 48 69 L 51 66"
          stroke="#3B2000" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      ) : (
        /* Boca de linha tradicional */
        <path
          d={m.mouthD === MOUTH.neutral ? 'M 28 68 Q 40 68 52 68'
            : m.mouthD === MOUTH.smileSm ? 'M 27 67 Q 40 75 53 67'
              : m.mouthD === MOUTH.sad ? 'M 27 73 Q 40 63 53 73'
                : m.mouthD === MOUTH.sadBg ? 'M 24 77 Q 40 61 56 77'
                  : 'M 30 68 Q 38 65 48 67'}
          stroke="#3B2000" strokeWidth="2.8" fill="none" strokeLinecap="round"
          className="av-mouth"
        />
      )}

      {/* ── Barba e Bigode Customizados ── */}
      {/* 1: Fina + Bigode fino */}
      {beard === 1 && (
        <g fill={hColor.hair} stroke="#1C0D00" strokeWidth="0.8">
          {/* Barba fina nas laterais e queixo */}
          <path
            d="M 10.5 56 C 10 74, 22 86, 36 94 Q 40 97 44 94 C 58 86, 70 74, 69.5 56 C 65 57, 59 74, 48 83 Q 40 87 32 83 C 21 74, 15 57, 10.5 56 Z"
            opacity="0.95"
          />
          {/* Bigode fino que se conecta com a barba */}
          <path d="M 23 72 Q 32 62 40 62 Q 48 62 57 72 Q 48 59 40 59 Q 32 59 23 72 Z" />
        </g>
      )}
      {/* 2: Bigode */}
      {beard === 2 && (
        <path
          d="M 31 63.5 Q 40 66.5 49 63.5 Q 44 59.5 40 61.5 Q 36 59.5 31 63.5"
          fill={hColor.hair}
          stroke="#1E0E00"
          strokeWidth="0.8"
        />
      )}
      {/* 3: Cavanhaque */}
      {beard === 3 && (
        <g fill={hColor.hair} stroke="#1E0E00" strokeWidth="0.8">
          {/* Bigode fininho */}
          <path d="M 32 63.8 Q 40 66 48 63.8 Q 40 61 32 63.8" />
          {/* Barbicha no queixo */}
          <path d="M 34 74 Q 40 86 46 74 Q 40 78.5 34 74" />
        </g>
      )}

      {/* ── Lágrimas ── */}
      {m.showTears && (
        <>
          <ellipse cx={EYE_LX} cy={EYE_Y + 8} rx="2.5" ry="4" fill="#60A5FA" opacity="0.85" className="av-tear-l" />
          <ellipse cx={EYE_RX} cy={EYE_Y + 8} rx="2.5" ry="4" fill="#60A5FA" opacity="0.85" className="av-tear-r" />
        </>
      )}

      {/* ── Gota de suor ── */}
      {m.showSweat && (
        <g className="av-sweat">
          <ellipse cx="67" cy="40" rx="3.5" ry="5" fill="#93C5FD" opacity="0.9" />
          <ellipse cx="67" cy="35" rx="2" ry="2" fill="#93C5FD" opacity="0.8" />
        </g>
      )}

      {/* ── Mão no queixo (pensativo) ── */}
      {m.showHand === 'chin' && (
        <g className="av-hand-chin">
          {/* Braço com contorno */}
          <path d="M 30 88 Q 38 82 42 80" stroke="#3B2000" strokeWidth="8.5" fill="none" strokeLinecap="round" />
          <path d="M 30 88 Q 38 82 42 80" stroke={c.face} strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Punho e dedos com contorno */}
          <g fill={c.face} stroke="#3B2000" strokeWidth="1.5">
            <ellipse cx="42" cy="80" rx="7" ry="5" />
            <circle cx="37" cy="77" r="4" />
            <circle cx="43" cy="76" r="4" />
            <circle cx="48" cy="78" r="4" />
            <circle cx="43" cy="72" r="3.5" />
          </g>
        </g>
      )}

      {/* ── Mão coçando a cabeça (pensativo) ── */}
      {m.showHand === 'scratch' && (() => {
        const scratchY = 25 + (frame % 2 === 0 ? -4 : 2);
        return (
          <g className="av-hand-scratch">
            {/* Braço subindo pela lateral com contorno */}
            <path d="M 68 92 Q 77 66 65 44" stroke="#3B2000" strokeWidth="8.5" fill="none" strokeLinecap="round" />
            <path d="M 68 92 Q 77 66 65 44" stroke={c.face} strokeWidth="6" fill="none" strokeLinecap="round" />
            {/* Dedos coçando no topo da cabeça com contorno */}
            <g fill={c.face} stroke="#3B2000" strokeWidth="1.5">
              <circle cx="58" cy={scratchY} r="3.5" />
              <circle cx="62" cy={scratchY - 4} r="3.5" />
              <circle cx="67" cy={scratchY - 3} r="3.5" />
              <circle cx="70" cy={scratchY + 2} r="3.0" />
            </g>
          </g>
        );
      })()}

      {/* ── Mão cobrindo o rosto (facepalm - errou) ── */}
      {m.showHand === 'facepalm' && (
        <g className="av-hand-facepalm" fill={c.face} stroke="#3B2000" strokeWidth="1.5">
          <rect x="22" y="40" width="36" height="25" rx="10" />
          {/* Dedos da mão cobrindo */}
          <circle cx="26" cy="46" r="4" />
          <circle cx="33" cy="43" r="4" />
          <circle cx="40" cy="43" r="4" />
          <circle cx="47" cy="45" r="4" />
          <circle cx="53" cy="49" r="4" />
        </g>
      )}

      {/* ── Mãos na bochecha (scream style - medo) ── */}
      {m.showHand === 'peek' && (
        <g className="av-hand-scream">
          {/* Mão esquerda na bochecha */}
          <path d="M 8 98 Q 12 78 16 68 L 19 60" fill="none" stroke={c.shadow} strokeWidth="6" strokeLinecap="round" />
          <path d="M 8 98 Q 12 78 16 68 L 19 60" fill="none" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" />
          {/* Dedos cobrindo a bochecha */}
          <g fill={c.face} stroke="#3B2000" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 10 74 C 7 66, 12 60, 16 66 C 16 72, 12 76, 10 74 Z" />
            <path d="M 12 70 C 8 58, 14 54, 18 62 C 18 68, 14 72, 12 70 Z" />
            <path d="M 15 67 C 12 52, 19 48, 22 58 C 21 64, 17 68, 15 67 Z" />
            <path d="M 19 66 C 18 54, 25 51, 26 60 C 25 66, 21 68, 19 66 Z" />
          </g>
          {/* Mão direita na bochecha */}
          <path d="M 72 98 Q 68 78 64 68 L 61 60" fill="none" stroke={c.shadow} strokeWidth="6" strokeLinecap="round" />
          <path d="M 72 98 Q 68 78 64 68 L 61 60" fill="none" stroke={c.face} strokeWidth="4.5" strokeLinecap="round" />
          {/* Dedos cobrindo a bochecha */}
          <g fill={c.face} stroke="#3B2000" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M 70 74 C 73 66, 68 60, 64 66 C 64 72, 68 76, 70 74 Z" />
            <path d="M 68 70 C 72 58, 66 54, 62 62 C 62 68, 66 72, 68 70 Z" />
            <path d="M 65 67 C 68 52, 61 48, 58 58 C 59 64, 63 68, 65 67 Z" />
            <path d="M 61 66 C 62 54, 55 51, 54 60 C 55 66, 59 68, 61 66 Z" />
          </g>
        </g>
      )}

      {/* ── Estrelas (feliz) ── */}
      {m.showStars && (
        <>
          <text x="2" y="38" fontSize="13" className="av-star-1" aria-hidden="true">⭐</text>
          <text x="62" y="35" fontSize="11" className="av-star-2" aria-hidden="true">✨</text>
          <text x="58" y="88" fontSize="9" className="av-star-3" aria-hidden="true">⭐</text>
        </>
      )}

      {/* ── Ponto de interrogação (surpreso) ── */}
      {m.showQuestion && (
        <text x="60" y="30" fontSize="18" className="av-question" aria-hidden="true">❓</text>
      )}
    </svg>
  );
}
