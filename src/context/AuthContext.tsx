import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerSession } from '@/types/game';

const SESSION_KEY = 'funplayb_session';

interface AuthContextValue {
  session: PlayerSession | null;
  loading: boolean;
  login: (identifier: string, pin: string) => Promise<string | null>;
  logout: () => void;
  refreshSession: () => void;
  isAdmin: boolean;
  betaMessage: string;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  login: async () => 'Não inicializado',
  logout: () => { },
  refreshSession: () => { },
  isAdmin: false,
  betaMessage: 'Bem Vindo ao FunPlayB!',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaMessage, setBetaMessage] = useState('Bem Vindo ao FunPlayB!');

  // Carrega sessão do localStorage na inicialização
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayerSession;
        if (parsed.player_id && parsed.nickname) {
          setSession(parsed);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  // Busca a mensagem beta global do admin real
  useEffect(() => {
    if (!supabase) return;
    const fetchBetaMsg = async () => {
      // 1. Acha o admin real (ignora o 0000...)
      const { data: adminData, error: adminErr } = await supabase!
        .from('players')
        .select('id')
        .eq('category', 'admin')
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (adminErr) console.error('[fetchBetaMsg] Erro ao buscar admin:', adminErr);

      if (adminData) {
        // 2. Pega as configurações do admin real
        const { data: settingsData, error: settingsErr } = await supabase!
          .from('game_settings')
          .select('sounds')
          .eq('player_id', adminData.id)
          .maybeSingle();

        if (settingsErr) console.error('[fetchBetaMsg] Erro ao buscar game_settings:', settingsErr);

        if (settingsData?.sounds?.beta_message) {
          setBetaMessage(settingsData.sounds.beta_message);
        }
      }
    };
    fetchBetaMsg();
  }, []);

  // Login por nickname OU email + PIN de 4 dígitos
  const login = useCallback(async (identifier: string, pin: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado';
    if (!identifier.trim()) return 'Informe o nickname ou e-mail';
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return 'PIN deve ter 4 dígitos numéricos';

    const isEmail = identifier.includes('@');

    // Login e verificação de PIN acontecem inteiramente no servidor
    // (função SECURITY DEFINER) — o PIN nunca é comparado no navegador
    // nem trafega o hash de volta para o cliente.
    const { data, error } = await supabase
      .rpc('login_player', { p_identifier: identifier.trim(), p_pin: pin })
      .maybeSingle<{
        result: 'ok' | 'not_found' | 'wrong_pin' | 'suspended' | 'inactive';
        id: string;
        nickname: string;
        email: string;
        category: string;
        admin_initials: string | null;
        total_access: number;
        status: string | null;
      }>();

    if (error) return 'Erro ao conectar. Tente novamente.';
    if (!data || data.result === 'not_found') return `${isEmail ? 'E-mail' : 'Nickname'} não encontrado`;
    if (data.result === 'wrong_pin') return 'PIN incorreto';
    if (data.result === 'suspended') return 'Conta suspensa. Contate o administrador.';
    if (data.result === 'inactive') return 'Esta conta foi inativada.';
    if (data.result !== 'ok' || !data.id) return 'Erro ao conectar. Tente novamente.';

    const sess: PlayerSession = {
      player_id: data.id,
      nickname: data.nickname,
      category: data.category as 'jogador' | 'admin',
      admin_initials: data.admin_initials ?? undefined,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    sessionStorage.removeItem('funplayb_quick_settings');
    setSession(sess);

    // last_seen_at e total_access já são atualizados dentro de login_player()

    return null; // null = sem erro
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('funplayb_ai_help_count');
    sessionStorage.removeItem('funplayb_quick_settings');
    setSession(null);
    // Remove presença online
    if (session?.player_id && supabase) {
      supabase.from('online_presence').delete().eq('player_id', session.player_id);
    }
  }, [session]);

  const refreshSession = useCallback(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch { }
  }, []);

  // Online Presence Ping Global
  useEffect(() => {
    if (!session?.player_id || !supabase) return;

    const ping = async () => {
      try {
        await supabase!.from('online_presence').upsert(
          { player_id: session.player_id, nickname: session.nickname, last_ping: new Date().toISOString() },
          { onConflict: 'player_id' }
        );
      } catch (e) {
        console.error('Erro no ping de presença:', e);
      }
    };

    ping();
    const iv = setInterval(ping, 30_000);

    return () => clearInterval(iv);
  }, [session?.player_id, session?.nickname]);

  // Controle de Ociosidade (Desconecta após 5 minutos sem interação)
  useEffect(() => {
    if (!session?.player_id) return;

    let idleTimeout: ReturnType<typeof setTimeout>;

    const resetIdleTimer = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.log('Sessão expirada por inatividade (5 min).');
        logout();
      }, 5 * 60 * 1000); // 5 minutos = 300.000 ms
    };

    // Configura os ouvintes de eventos
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

    // Inicia a primeira contagem
    resetIdleTimer();

    // Quando qualquer um desses eventos ocorrer, zera o cronômetro
    events.forEach(event => window.addEventListener(event, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(idleTimeout);
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };
  }, [session?.player_id, logout]);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      login,
      logout,
      refreshSession,
      isAdmin: session?.category === 'admin',
      betaMessage,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
