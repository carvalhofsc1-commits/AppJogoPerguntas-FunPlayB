import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';


interface AudioContextType {
  isMuted: boolean;
  /** Espelho de isMuted em ref — leia isto (não `isMuted`) em código que pode
   *  rodar a partir de closures/timeouts antigos (fora de handlers síncronos),
   *  para nunca agir com um valor de mute obsoleto. */
  isMutedRef: React.MutableRefObject<boolean>;
  toggleMute: () => void;
  playSfx: (url: string | undefined, volume?: number, loop?: boolean) => any;
  stopSfx: (source: any) => void;
  stopAllSfx: () => void;
  preloadSfx: (urls: string[], onProgress?: (pct: number) => void) => Promise<void>;
  isPreloaded: boolean;
  initAudio: () => void;
}

const AudioSystemContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('game_muted') === 'true');
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [globalMute, setGlobalMute] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('game_settings').select('sounds').eq('player_id', '00000000-0000-0000-0000-000000000000').maybeSingle()
      .then(({ data }) => setGlobalMute(!!data?.sounds?.master_mute), () => setGlobalMute(false));
  }, []);

  const audioBuffers = useRef<Record<string, AudioBuffer>>({});
  const htmlAudioFallback = useRef<Record<string, HTMLAudioElement>>({});
  const audioCtx = useRef<AudioContext | null>(null);
  
  // Registro centralizado e persistente de fontes ativas
  const activeSources = useRef<Set<any>>(new Set());

  // Mapa de loops para evitar duplicidade (url -> source)
  const loopMap = useRef<Map<string, any>>(new Map());

  const stopSfx = useCallback((source: any) => {
    if (!source) return;
    try {
      // Tenta várias formas de parar dependendo do objeto
      if (typeof source.stop === 'function') source.stop();
      else if (typeof source.pause === 'function') source.pause();
      
      if (typeof source.disconnect === 'function') source.disconnect();
    } catch (e) {
      // Ignora erros de já parado
    } finally {
      activeSources.current.delete(source);
      // Remove do mapa de loops se estiver lá
      for (const [url, s] of loopMap.current.entries()) {
        if (s === source) {
          loopMap.current.delete(url);
          break;
        }
      }
    }
  }, []);

  const stopAllSfx = useCallback(() => {
    console.log('[AudioSystem] Parando todos os sons:', activeSources.current.size);
    activeSources.current.forEach(source => {
      try {
        if (typeof source.stop === 'function') source.stop();
        else if (typeof source.pause === 'function') source.pause();
        if (typeof source.disconnect === 'function') source.disconnect();
      } catch {}
    });
    activeSources.current.clear();
    loopMap.current.clear();
  }, []);

  // Expõe para o console em caso de emergência
  useEffect(() => {
    (window as any)._forceStopAll = stopAllSfx;
    return () => { delete (window as any)._forceStopAll; };
  }, [stopAllSfx]);

  const initAudio = useCallback(async () => {
    if (!audioCtx.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        try {
          const ctx = (window as any).__funplaybCtx || new Ctx();
          (window as any).__funplaybCtx = ctx;
          audioCtx.current = ctx;
          // Toca um buffer vazio para desbloquear o contexto no mobile
          const b = ctx.createBuffer(1, 1, 22050);
          const s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
        } catch {}
      }
    }
    if (audioCtx.current?.state === 'suspended') {
      try { await audioCtx.current.resume(); } catch {}
    }
  }, []);

  const isMutedRef = useRef(isMuted);
  const globalMuteRef = useRef(globalMute);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { globalMuteRef.current = globalMute; }, [globalMute]);

  const toggleMute = useCallback(() => {
    initAudio();
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('game_muted', String(next));
      if (next) stopAllSfx(); // Para tudo imediatamente ao mutar
      return next;
    });
  }, [initAudio, stopAllSfx]);

  const playSfx = useCallback((url: string | undefined, volume: number = 1, loop: boolean = false): any => {
    if (isMutedRef.current || globalMuteRef.current || !url) return null;
    // initAudio é async mas a chamada é fire-and-forget aqui para não bloquear
    // O contexto já deve estar pronto após o primeiro clique do usuário
    initAudio();

    // Se for loop, garante que não tem outro igual tocando
    if (loop && loopMap.current.has(url)) {
      stopSfx(loopMap.current.get(url));
    }

    const ctx = audioCtx.current;
    const buffer = audioBuffers.current[url];
    let sourceObj: any = null;

    try {
      if (ctx && buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, volume));
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        sourceObj = source;
      } else {
        // Fallback HTMLAudio
        const urlWithBuster = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        const audio = (htmlAudioFallback.current[url]?.cloneNode() as HTMLAudioElement) || new Audio(urlWithBuster);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.loop = loop;
        audio.play().catch(() => {});
        sourceObj = {
          stop: () => { audio.pause(); audio.currentTime = 0; },
          pause: () => { audio.pause(); },
          disconnect: () => {}
        };
      }
    } catch (e) {
      console.error('[AudioSystem] Erro ao tocar som:', url, e);
    }

    if (sourceObj) {
      activeSources.current.add(sourceObj);
      if (loop) loopMap.current.set(url, sourceObj);
      
      // Auto-limpeza para não-loops
      if (!loop) {
        if (sourceObj.onended !== undefined) {
          sourceObj.onended = () => activeSources.current.delete(sourceObj);
        } else if (sourceObj instanceof HTMLAudioElement || (sourceObj as any).pause) {
          // Para o objeto fake ou Audio real, não temos onended fácil em todos os casos, 
          // mas o stopAll resolve.
        }
      }
    }
    return sourceObj;
  }, [initAudio, stopSfx]);

  const preloadSfx = async (urls: string[], onProgress?: (pct: number) => void) => {
    initAudio();
    const filtered = [...new Set(urls.filter(Boolean))];

    // Se todos j\u00e1 est\u00e3o em mem\u00f3ria, termina imediatamente
    const allCached = filtered.every(url => audioBuffers.current[url] || htmlAudioFallback.current[url]);
    if (allCached) {
      setIsPreloaded(true);
      onProgress?.(100);
      return;
    }
    setIsPreloaded(false);

    const total = filtered.length;
    let loaded = 0;

    // Helper: yield para o browser pintar um frame antes de continuar
    const yieldFrame = () => new Promise<void>(r => setTimeout(r, 0));

    // Fase 1: Download em paralelo (r\u00e1pido — aproveita a rede)
    onProgress?.(2); // sinal visual imediato de que come\u00e7ou
    const downloaded: { url: string; ab: ArrayBuffer | null }[] = await Promise.all(
      filtered.map(async (url) => {
        if (audioBuffers.current[url] || htmlAudioFallback.current[url]) {
          return { url, ab: null }; // j\u00e1 em cache
        }
        try {
          const res = await fetch(url, { cache: 'default' });
          return { url, ab: await res.arrayBuffer() };
        } catch {
          return { url, ab: null };
        }
      })
    );

    // Fase 2: Decodifica UM por vez, cedendo controle ao browser entre cada um
    // Isso garante que React consegue re-renderizar e a barra avança visivelmente
    for (const { url, ab } of downloaded) {
      if (audioBuffers.current[url] || htmlAudioFallback.current[url]) {
        // J\u00e1 estava em cache — conta e segue
        loaded++;
        onProgress?.(Math.round((loaded / total) * 100));
        await yieldFrame();
        continue;
      }

      if (ab && audioCtx.current) {
        try {
          // decodeAudioData \u00e9 pesado — cede ao browser antes de chamar
          await yieldFrame();
          const decoded = await audioCtx.current.decodeAudioData(ab.slice(0));
          audioBuffers.current[url] = decoded;
        } catch {
          // Fallback: HTMLAudio
          try {
            const a = new Audio(url);
            a.preload = 'auto';
            await new Promise<void>(r => { a.oncanplaythrough = () => r(); a.onerror = () => r(); setTimeout(r, 4000); });
            htmlAudioFallback.current[url] = a;
          } catch {}
        }
      } else if (!ab) {
        // Download falhou — tenta HTMLAudio direto
        try {
          const a = new Audio(url);
          a.preload = 'auto';
          await new Promise<void>(r => { a.oncanplaythrough = () => r(); a.onerror = () => r(); setTimeout(r, 4000); });
          htmlAudioFallback.current[url] = a;
        } catch {}
      }

      loaded++;
      onProgress?.(Math.round((loaded / total) * 100));
      await yieldFrame(); // garante que React pinta o novo progresso
    }

    setIsPreloaded(true);
  };

  return (
    <AudioSystemContext.Provider value={{
      isMuted, isMutedRef, toggleMute, playSfx, stopSfx, stopAllSfx, preloadSfx, isPreloaded, initAudio
    }}>
      {children}
    </AudioSystemContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioSystemContext);
  if (context === undefined) throw new Error('useAudio must be used within an AudioProvider');
  return context;
}
