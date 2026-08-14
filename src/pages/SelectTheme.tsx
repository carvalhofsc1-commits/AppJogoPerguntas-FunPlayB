import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Theme, GameSettings } from '@/types/game';
import { DEFAULT_SETTINGS } from '@/types/game';

/* ── Chave de sessão para quick settings ─────────────────── */
const SESSION_KEY = 'funplayb_quick_settings';

interface QuickSettings {
  timer_seconds: number;
  questions_per_round: number;
  sort_mode: 'aleatorio' | 'gradativo';
  qty_facil: number;
  qty_medio: number;
  qty_dificil: number;
  voice_input_enabled?: boolean;
}

/** Calcula distribuição de dificuldade a partir de um total */
function calcDiffQty(total: number): { facil: number; medio: number; dificil: number } {
  const facil = Math.round(total * 0.30);
  const dificil = Math.round(total * 0.20);
  const medio = total - facil - dificil;
  return { facil, medio: Math.max(0, medio), dificil };
}

/** Lê das configurações salvas em localStorage (banco já carregado em loadSettings) */
function loadBaseSettings(): GameSettings {
  try {
    const cached = localStorage.getItem('funplayb_settings');
    if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
  } catch { }
  return DEFAULT_SETTINGS;
}

/** Lê os quick settings da sessão (sessionStorage) */
function readQuickSettings(): QuickSettings | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Salva quick settings na sessão */
function writeQuickSettings(qs: QuickSettings) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(qs));
}

