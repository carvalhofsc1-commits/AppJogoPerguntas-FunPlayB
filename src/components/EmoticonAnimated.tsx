import { useState, useEffect } from 'react';
import { type AvatarMood } from './AvatarAnimated';

const EMOTICON_SEQUENCES: Record<AvatarMood, string[]> = {
  confiante: ['😎', '😌', '😃', '😌', '🙂', '🫠', '🙂', '😌', '😎', '🫠'],
  pensativo: ['🤔', '🧐', '🤨', '🧐', '😶', '🤔', '🤯', '🧐', '😕', '🤔'],
  preocupado: ['🫣', '😥', '😓', '😨', '😰', '😱', '🥵', '🫣', '😥', '😓'],
  feliz: ['🙂', '🫠', '🙂', '😃', '😄', '😁', '😆', '🥳', '🤩', '🤪', '😝', '😎', '🙂', '🫠'],
  surpreso: ['😲', '😮', '😯', '😲', '🤯', '😲', '😮', '😯', '😲', '🤯'],
  errou: ['😕', '😒', '😞', '😣', '😖', '😫', '😩', '😤', '😡', '😒'],
  triste: ['😞', '😔', '😟', '😢', '😭', '🥺', '😞', '😔', '😟', '😢', '😭', '🥺'],
  medo: ['😨', '😱', '😰', '🥶', '🫣', '😨', '😱', '😰', '🥶', '🫣'],
};


// Mapeamento para as classes de chacoalho que já existem no CSS turbinado
const MOOD_CLASSES: Record<AvatarMood, string> = {
  confiante: 'av-idle',
  pensativo: 'animacaoPensativa',
  preocupado: 'animacaoPreocupado',
  feliz: 'animacaoFeliz',
  surpreso: 'av-surprised',
  errou: 'animacaoErrou',
  triste: 'animacaoTriste',
  medo: 'animacaoPreocupado',
};

export function EmoticonAnimated({ mood }: { mood: AvatarMood }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const seq = EMOTICON_SEQUENCES[mood];
    if (!seq || seq.length <= 1) return;

    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % seq.length);
    }, 2000); // Muda o emoji a cada 600ms

    return () => clearInterval(interval);
  }, [mood]);

  const seq = EMOTICON_SEQUENCES[mood] || ['🤔'];
  const emoji = seq[frame % seq.length];
  const className = MOOD_CLASSES[mood] || '';

  return (
    <div style={{
      fontSize: '54px',
      lineHeight: '54px',
      display: 'inline-block',
      verticalAlign: 'middle',
      transformOrigin: 'center bottom',
    }} className={`emoticon-anim-wrapper ${className}`}>
      {emoji}
    </div>
  );
}