/* ── Tela de seleção de temas ─────────────────────────── */
export default function SelectTheme() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') ?? 'solo') as 'solo' | 'grupo';

  const [themes, setThemes] = useState<(Theme & { total: number; available: number; lastAdded?: string | null; newCount?: number })[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  // Filtros e ordenação
  const [activeFilters, setActiveFilters] = useState<Set<'privados' | 'publicos' | 'meus'>>(new Set());
  const [sortMode, setSortMode] = useState<'recentes' | 'atualizacoes' | 'perguntas' | null>('recentes');

  const pillsScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkPillsScroll = useCallback(() => {
    const container = pillsScrollRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftArrow(scrollLeft > 2);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 2);
    }
  }, []);

  const scrollPills = (direction: 'left' | 'right') => {
    const container = pillsScrollRef.current;
    if (container) {
      const amount = direction === 'left' ? -150 : 150;
      container.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkPillsScroll();

    // Also check after a brief moment to ensure layout is complete and stable
    const timer = setTimeout(checkPillsScroll, 100);

    window.addEventListener('resize', checkPillsScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkPillsScroll);
    };
  }, [checkPillsScroll]);

  // Run scroll check when loading state changes or when themes list is updated
  useEffect(() => {
    checkPillsScroll();
    const timer = setTimeout(checkPillsScroll, 200);
    return () => clearTimeout(timer);
  }, [loading, themes, checkPillsScroll]);

  const toggleFilter = (filter: 'privados' | 'publicos' | 'meus') => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
        // Exclusividade mútua entre privados e públicos
        if (filter === 'privados') next.delete('publicos');
        if (filter === 'publicos') next.delete('privados');
      }
      return next;
    });
  };

  const toggleSort = (sort: 'recentes' | 'atualizacoes' | 'perguntas') => {
    setSortMode(prev => prev === sort ? null : sort);
  };

  /* ── Quick Settings state ─────────────────────────────── */
  const [quick, setQuick] = useState<QuickSettings>(() => {
    // Prioridade: sessão aberta → banco (localStorage)
    const session = readQuickSettings();
    if (session) return session;
    const base = loadBaseSettings();
    return {
      timer_seconds: base.timer_seconds,
      questions_per_round: base.questions_per_round,
      sort_mode: base.sort_mode,
      qty_facil: base.qty_facil,
      qty_medio: base.qty_medio,
      qty_dificil: base.qty_dificil,
      voice_input_enabled: base.sounds?.voice_input_enabled ?? false,
    };
  });


  /* Persiste na sessão sempre que mudar */
  useEffect(() => {
    writeQuickSettings(quick);
  }, [quick]);

  /* Helper para atualizar um campo e persistir */
  const updateQuick = useCallback(<K extends keyof QuickSettings>(key: K, value: QuickSettings[K]) => {
    setQuick(prev => ({ ...prev, [key]: value }));
  }, []);

  /* Ao mudar quantidade total de perguntas — recalcula distribuição */
  const handleQtyChange = useCallback((total: number) => {
    const { facil, medio, dificil } = calcDiffQty(total);
    setQuick(prev => ({
      ...prev,
      questions_per_round: total,
      qty_facil: facil,
      qty_medio: medio,
      qty_dificil: dificil,
    }));
  }, []);

  /* ── Sincronização com o banco de dados ─────────────────── */
  useEffect(() => {
    if (!supabase || !session) return;

    const syncWithDb = async () => {
      // Só sincroniza se ainda não houver ajustes feitos NESTA sessão
      const hasSessionSettings = !!readQuickSettings();

      const { data } = await supabase!
        .from('game_settings')
        .select('*')
        .eq('player_id', session.player_id)
        .maybeSingle();

      if (data) {
        const dbQs: QuickSettings = {
          timer_seconds: data.timer_seconds,
          questions_per_round: data.questions_per_round,
          sort_mode: data.sort_mode as any,
          qty_facil: data.qty_facil,
          qty_medio: data.qty_medio,
          qty_dificil: data.qty_dificil,
          voice_input_enabled: data.sounds?.voice_input_enabled ?? false,
        };

        // Salva no localStorage para uso futuro (offline/base)
        localStorage.setItem('funplayb_settings', JSON.stringify(data));

        // Se o usuário ainda não mexeu nos botões nesta sessão, aplica os do banco
        if (!hasSessionSettings) {
          setQuick(dbQs);
        }
      }
    };

    syncWithDb();
  }, [session]);



  /* ── Carregamento dos temas ──────────────────────────── */
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;

    const load = async () => {
      setProgress(10);

      let { data: th } = await supabase!
        .from('themes')
        .select('*')
        .order('name');

      if (th) {
        th = th.filter(t => !t.is_private || session.category === 'admin' || t.created_by === session.player_id);
      }

      if (cancelled) return;
      setProgress(35);

      if (!th || th.length === 0) {
        if (!cancelled) { setThemes([]); setLoading(false); setProgress(100); }
        return;
      }

      // Função auxiliar para buscar todos os registros burlando o limite de 1000 linhas do Supabase
      const fetchAllQuestions = async () => {
        let allData: any[] = [];
        let from = 0;
        while (true) {
          const { data } = await supabase!
            .from('questions')
            .select('theme_id, id, updated_at, created_at')
            .eq('status', 'aprovada')
            .range(from, from + 999);
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return allData;
      };

      const fetchAllAnswered = async () => {
        let allData: any[] = [];
        let from = 0;
        while (true) {
          const { data } = await supabase!
            .from('answered_questions')
            .select('question_id')
            .eq('player_id', session.player_id)
            .range(from, from + 999);
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return allData;
      };

      const [totalCounts, answeredCounts] = await Promise.all([
        fetchAllQuestions(),
        fetchAllAnswered(),
      ]);

      if (cancelled) return;
      setProgress(80);

      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const answSet = new Set((answeredCounts ?? []).map((a: any) => a.question_id));
      const qsByTheme: Record<string, string[]> = {};
      const newQsByTheme: Record<string, { count: number; lastDate: string }> = {};

      (totalCounts ?? []).forEach((q: any) => {
        if (!qsByTheme[q.theme_id]) qsByTheme[q.theme_id] = [];
        qsByTheme[q.theme_id].push(q.id);

        const dateStr = q.updated_at || q.created_at;
        if (dateStr) {
          const updatedTime = new Date(dateStr).getTime();
          if (now - updatedTime <= SEVEN_DAYS_MS) {
            if (!newQsByTheme[q.theme_id]) {
              newQsByTheme[q.theme_id] = { count: 0, lastDate: dateStr };
            }
            newQsByTheme[q.theme_id].count++;
            if (updatedTime > new Date(newQsByTheme[q.theme_id].lastDate).getTime()) {
              newQsByTheme[q.theme_id].lastDate = dateStr;
            }
          }
        }
      });

      const withMeta = (th as any[])
        .map(t => ({
          ...t,
          total: qsByTheme[t.id]?.length ?? 0,
          available: (qsByTheme[t.id] ?? []).filter(id => !answSet.has(id)).length,
          lastAdded: newQsByTheme[t.id]?.lastDate ?? null,
          newCount: newQsByTheme[t.id]?.count ?? 0,
        }))
        .filter(t => t.total > 0);

      const recentIds = new Set(
        [...withMeta]
          .filter(t => t.lastAdded)
          .sort((a, b) => new Date(b.lastAdded!).getTime() - new Date(a.lastAdded!).getTime())
          .slice(0, 3)
          .map(t => t.id)
      );

      const sorted = [
        ...withMeta.filter(t => recentIds.has(t.id))
          .sort((a, b) => new Date(b.lastAdded!).getTime() - new Date(a.lastAdded!).getTime()),
        ...withMeta.filter(t => !recentIds.has(t.id)),
      ];

      if (!cancelled) {
        setThemes(sorted);
        setProgress(100);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [session]);

  const processedThemes = useMemo(() => {
    let result = [...themes];

    // Filtros
    if (activeFilters.size > 0) {
      result = result.filter(t => {
        let pass = true;
        if (activeFilters.has('privados') && !t.is_private) pass = false;
        if (activeFilters.has('publicos') && t.is_private) pass = false;
        if (activeFilters.has('meus') && t.created_by !== session?.player_id) pass = false;
        return pass;
      });
    }

    // Ordenação
    if (sortMode === 'atualizacoes') {
      result.sort((a, b) => {
        if (a.lastAdded && b.lastAdded) return new Date(b.lastAdded).getTime() - new Date(a.lastAdded).getTime();
        if (a.lastAdded) return -1;
        if (b.lastAdded) return 1;
        return 0;
      });
    } else if (sortMode === 'perguntas') {
      result.sort((a, b) => b.available - a.available);
    } // sortMode 'recentes' ou null mantém a ordem pré-processada de carregamento (novidades e recentes no topo)

    return result;
  }, [themes, activeFilters, sortMode, session]);

  const toggleTheme = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleStart = () => {
    if (selected.size === 0) return;
    // Os quick settings já estão no sessionStorage (via useEffect + writeQuickSettings)
    // O Play.tsx irá ler de lá para aplicar os overrides sobre as configurações do banco.

    const params = new URLSearchParams({ themes: [...selected].join(','), mode });
    navigate(`/play?${params.toString()}`);
  };

  const handleSelectAll = () => {
    const allAvailableIds = processedThemes.filter(t => !(mode === 'solo' && t.available === 0)).map(t => t.id);
    if (selected.size === allAvailableIds.length && allAvailableIds.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allAvailableIds));
    }
  };

  const totalSelectedQuestions = Array.from(selected).reduce((acc, id) => {
    const theme = themes.find(t => t.id === id);
    if (!theme) return acc;
    return acc + (mode === 'solo' ? theme.available : theme.total);
  }, 0);

  return (
    <div className="select-screen" style={{ paddingBottom: '48px' }}>
      <div className="select-card" style={{ marginTop: '54px', gap: '10px', padding: '10px 12px 12px' }}>
        {/* ── Cabeçalho: logo + título + botão ──────────── */}
        <div className="select-header-compact">
          <img
            src="/logo.png"
            alt="FunPlayB"
            className="auth-logo auth-logo-sm"
            onClick={() => navigate('/about')}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            title="Sobre / Ajuda"
          />
          <div className="select-header-right">
            <h1 className="select-title">Escolher tema</h1>
            <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '250px', marginTop: '4px' }}>
              <button
                className="btn-back"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => navigate('/', { replace: true })}
              >
                ◀ Início
              </button>
              <button
                className="btn-back"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => navigate('/questions')}
              >
                📝 Adm. Perg.
              </button>
            </div>
          </div>
        </div>

        {/* ── Painel de Ajustes Rápidos ─────────────────────── */}
        <div className="quick-settings-panel" style={{ marginBottom: '0px' }}>
          {/* Linha 1: Título e Link para Settings */}
          <div 
            className="qs-row-title" 
            onClick={() => setShowQuickSettings(!showQuickSettings)}
            style={{ cursor: 'pointer', justifyContent: 'space-between', display: 'flex', alignItems: 'center', margin: showQuickSettings ? '0 0 10px 0' : '0' }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f5c842', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
              ⚡ Ajustes Rápidos 
              <span style={{ fontSize: '1.4rem', marginLeft: '6px', lineHeight: 0 }}>
                {showQuickSettings ? '▴' : '▾'}
              </span>
            </span>
            <span 
              onClick={(e) => { e.stopPropagation(); navigate('/settings'); }} 
              style={{ 
                cursor: 'pointer', 
                opacity: 0.8,
                fontSize: '0.75rem',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'none',
                letterSpacing: 'normal',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              ⚙️ Avançado
            </span>
          </div>

          {showQuickSettings && (
            <>
              {/* Linha 2: todos os controles inline */}
              <div className="qs-row-controls">
                {/* 1. Tempo */}
                <div className="qs-ctrl-stack" style={{ alignItems: 'flex-start' }}>
                  <span className="qs-lbl-mini">Tempo do jogo:</span>
                  <div className="qs-ctrl">
                    <span className="qs-lbl">{quick.timer_seconds}s</span>
                    <div className="qs-stepper">
                      <div className="btn-step qs-btn" onClick={() => updateQuick('timer_seconds', Math.max(10, quick.timer_seconds - 10))}>−</div>
                      <div className="btn-step qs-btn" onClick={() => updateQuick('timer_seconds', Math.min(300, quick.timer_seconds + 10))}>+</div>
                    </div>
                  </div>
                </div>

                <div className="qs-divider" />

                {/* 2. Sorteio (CENTRO) */}
                <div className="qs-ctrl-stack" style={{ alignItems: 'center' }}>
                  <span className="qs-lbl-mini">Tipo sorteio:</span>
                  <div className="qs-sort">
                    <button
                      className={`qs-sort-btn ${quick.sort_mode === 'aleatorio' ? 'active' : ''}`}
                      onClick={() => updateQuick('sort_mode', 'aleatorio')}
                    >Aleat.</button>
                    <button
                      className={`qs-sort-btn ${quick.sort_mode === 'gradativo' ? 'active' : ''}`}
                      onClick={() => updateQuick('sort_mode', 'gradativo')}
                    >Dific.</button>
                  </div>
                </div>

                <div className="qs-divider" />

                {/* 3. Perguntas (DIREITA) */}
                <div className="qs-ctrl-stack" style={{ position: 'relative' }}>
                  <span className="qs-lbl-mini">Quant. perguntas:</span>
                  <div className="qs-ctrl" style={{ gap: '5px' }}>
                    <span className="qs-lbl">{quick.questions_per_round}q</span>
                    <div className="qs-stepper">
                      <div className="btn-step qs-btn" onClick={() => handleQtyChange(Math.max(1, quick.questions_per_round - 1))}>−</div>
                      <div className="btn-step qs-btn" onClick={() => handleQtyChange(Math.min(50, quick.questions_per_round + 1))}>+</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="qs-lbl-mini" style={{ fontSize: '0.8rem', color: '#f5c842' }}>🗣️ Narração e Respostas por Voz:</span>
                <label className="toggle-switch" style={{ transform: 'scale(0.8)', transformOrigin: 'right center', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={!!quick.voice_input_enabled} 
                    onChange={e => updateQuick('voice_input_enabled', e.target.checked)} 
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="screen-center" style={{ minHeight: 'auto', padding: '2rem', width: '100%' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {progress < 40 ? 'Buscando temas...' : progress < 85 ? 'Calculando progresso...' : 'Quase lá...'}
            </p>
            <div style={{ width: '100%', maxWidth: '260px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #f5c842, #f09a1a)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        ) : themes.length === 0 ? (
          <div className="empty-msg">
            <p>Nenhum tema disponível ainda.</p>
            <p>Adicione perguntas aprovadas em <strong>Administrar Perguntas</strong>.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px', marginTop: '0px', gap: '10px' }}>
              <p className="select-hint" style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.1, flex: 1, color: '#f5c842' }}>
                Toque para selecionar<br />um ou mais temas:
              </p>
              {/* Botão Selecionar Todos com estilo pílula e cor amarela em destaque */}
              <button
                onClick={handleSelectAll}
                style={{
                  background: 'linear-gradient(135deg, #e184fdff 0%, #eeb5ffff 100%)',
                  border: '1px solid rgba(103, 45, 110, 0.5)',
                  borderRadius: '20px',
                  width: '135px',
                  height: '36px',
                  margin: 0,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  boxShadow: '0 4px 12px rgba(245, 200, 66, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 850, fontSize: '0.85rem', color: '#6d0088e3', textAlign: 'center', lineHeight: 1.1 }}>
                  {selected.size > 0 && selected.size === processedThemes.filter(t => !(mode === 'solo' && t.available === 0)).length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </span>
              </button>
            </div>

            {/* Barra de Filtros Horizontal (Dentro de um Card) */}
            <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '6px 8px', marginBottom: '2px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '5px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'relative',
                height: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'padding-left 0.2s ease',
                  paddingLeft: showLeftArrow ? '22px' : '0px',
                  width: '100%'
                }}>
                  {showLeftArrow && (
                    <span
                      className="label-scroll-arrow left"
                      onClick={() => scrollPills('left')}
                      aria-label="Rolar para esquerda"
                      style={{
                        position: 'absolute',
                        left: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '1.3rem',
                        userSelect: 'none',
                        padding: '2px',
                        lineHeight: 1
                      }}
                    >
                      ←
                    </span>
                  )}
                  <span>Filtros e Ordenação</span>
                </div>
                {showRightArrow && (
                  <span
                    className="label-scroll-arrow right"
                    onClick={() => scrollPills('right')}
                    aria-label="Rolar para direita"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '1.3rem',
                      userSelect: 'none',
                      padding: '2px',
                      lineHeight: 1
                    }}
                  >
                    →
                  </span>
                )}
              </div>
              <div
                ref={pillsScrollRef}
                onScroll={checkPillsScroll}
                style={{ display: 'flex', overflowX: 'auto', gap: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap', alignItems: 'center', width: '100%' }}
                className="hide-scrollbar"
              >
                <button className={`btn-filter-pill ${activeFilters.size === 0 ? 'active' : ''}`} onClick={() => setActiveFilters(new Set())}>Todos</button>
                <button className={`btn-filter-pill ${activeFilters.has('privados') ? 'active' : ''}`} onClick={() => toggleFilter('privados')}>Privados</button>
                <button className={`btn-filter-pill ${activeFilters.has('publicos') ? 'active' : ''}`} onClick={() => toggleFilter('publicos')}>Públicos</button>
                <button className={`btn-filter-pill ${activeFilters.has('meus') ? 'active' : ''}`} onClick={() => toggleFilter('meus')}>Meus</button>

                <div style={{ width: '1px', minWidth: '1px', height: '18px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />

                <button className={`btn-filter-pill ${sortMode === 'recentes' || sortMode === null ? 'active' : ''}`} onClick={() => toggleSort('recentes')}>Recentes</button>
                <button className={`btn-filter-pill ${sortMode === 'atualizacoes' ? 'active' : ''}`} onClick={() => toggleSort('atualizacoes')}>Atualizações</button>
                <button className={`btn-filter-pill ${sortMode === 'perguntas' ? 'active' : ''}`} onClick={() => toggleSort('perguntas')}>Perguntas</button>
              </div>
            </div>

            <style>{`
              .theme-scroll-container {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              .theme-scroll-container::-webkit-scrollbar, .hide-scrollbar::-webkit-scrollbar {
                display: none !important;
              }
              .btn-filter-pill {
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.8);
                border-radius: 12px;
                padding: 4px 10px;
                font-size: 0.75rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                flex-shrink: 0;
              }
              .btn-filter-pill.active {
                background: rgba(245, 200, 66, 0.2);
                border-color: #f5c842;
                color: #fbff00ff;
                font-weight: 700;
              }
              .theme-chip-private:not(.theme-chip-active):not(.theme-chip-done) {
                background: linear-gradient(135deg, rgba(100, 50, 160, 0.4) 0%, rgba(80, 30, 130, 0.5) 100%);
                border: 1px dashed rgba(245, 200, 66, 0.4);
              }
              .label-scroll-arrow {
                transition: all 0.2s ease;
              }
              .label-scroll-arrow:hover {
                color: #fff !important;
                transform: scale(1.3);
              }
              .label-scroll-arrow:active {
                transform: scale(0.95);
              }
            `}</style>
            <div style={{
              border: '1px solid rgba(245, 200, 66, 0.28)',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.22)',
              padding: '4px 4px 8px 4px',
              flex: '1 1 0',
              minHeight: 0,
              overflowY: 'auto',
              margin: '0px 0 0 0',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
              WebkitOverflowScrolling: 'touch'
            }} className="theme-scroll-container">
              <div className="theme-grid" style={{ maxHeight: 'none', overflowY: 'visible', padding: 0 }}>
                {processedThemes.map(t => {
                  const isSelected = selected.has(t.id);
                  const allAnswered = t.available === 0 && mode === 'solo';
                  const isNew = !!(t as any).lastAdded && ((t as any).newCount ?? 0) > 0;
                  const lastAddedDate = (t as any).lastAdded
                    ? new Date((t as any).lastAdded).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : null;
                  return (
                    <button
                      key={t.id}
                      className={`theme-chip ${isSelected ? 'theme-chip-active' : ''} ${allAnswered ? 'theme-chip-done' : ''} ${isNew ? 'theme-chip-new' : ''} ${t.is_private ? 'theme-chip-private' : ''}`}
                      onClick={() => toggleTheme(t.id)}
                      disabled={allAnswered}
                      style={isNew ? { height: 'auto', minHeight: '70px' } : undefined}
                    >
                      <span className="theme-chip-name">
                        {t.is_private && <span style={{ marginRight: '4px' }}>🔒</span>}
                        {t.name}
                      </span>
                      {mode === 'solo' && (
                        <span className="theme-chip-counts">
                          {allAnswered ? '✓ todas respondidas' : `${t.available}/${t.total}`}
                        </span>
                      )}
                      {mode !== 'solo' && (
                        <span className="theme-chip-counts">{t.total} perguntas</span>
                      )}
                      {isNew && (
                        <span className="theme-chip-new-badge">
                          🆕 {(t as any).newCount} nova{(t as any).newCount !== 1 ? 's' : ''} pergunta{(t as any).newCount !== 1 ? 's' : ''}!
                          <span className="theme-chip-new-date">{lastAddedDate}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="btn-primary"
              disabled={selected.size === 0}
              onClick={handleStart}
              style={{ flexShrink: 0 }}
            >
              {selected.size === 0
                ? 'Selecione ao menos 1 tema'
                : `▶ Iniciar jogo (${totalSelectedQuestions} pergunta${totalSelectedQuestions !== 1 ? 's' : ''})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
