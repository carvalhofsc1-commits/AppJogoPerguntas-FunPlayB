import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_SETTINGS, type GameSettings, type VoiceProfile } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { VERSION_CONFIG } from '@/lib/version';
import { AvatarAnimated, type AvatarMood } from '@/components/AvatarAnimated';
import { EmoticonAnimated } from '@/components/EmoticonAnimated';
import { VoiceProfileManager } from '@/components/VoiceProfileManager';
import { MicHelpModal } from '@/components/MicHelpModal';

const SOUND_SLOTS: { key: keyof GameSettings['sounds']; label: string; desc: string }[] = [
  { key: 'click', label: 'Selecionar opção', desc: 'Toca ao clicar em uma resposta' },
  { key: 'correct', label: 'Resposta correta', desc: 'Toca quando o jogador acerta' },
  { key: 'wrong', label: 'Resposta errada', desc: 'Toca quando o jogador erra' },
  { key: 'tick', label: 'Pensando (tempo)', desc: 'Toca durante a contagem' },
  { key: 'warning', label: 'Aviso de tempo', desc: 'Toca nos últimos segundos' },
  { key: 'timeout', label: 'Tempo esgotado', desc: 'Toca ao fim do cronômetro' },
  { key: 'next', label: 'Próxima pergunta', desc: 'Toca ao avançar de pergunta' },
  { key: 'help_skip', label: 'Ajuda: Pular', desc: 'Toca ao clicar no botão Pular' },
  { key: 'help_eliminate', label: 'Ajuda: Eliminar', desc: 'Toca ao abrir o sorteio de eliminação (50/50)' },
  { key: 'draw_spin', label: 'Sorteio: Girando', desc: 'Toca enquanto o sorteio de eliminação está rodando' },
  { key: 'draw_stop', label: 'Sorteio: Botão Parar', desc: 'Toca ao clicar no botão de Parar Agora do sorteio' },
  { key: 'draw_eliminate', label: 'Sorteio: Eliminar Respostas', desc: 'Toca ao clicar em "Eliminar X erradas" após o sorteio' },
  { key: 'help_external', label: 'Ajuda: Externa', desc: 'Toca ao usar a ajuda externa' },
  { key: 'result', label: 'Tela de Resultado', desc: 'Toca enquanto a tela de resultado final é exibida' },
];

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="settings-row">{children}</div>
);

const SectionCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="settings-section-card">
    <h2 className="settings-section-title">{title}</h2>
    <div className="settings-section-content">
      {children}
    </div>
  </div>
);

const NumberInput = ({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (val: number) => void
}) => (
  <Row>
    <label className="settings-label">{label}</label>
    <div className="number-control">
      <div className="btn-step" onClick={() => onChange(Math.max(min, value - 1))}>−</div>
      <input
        type="number"
        className="settings-number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
      />
      <div className="btn-step" onClick={() => onChange(Math.min(max, value + 1))}>+</div>
    </div>
  </Row>
);

export default function Settings() {
  const { session, isAdmin } = useAuth();
  const { playSfx, stopSfx, preloadSfx, initAudio, isMuted } = useAudio();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const cached = localStorage.getItem('funplayb_settings');
      if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    } catch { }
    return DEFAULT_SETTINGS;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [globalMute, setGlobalMute] = useState(false);
  const [initialSettings, setInitialSettings] = useState<GameSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!initialSettings || !settings) return;
    const cleanS1 = { ...initialSettings, updated_at: null };
    const cleanS2 = { ...settings, updated_at: null };
    setIsDirty(JSON.stringify(cleanS1) !== JSON.stringify(cleanS2));
  }, [settings, initialSettings]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    (window as any).__isSettingsDirty = isDirty;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      (window as any).__isSettingsDirty = false;
    };
  }, [isDirty]);

  const activeSources = useRef<Record<string, AudioBufferSourceNode>>({});
  const [isPlayingStatus, setIsPlayingStatus] = useState<Record<string, boolean>>({});
  const [showPreviews, setShowPreviews] = useState(false);

  // TTS Settings
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [showVoiceManager, setShowVoiceManager] = useState(false);
  const [showMicHelp, setShowMicHelp] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setTtsVoices(window.speechSynthesis.getVoices());
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const [releaseNoteText, setReleaseNoteText] = useState('');
  const [releaseNoteId, setReleaseNoteId] = useState<string | null>(null);
  const releaseNoteRef = useRef<HTMLTextAreaElement>(null);
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectAllPrompt = () => {
    if (aiPromptRef.current) {
      aiPromptRef.current.select();
      aiPromptRef.current.focus();
    }
  };

  const handleCopyPromptText = async () => {
    try {
      await navigator.clipboard.writeText(settings.ai_import_prompt ?? '');
      alert('Texto copiado para a área de transferência!');
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handlePastePromptText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      update('ai_import_prompt', text);
    } catch (err) {
      console.error('Falha ao colar:', err);
      alert('Não foi possível acessar a área de transferência. Cole manualmente (Ctrl+V ou toque longo).');
    }
  };

  const handleSelectAllNotes = () => {
    if (releaseNoteRef.current) {
      releaseNoteRef.current.select();
      releaseNoteRef.current.focus();
    }
  };

  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(releaseNoteText);
      alert('Texto copiado para a área de transferência!');
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handlePasteNotes = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setReleaseNoteText(text);
    } catch (err) {
      console.error('Falha ao colar:', err);
      alert('Não foi possível acessar a área de transferência. Cole manualmente (Ctrl+V ou toque longo).');
    }
  };

  useEffect(() => {
    if (isAdmin && supabase) {
      supabase.from('game_settings').select('sounds').eq('player_id', '00000000-0000-0000-0000-000000000000').maybeSingle()
        .then(({ data }) => {
          setGlobalMute(!!data?.sounds?.master_mute);
        });

      // Busca a nota de atualização mais recente para edição
      // (usa a mais recente ao invés de buscar pela versão exata, para não sumir ao atualizar a versão)
      supabase.from('release_notes').select('id, notes, version').order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setReleaseNoteId(data.id);
            setReleaseNoteText(data.notes);
          }
        });
    }

    // Carregar Perfis de Voz
    if (supabase) {
      supabase.from('voice_profiles').select('*').order('name')
        .then(({ data }) => {
          if (data) setVoiceProfiles(data);
        });
    }
  }, [isAdmin]);

  const toggleGlobalMute = async (mute: boolean) => {
    if (!supabase) return;
    setGlobalMute(mute);
    const { error } = await supabase.rpc('update_global_master_mute', { mute });
    if (error) {
      console.error('Erro ao alternar mute global:', error);
      setMsg('❌ Erro ao salvar configuração!');
    } else {
      setMsg(mute ? '⚠️ Sons DESATIVADOS globalmente!' : '✅ Sons ATIVADOS globalmente!');
    }
    setTimeout(() => setMsg(''), 4000);
  };


  useEffect(() => {
    if (!supabase || !session) return;
    supabase.from('game_settings').select('*').eq('player_id', session.player_id).maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          const { id, player_id, updated_at, ...rest } = data as any;
          let loadedSettings = { ...DEFAULT_SETTINGS, ...rest };
          
          try {
            const { data: globalData } = await supabase!.from('game_settings')
              .select('ai_import_prompt')
              .eq('player_id', '00000000-0000-0000-0000-000000000000')
              .maybeSingle();
            if (globalData?.ai_import_prompt) {
              loadedSettings.ai_import_prompt = globalData.ai_import_prompt;
            }
          } catch (e) {
            console.error('Erro ao buscar prompt global:', e);
          }
          
          setSettings(loadedSettings);
          setInitialSettings(loadedSettings);
        }
      });
  }, [session]);

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const handleSaveGlobalDefaults = async () => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('Atenção: Isso definirá suas configurações ATUAIS (exceto seus sons) como o PADRÃO GLOBAL para todos os jogadores que restaurarem as configurações. Deseja continuar?')) return;

    setSaving(true);
    const { id: _id, player_id: _pid, updated_at: _upd, sounds: _snd, ...cleanSettings } = settings as any;

    const payload = {
      ...cleanSettings,
      player_id: '00000000-0000-0000-0000-000000000000',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('game_settings').upsert(payload, { onConflict: 'player_id' });
    setSaving(false);
    if (error) {
      alert(`Erro ao salvar padrão global: ${error.message}`);
    } else {
      setMsg('✅ Padrão Global atualizado com sucesso para todos os usuários!');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Restaurar parâmetros de jogo para os valores padrão? Os seus sons configurados serão mantidos.')) return;

    setSaving(true);
    let globalDefaults = { ...DEFAULT_SETTINGS };

    if (supabase) {
      const { data } = await supabase.from('game_settings').select('*').eq('player_id', '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (data) {
        const { id, player_id, updated_at, sounds, ...rest } = data as any;
        globalDefaults = { ...globalDefaults, ...rest };
      }
    }

    setSettings(prev => ({ ...globalDefaults, sounds: prev.sounds }));
    setSaving(false);
    setMsg('✔ Parâmetros restaurados! Clique em Salvar para gravar no seu perfil.');
    setTimeout(() => setMsg(''), 4000);
  };

  const handleRestoreAllUsersDefaults = async () => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('ATENÇÃO: Isso irá redefinir IMEDIATAMENTE as configurações de todos os usuários para o padrão global (mantendo os sons de cada um). Deseja continuar?')) return;

    setSaving(true);
    let globalDefaults = { ...DEFAULT_SETTINGS };

    const { data: globalData } = await supabase
      .from('game_settings')
      .select('*')
      .eq('player_id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (globalData) {
      const { id, player_id, updated_at, sounds, ...rest } = globalData as any;
      globalDefaults = { ...globalDefaults, ...rest };
    }

    const { id: _id, player_id: _pid, updated_at: _upd, sounds: _snd, ...updatePayload } = globalDefaults as any;

    const { error } = await supabase
      .from('game_settings')
      .update(updatePayload)
      .neq('player_id', '00000000-0000-0000-0000-000000000000');

    setSaving(false);
    if (error) {
      console.error(error);
      alert(`Erro ao redefinir configurações: ${error.message}`);
    } else {
      if (session) {
        setSettings(prev => ({ ...globalDefaults, sounds: prev.sounds }));
        localStorage.setItem('funplayb_settings', JSON.stringify({ ...globalDefaults, sounds: settings.sounds }));
      }
      setInitialSettings(settings);
      setIsDirty(false);
      setMsg('✅ Configurações de todos os usuários redefinidas com sucesso!');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleSave = async () => {
    if (!supabase || !session) return;
    setSaving(true);

    const { id: _id, player_id: _pid, updated_at: _upd, ...cleanSettings } = settings as any;

    const payload = {
      ...cleanSettings,
      player_id: session.player_id,
      updated_at: new Date().toISOString()
    };

    // Tenta salvar com retry automático (resolve o "TypeError: Load failed" do iOS Safari
    // que ocorre na primeira tentativa de rede após longos períodos sem interação)
    let result = await supabase
      .from('game_settings')
      .upsert(payload, { onConflict: 'player_id' });

    if (result.error) {
      // Retry automático após 800ms — resolve erros transitórios de rede no iOS
      await new Promise(r => setTimeout(r, 800));
      result = await supabase
        .from('game_settings')
        .upsert(payload, { onConflict: 'player_id' });
    }

    if (result.error) {
      console.error('Erro detalhado:', result.error);
      alert(`Erro ao salvar: ${result.error.message}`);
      setSaving(false);
      return;
    }
    // Salva também a nota de lançamento se for Admin
    if (isAdmin) {
      // Também salva o prompt de IA na conta padrão global para refletir para todos os usuários
      try {
        await supabase
          .from('game_settings')
          .update({ ai_import_prompt: settings.ai_import_prompt })
          .eq('player_id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.error('Erro ao atualizar prompt global:', err);
      }

      if (releaseNoteId) {
        await supabase.from('release_notes').update({ notes: releaseNoteText }).eq('id', releaseNoteId);
      } else if (releaseNoteText.trim()) {
        const { data: nrData } = await supabase.from('release_notes')
          .insert({ version: VERSION_CONFIG.version, notes: releaseNoteText })
          .select('id').single();
        if (nrData) setReleaseNoteId(nrData.id);
      }
    }

    // Salva também em localStorage para uso offline
    localStorage.setItem('funplayb_settings', JSON.stringify(settings));
    setInitialSettings(settings);
    setIsDirty(false);
    setSaving(false);
    setMsg('✅ Configurações salvas!');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSoundUpload = async (key: keyof GameSettings['sounds'], file: File) => {
    if (!supabase) return;

    setMsg('Fazendo upload...');
    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `sounds/${key}_${Date.now()}_${safeName}`;

    const { error } = await supabase.storage.from('game-sounds').upload(path, file);

    if (error) {
      console.error('Erro no upload:', error);
      alert(`Erro no upload: ${error.message} (verifique se o bucket 'game-sounds' existe e tem permissões)`);
      setMsg('');
    } else {
      const { data } = supabase.storage.from('game-sounds').getPublicUrl(path);
      update('sounds', {
        ...settings.sounds,
        [key]: data.publicUrl,
        filenames: { ...(settings.sounds.filenames || {}), [key]: file.name },
        active: { ...(settings.sounds.active || {}), [key]: true } // Ativa automaticamente ao upar
      });
      setMsg('✅ Upload concluído! Não esqueça de salvar.');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleRemoveSound = (key: keyof GameSettings['sounds']) => {
    const newSounds = { ...settings.sounds };
    delete (newSounds as any)[key];

    if (newSounds.filenames) {
      const newNames = { ...newSounds.filenames };
      delete newNames[key];
      newSounds.filenames = newNames;
    }
    update('sounds', newSounds);
    setMsg('✅ Áudio excluído! Não esqueça de salvar.');
    setTimeout(() => setMsg(''), 4000);
  };
  const renderSoundSlot = (key: string, label: string, desc: string) => {
    const soundUrl = (settings.sounds as any)[key];
    const soundName = settings.sounds.filenames?.[key as string] || 'Áudio importado';
    const soundVol = settings.sounds.volumes?.[key as string] ?? 100;
    const soundActive = settings.sounds.active?.[key as string] ?? true;

    return (
      <div key={key} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '12px', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', opacity: soundActive ? 1 : 0.6, transition: 'opacity 0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <p className="settings-label" style={{ margin: 0 }}>{label}</p>
              {soundUrl && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem', background: soundActive ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)', padding: '2px 6px', borderRadius: '4px', color: soundActive ? '#2ecc71' : '#e74c3c' }}>
                  <input type="checkbox" checked={soundActive} onChange={e => {
                    const newActive = { ...(settings.sounds.active || {}), [key]: e.target.checked };
                    update('sounds', { ...settings.sounds, active: newActive });
                  }} style={{ display: 'none' }} />
                  {soundActive ? '🟢 Ativo' : '🔴 Inativo'}
                </label>
              )}
            </div>
            <p className="settings-hint" style={{ margin: 0 }}>{desc}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-start', flexShrink: 0 }}>
            <label className="btn-action-outline btn-tiny-file" style={{ margin: 0 }}>
              {soundUrl ? '🔄' : '📁'}
              <input type="file" accept="audio/wav,audio/mpeg,audio/ogg,audio/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSoundUpload(key as any, f); }} />
            </label>
            {soundUrl && (
              <button className="btn-action-outline btn-tiny-file" style={{ margin: 0, color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => handleRemoveSound(key as any)} title="Excluir áudio">
                🗑️
              </button>
            )}
          </div>
        </div>

        {soundUrl && (
          <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', pointerEvents: soundActive ? 'auto' : 'none' }}>
            <p className="settings-hint" style={{ fontWeight: 'bold', marginBottom: '6px', color: soundActive ? '#f5c842' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🎵 {soundName}
            </p>
            <audio
              controls
              preload="none"
              src={soundUrl}
              className="audio-preview"
              style={{ width: '100%', height: '32px', opacity: soundActive ? 1 : 0.4 }}
              ref={el => { if (el) el.volume = soundVol / 100; }}
              onError={() => {/* Suprime erros silenciosos de carregamento no iOS Safari */}}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <span style={{ fontSize: '0.85em', color: soundActive ? '#ccc' : '#666' }}>Volume:</span>
              <input
                type="range" min="0" max="100"
                value={soundVol}
                onChange={e => {
                  const newVolumes = { ...(settings.sounds.volumes || {}), [key]: Number(e.target.value) };
                  update('sounds', { ...settings.sounds, volumes: newVolumes });
                }}
                style={{ cursor: 'pointer', flex: 1, minWidth: '0' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  onClick={() => {
                    const newVol = Math.max(0, soundVol - 5);
                    const newVolumes = { ...(settings.sounds.volumes || {}), [key]: newVol };
                    update('sounds', { ...settings.sounds, volumes: newVolumes });
                  }}
                  className="btn-step"
                  style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                >−</button>
                <span style={{ fontWeight: 'bold', fontSize: '0.85em', minWidth: '38px', textAlign: 'center', color: soundActive ? '#fff' : '#666' }}>{soundVol}%</span>
                <button
                  onClick={() => {
                    const newVol = Math.min(100, soundVol + 5);
                    const newVolumes = { ...(settings.sounds.volumes || {}), [key]: newVol };
                    update('sounds', { ...settings.sounds, volumes: newVolumes });
                  }}
                  className="btn-step"
                  style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                >+</button>
              </div>
            </div>

            <button
              className="btn-action-yellow"
              style={{ width: '100%', marginTop: '10px', fontSize: '0.8rem', padding: '6px' }}
              onClick={async () => {
                if (isMuted) {
                  alert('O jogo está MUDO! Por favor, clique no ícone de som no topo direito da tela (na barra azul) para ativar o som antes de testar.');
                  return;
                }

                initAudio(); // Chamada síncrona para desbloquear o áudio

                if (isPlayingStatus[key]) {
                  if (activeSources.current[key]) {
                    stopSfx(activeSources.current[key]);
                    delete activeSources.current[key];
                  }
                  setIsPlayingStatus(prev => ({ ...prev, [key]: false }));
                } else {
                  setMsg('Pre-carregando no repositório...');
                  await preloadSfx([soundUrl]);
                  const source = playSfx(soundUrl, soundVol / 100);
                  if (source) {
                    activeSources.current[key] = source;
                    setIsPlayingStatus(prev => ({ ...prev, [key]: true }));
                    source.onended = () => {
                      setIsPlayingStatus(prev => ({ ...prev, [key]: false }));
                      delete activeSources.current[key];
                    };
                  } else {
                    alert('Erro: O motor de áudio falhou ao tentar reproduzir. O som pode estar mutado ou o formato do arquivo é incompatível.');
                  }
                  setMsg('');
                }
              }}
              title={isPlayingStatus[key] ? "Parar teste" : "Ouvir som"}
            >
              {isPlayingStatus[key] ? '⏹️ Parar' : '▶️ Testar'}
            </button>
          </div>
        )}
      </div>
    );
  };


  // Ocultado o bloqueio de tela total para permitir carregamento instantâneo
  return (
    <div className="page-screen">
      {/* O cabeçalho agora fica na Navbar superior */}

      <div className="settings-container">
        {/* Sticky Header at the top of settings page */}
        <div className="settings-sticky-header">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ 
              width: '100%', 
              margin: 0, 
              padding: '6px 10px', 
              fontSize: '0.95rem',
              backgroundColor: isDirty ? '#f5c842' : '#4caf50',
              color: isDirty ? '#333' : '#fff',
              borderColor: isDirty ? '#e5b832' : '#4caf50',
              transition: 'background-color 0.3s ease'
            }}
          >
            {saving ? 'Salvando...' : '💾 Salvar configurações'}
          </button>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                if (isDirty && !window.confirm('Existem alterações não salvas. Se você sair, elas serão perdidas. Deseja sair assim mesmo?')) return;
                navigate('/questions');
              }}
              style={{ flex: 1, margin: 0, padding: '5px 8px', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              📋 Adm. Perguntas
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (isDirty && !window.confirm('Existem alterações não salvas. Se você sair, elas serão perdidas. Deseja sair assim mesmo?')) return;
                navigate('/select-theme?mode=solo');
              }}
              style={{
                flex: 1,
                margin: 0,
                padding: '5px 8px',
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #f5c842 0%, #d35400 100%)',
                color: '#000',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: '0 4px 10px rgba(245, 200, 66, 0.3)'
              }}
            >
              ▶️ Iniciar Jogo
            </button>
          </div>
        </div>
        <SectionCard title="⏩ Pular perguntas">
          <Row>
            <label className="settings-label">Permitir pular</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.allow_skip} onChange={e => update('allow_skip', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          {settings.allow_skip && (
            <NumberInput
              label="Pulos por partida (-1 = ilimitado)"
              value={settings.max_skips}
              min={-1}
              max={99}
              onChange={val => update('max_skips', val)}
            />
          )}
        </SectionCard>

        <SectionCard title="❌ Erros permitidos">
          <NumberInput
            label="Erros antes de encerrar (0 = nenhum)"
            value={settings.max_errors}
            min={0}
            max={99}
            onChange={val => update('max_errors', val)}
          />
        </SectionCard>

        <SectionCard title="🙋 Ajuda externa">
          <Row>
            <label className="settings-label">Permitir ajuda externa</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.allow_help_external} onChange={e => update('allow_help_external', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          {settings.allow_help_external && (
            <>
              <NumberInput
                label="Usos por partida"
                value={settings.max_help_external}
                min={1}
                max={10}
                onChange={val => update('max_help_external', val)}
              />
              <NumberInput
                label="Tempo de pausa do cronômetro (s)"
                value={settings.help_external_pause || 20}
                min={10}
                max={40}
                onChange={val => update('help_external_pause', val)}
              />
            </>
          )}
        </SectionCard>

        <SectionCard title="✂️ Eliminar respostas erradas">
          <Row>
            <label className="settings-label">Permitir eliminar respostas</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.allow_eliminate} onChange={e => update('allow_eliminate', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          {settings.allow_eliminate && (
            <NumberInput
              label="Usos por partida"
              value={settings.max_eliminate}
              min={1}
              max={10}
              onChange={val => update('max_eliminate', val)}
            />
          )}
        </SectionCard>

        <SectionCard title="🖼 Mostrar gravura como ajuda">
          <Row>
            <label className="settings-label">Permitir gravura</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.allow_image_hint} onChange={e => update('allow_image_hint', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          {settings.allow_image_hint && (
            <NumberInput
              label="Usos por partida"
              value={settings.max_image_hint}
              min={1}
              max={10}
              onChange={val => update('max_image_hint', val)}
            />
          )}
        </SectionCard>

        <SectionCard title="⏱ Cronômetro">
          <NumberInput
            label="Tempo por pergunta (segundos)"
            value={settings.timer_seconds}
            min={10}
            max={300}
            onChange={val => update('timer_seconds', val)}
          />
          <NumberInput
            label="Início do aviso de tempo (segundos)"
            value={settings.warning_seconds ?? 20}
            min={1}
            max={settings.timer_seconds - 1}
            onChange={val => update('warning_seconds', val)}
          />
          <Row>
            <label className="settings-label" title="Se ativado, o som normal do cronômetro não é pausado; ele continua junto com o aviso final.">Sobrepor som de aviso final</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!settings.warning_overlap} onChange={e => update('warning_overlap', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          <Row>
            <label className="settings-label">Encerrar automaticamente ao esgotar tempo</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.end_on_timeout} onChange={e => update('end_on_timeout', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>
          {settings.end_on_timeout && (
            <NumberInput
              label="Ocorrências permitidas antes de encerrar"
              value={settings.max_timeouts}
              min={1}
              max={10}
              onChange={val => update('max_timeouts', val)}
            />
          )}
        </SectionCard>

        <SectionCard title="📦 Perguntas por rodada">
          <NumberInput
            label="Total de perguntas"
            value={settings.questions_per_round}
            min={1}
            max={50}
            onChange={val => update('questions_per_round', val)}
          />
          <Row>
            <label className="settings-label">Modo de sorteio</label>
            <select className="settings-select" value={settings.sort_mode} onChange={e => update('sort_mode', e.target.value as any)}>
              <option value="gradativo">Gradativo por dificuldade</option>
              <option value="aleatorio">Aleatório</option>
            </select>
          </Row>
          {settings.sort_mode === 'gradativo' && (
            <div className="settings-difficulty-grid">
              {/* Grupo Fácil */}
              <div className="difficulty-group facil">
                <div className="difficulty-header">
                  <span className="dot facil"></span>
                  <span className="label">FÁCIL</span>
                </div>
                <div className="difficulty-inputs">
                  <NumberInput
                    label="Quantidade"
                    value={settings.qty_facil}
                    min={0}
                    max={settings.questions_per_round}
                    onChange={val => update('qty_facil', val)}
                  />
                  <NumberInput
                    label="Pontos"
                    value={settings.pts_facil ?? 5}
                    min={1}
                    max={100}
                    onChange={val => update('pts_facil', val)}
                  />
                </div>
              </div>

              {/* Grupo Médio */}
              <div className="difficulty-group medio">
                <div className="difficulty-header">
                  <span className="dot medio"></span>
                  <span className="label">MÉDIO</span>
                </div>
                <div className="difficulty-inputs">
                  <NumberInput
                    label="Quantidade"
                    value={settings.qty_medio}
                    min={0}
                    max={settings.questions_per_round}
                    onChange={val => update('qty_medio', val)}
                  />
                  <NumberInput
                    label="Pontos"
                    value={settings.pts_medio ?? 10}
                    min={1}
                    max={100}
                    onChange={val => update('pts_medio', val)}
                  />
                </div>
              </div>

              {/* Grupo Difícil */}
              <div className="difficulty-group dificil">
                <div className="difficulty-header">
                  <span className="dot dificil"></span>
                  <span className="label">DIFÍCIL</span>
                </div>
                <div className="difficulty-inputs">
                  <NumberInput
                    label="Quantidade"
                    value={settings.qty_dificil}
                    min={0}
                    max={settings.questions_per_round}
                    onChange={val => update('qty_dificil', val)}
                  />
                  <NumberInput
                    label="Pontos"
                    value={settings.pts_dificil ?? 22}
                    min={1}
                    max={100}
                    onChange={val => update('pts_dificil', val)}
                  />
                </div>
              </div>

              <div className="difficulty-summary">
                <p className="settings-hint">
                  Total configurado: <strong>{settings.qty_facil + settings.qty_medio + settings.qty_dificil}</strong>
                  {settings.qty_facil + settings.qty_medio + settings.qty_dificil !== settings.questions_per_round &&
                    <span className="settings-warning"> (Divergente de {settings.questions_per_round})</span>}
                </p>
                <p className="settings-hint highlight">
                  Pontuação máxima: <strong>{(settings.qty_facil * (settings.pts_facil ?? 5)) + (settings.qty_medio * (settings.pts_medio ?? 10)) + (settings.qty_dificil * (settings.pts_dificil ?? 22))} pts</strong>
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* PENALIDADES DE PONTUAÇÃO - somente admin */}
        {isAdmin && (
          <SectionCard title="⚠️ Penalidades de Pontuação">
            <p className="settings-hint" style={{ color: '#f5c842', marginBottom: '0.5rem' }}>
              🔒 Configuração exclusiva do administrador. Afeta todos os jogadores.
            </p>
            <NumberInput
              label="Desconto ao usar ajuda (% dos pontos)"
              value={settings.pts_help_penalty_pct ?? 50}
              min={0}
              max={100}
              onChange={val => update('pts_help_penalty_pct', val)}
            />
            <p className="settings-hint">Com 50%: uma pergunta de 22 pts vira 11 pts ao usar qualquer ajuda.</p>
            <NumberInput
              label="Penalidade por resposta errada (pts descontados)"
              value={settings.pts_wrong_penalty ?? 3}
              min={0}
              max={50}
              onChange={val => update('pts_wrong_penalty', val)}
            />
            <p className="settings-hint">O jogador perde esses pontos do total acumulado ao errar (mínimo 0).</p>
          </SectionCard>
        )}


        {/* EXPERIÊNCIA POR VOZ */}
        <SectionCard title="🗣️ Experiência por Voz">
          <Row>
            <div>
              <h3 style={{ margin: 0 }}>Ativar Narração por Voz</h3>
              <p className="settings-hint">Habilita a narração e permite ativar respostas por microfone.</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!settings.sounds?.tts_enabled} onChange={e => update('sounds', { ...settings.sounds, tts_enabled: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </Row>

          {settings.sounds?.tts_enabled && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              
              <h4 style={{ color: '#f5c842', marginBottom: '12px' }}>1. Voz e Tema</h4>

              <div style={{ marginBottom: '16px' }}>
                <Row>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Tema da Voz e Efeitos</h4>
                    <p className="settings-hint">Define o que o narrador diz em contagens, acertos e erros.</p>
                  </div>
                  {isAdmin && (
                    <button className="btn-action-outline" style={{ fontSize: '0.8rem', padding: '5px 10px' }} onClick={() => setShowVoiceManager(true)}>
                      ⚙️ Gerenciar
                    </button>
                  )}
                </Row>
                <div style={{ marginTop: '6px' }}>
                  <select
                    className="form-input"
                    value={settings.sounds?.voice_profile_id || ''}
                    onChange={e => update('sounds', { ...settings.sounds, voice_profile_id: e.target.value })}
                  >
                    <option value="">-- Padrão do Sistema --</option>
                    {voiceProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <label className="settings-label">Voz</label>
                <select className="settings-select" style={{ width: '100%' }}
                  value={settings.sounds?.tts_voice_uri !== undefined ? settings.sounds.tts_voice_uri : (ttsVoices.find(v => v.name === 'Google português do Brasil')?.voiceURI || '')}
                  onChange={e => update('sounds', { ...settings.sounds, tts_voice_uri: e.target.value })}>
                  <option value="">Padrão do Sistema</option>
                  {[...ttsVoices].sort((a, b) => {
                    const isBRPtA = a.lang === 'pt-BR' || a.lang.toLowerCase() === 'pt_br';
                    const isBRPtB = b.lang === 'pt-BR' || b.lang.toLowerCase() === 'pt_br';
                    if (isBRPtA && !isBRPtB) return -1;
                    if (!isBRPtA && isBRPtB) return 1;

                    const isPtA = a.lang.toLowerCase().startsWith('pt');
                    const isPtB = b.lang.toLowerCase().startsWith('pt');
                    if (isPtA && !isPtB) return -1;
                    if (!isPtA && isPtB) return 1;

                    return a.name.localeCompare(b.name);
                  }).map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <label className="settings-label">Velocidade</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <input
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={settings.sounds?.tts_rate || 1.1}
                    onChange={e => update('sounds', { ...settings.sounds, tts_rate: parseFloat(e.target.value) })}
                    style={{ flex: 1, minWidth: '0' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        const currentRate = settings.sounds?.tts_rate || 1.1;
                        const newRate = Math.max(0.5, currentRate - 0.1);
                        update('sounds', { ...settings.sounds, tts_rate: Number(newRate.toFixed(1)) });
                      }}
                      className="btn-step"
                      style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                    >−</button>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85em', minWidth: '38px', textAlign: 'center', color: '#fff' }}>
                      {(settings.sounds?.tts_rate || 1.1).toFixed(1)}x
                    </span>
                    <button
                      onClick={() => {
                        const currentRate = settings.sounds?.tts_rate || 1.1;
                        const newRate = Math.min(2.0, currentRate + 0.1);
                        update('sounds', { ...settings.sounds, tts_rate: Number(newRate.toFixed(1)) });
                      }}
                      className="btn-step"
                      style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                    >+</button>
                  </div>
                </div>
              </div>

              <button
                className="btn-action-outline"
                style={{ width: '100%', marginTop: '10px', fontSize: '0.85rem', marginBottom: '16px' }}
                onClick={() => {
                  if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance("Esta é uma demonstração da voz e da velocidade que você escolheu para o jogo.");
                    u.lang = 'pt-BR';
                    let uri = settings.sounds?.tts_voice_uri;
                    if (uri === undefined) {
                      const googleVoice = ttsVoices.find(v => v.name === 'Google português do Brasil');
                      if (googleVoice) uri = googleVoice.voiceURI;
                    }
                    const voice = ttsVoices.find(v => v.voiceURI === uri);
                    if (voice) u.voice = voice;
                    u.rate = settings.sounds?.tts_rate || 1.1;
                    window.speechSynthesis.speak(u);
                  }
                }}
              >
                🔊 Ouvir demonstração
              </button>

              <h4 style={{ color: '#f5c842', marginBottom: '12px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>2. Dinâmica do Jogo</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <Row>
                  <label className="settings-label">Narrar julgamento (Acerto/Erro)</label>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={!!settings.sounds?.tts_judge_answer} onChange={e => update('sounds', { ...settings.sounds, tts_judge_answer: e.target.checked })} />
                    <span className="toggle-slider" />
                  </label>
                </Row>

                <Row>
                  <label className="settings-label">Avançar automaticamente para próxima pergunta</label>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={!!settings.sounds?.tts_auto_next} onChange={e => update('sounds', { ...settings.sounds, tts_auto_next: e.target.checked })} />
                    <span className="toggle-slider" />
                  </label>
                </Row>
                
                {settings.sounds?.tts_auto_next && (
                  <NumberInput
                    label="Aguardar X segundos antes de avançar"
                    value={settings.sounds?.tts_auto_next_delay ?? 5}
                    min={1}
                    max={15}
                    onChange={val => update('sounds', { ...settings.sounds, tts_auto_next_delay: val })}
                  />
                )}
              </div>

              <h4 style={{ color: '#f5c842', marginBottom: '12px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>3. Respostas por Voz (Microfone)</h4>
              
              <Row>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Ativar Reconhecimento de Voz</h4>
                  <p className="settings-hint">Permite responder ou pular perguntas falando.</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={!!settings.sounds?.voice_input_enabled} onChange={e => update('sounds', { ...settings.sounds, voice_input_enabled: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              </Row>

              {settings.sounds?.voice_input_enabled && (
                <>
                  <button
                    onClick={() => setShowMicHelp(true)}
                    className="btn-action-outline"
                    style={{ width: '100%', padding: '10px', marginTop: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    🎤 Ver comandos de voz aceitos
                  </button>
                  <p className="settings-hint" style={{ marginTop: '6px', color: 'rgba(255,255,255,0.6)' }}>
                    O microfone será ativado automaticamente após a pergunta ser narrada. Ele fecha sozinho quando o timer atingir 15 segundos restantes.
                  </p>
                </>
              )}

              <div className="settings-col" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                <label className="settings-label">⏱️ Atraso de Resposta por Voz (Suspense)</label>
                <p className="settings-hint">Atrasa a revelação da resposta correta após a fala no microfone, criando suspense. Se maior que 0, tocará o som de suspense caso configurado abaixo.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={5}
                    step={1}
                    value={settings.sounds?.answer_suspense_time ?? 0}
                    onChange={e => update('sounds', { ...settings.sounds, answer_suspense_time: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer', flex: 1, minWidth: '0' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        const newTime = Math.max(0, (settings.sounds?.answer_suspense_time ?? 0) - 1);
                        update('sounds', { ...settings.sounds, answer_suspense_time: newTime });
                      }}
                      className="btn-step"
                      style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                    >−</button>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85em', minWidth: '24px', textAlign: 'center', color: '#fff' }}>{settings.sounds?.answer_suspense_time ?? 0}s</span>
                    <button
                      onClick={() => {
                        const newTime = Math.min(5, (settings.sounds?.answer_suspense_time ?? 0) + 1);
                        update('sounds', { ...settings.sounds, answer_suspense_time: newTime });
                      }}
                      className="btn-step"
                      style={{ width: '26px', height: '26px', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                    >+</button>
                  </div>
                </div>
                
                {/* Sons exclusivos admin: game_start e suspense */}
                {isAdmin && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {renderSoundSlot('game_start', '🎮 Som de Início de Jogo', 'Toca quando o jogador toca no botão "Iniciar" — também desbloqueia o áudio no iOS/Android')}
                    {renderSoundSlot('suspense', 'Som de Suspense na Voz', 'Toca após ouvir a resposta por voz, criando um clima de mistério até mostrar a tela de resultado')}
                  </div>
                )}

              </div>

            </div>
          )}
        </SectionCard>

        {/* ACESSIBILIDADE E FEEDBACK */}
        <SectionCard title="♿ Acessibilidade e Feedback">
          <Row>
            <div>
              <h3 style={{ margin: 0 }}>📳 Vibração Háptica</h3>
              <p className="settings-hint">Vibra ao selecionar, acertar ou errar (apenas Android).</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings.allow_vibration} onChange={e => update('allow_vibration', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </Row>

        </SectionCard>

        {/* ── ANIMAÇÃO DO AVATAR ── */}
        <SectionCard title="🎭 Animação do Avatar">
          {/* Toggle Emoji vs SVG */}
          <Row>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Modo de Animação</h3>
              <p className="settings-hint">Escolha entre emoticons animados ou avatar SVG personalizável.</p>
            </div>
          </Row>
          <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
            <button
              onClick={() => update('avatar_mode', 'emoji')}
              style={{
                flex: 1, padding: '10px 6px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                background: settings.avatar_mode === 'emoji' ? '#f5c842' : 'rgba(255,255,255,0.12)',
                color: settings.avatar_mode === 'emoji' ? '#000' : '#fff',
                transition: 'all 0.2s'
              }}
            >
              😄 Emoticons
            </button>
            <button
              onClick={() => update('avatar_mode', 'svg')}
              style={{
                flex: 1, padding: '10px 6px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                background: settings.avatar_mode === 'svg' ? '#f5c842' : 'rgba(255,255,255,0.12)',
                color: settings.avatar_mode === 'svg' ? '#000' : '#fff',
                transition: 'all 0.2s'
              }}
            >
              🧑 Avatar SVG
            </button>
          </div>

          <button
            onClick={() => setShowPreviews(!showPreviews)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#fff',
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: '10px',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
          >
            {showPreviews ? '👁️ Ocultar prévia das reações' : '👁️ Visualizar prévia das reações'}
          </button>

          {/* Preview da opção Emoticons Animados */}
          {settings.avatar_mode === 'emoji' && showPreviews && (
            <div style={{ marginTop: '12px' }}>
              <p className="settings-hint" style={{ marginBottom: '8px' }}>Prévia das reações (Emoticon):</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                {(['confiante', 'pensativo', 'preocupado', 'feliz', 'errou', 'triste', 'medo'] as AvatarMood[]).map(mood => (
                  <div key={mood} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '56px' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '50%',
                      width: '42px',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '1.4rem'
                    }}>
                      <EmoticonAnimated mood={mood} />
                    </div>
                    <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>{mood}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview e personalização do Avatar SVG */}
          {settings.avatar_mode === 'svg' && (
            <div style={{ marginTop: '12px' }}>
              {showPreviews && (
                <>
                  {/* Preview dos moods */}
                  <p className="settings-hint" style={{ marginBottom: '8px' }}>Prévia das reações:</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                    {(['pensativo', 'preocupado', 'feliz', 'errou', 'triste', 'medo'] as AvatarMood[]).map(mood => (
                      <div key={mood} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <AvatarAnimated
                          mood={mood}
                          skin={settings.avatar_skin ?? 'media'}
                          style={settings.avatar_style ?? 1}
                          glasses={settings.avatar_glasses ?? 0}
                          beard={settings.avatar_beard ?? 0}
                          eyeColor={settings.avatar_eye_color ?? '#1C0D00'}
                          hairColor={settings.avatar_hair_color ?? 'preto'}
                          size={54}
                        />
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)' }}>{mood}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Tom de Pele e Cor dos Olhos (Lado a Lado) */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                <fieldset style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: 0, minInlineSize: 0 }}>
                  <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Pele</legend>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-evenly', marginTop: '-10px', paddingTop: '12px' }}>
                    {([
                      { key: 'clara', label: 'Clara', color: '#FDDBB4' },
                      { key: 'media', label: 'Média', color: '#F0A96B' },
                      { key: 'morena', label: 'Morena', color: '#C8784A' },
                      { key: 'escura', label: 'Escura', color: '#7B4A2D' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        title={s.label}
                        onClick={() => update('avatar_skin', s.key)}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: s.color,
                          border: settings.avatar_skin === s.key
                            ? '2px solid #f5c842'
                            : '2px solid transparent',
                          cursor: 'pointer',
                          boxShadow: settings.avatar_skin === s.key
                            ? '0 0 0 1.5px rgba(245,200,66,0.4)'
                            : 'none',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: 0, minInlineSize: 0 }}>
                  <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Cor dos olhos</legend>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-evenly', marginTop: '-10px', paddingTop: '12px' }}>
                    {([
                      { key: '#1C0D00', label: 'Castanho/Preto', color: '#1C0D00' },
                      { key: '#2563EB', label: 'Azul', color: '#2563EB' },
                      { key: '#16A34A', label: 'Verde', color: '#16A34A' },
                      { key: '#D97706', label: 'Mel', color: '#D97706' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        title={s.label}
                        onClick={() => update('avatar_eye_color', s.key)}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: s.color,
                          border: settings.avatar_eye_color === s.key
                            ? '2px solid #f5c842'
                            : '1.5px solid rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          boxShadow: settings.avatar_eye_color === s.key
                            ? '0 0 0 1.5px rgba(245,200,66,0.4)'
                            : 'none',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* Cor do Cabelo e Chapéu (Lado a Lado) */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                <fieldset style={{ flex: 3, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: 0, minInlineSize: 0 }}>
                  <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Cor do cabelo</legend>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-evenly', marginTop: '-10px', paddingTop: '12px' }}>
                    {([
                      { key: 'preto', label: 'Preto', color: '#1E1E1E' },
                      { key: 'castanho', label: 'Castanho', color: '#4A2E1B' },
                      { key: 'loiro', label: 'Loiro', color: '#F2C94C' },
                      { key: 'ruivo', label: 'Ruivo', color: '#C44900' },
                      { key: 'grisalho', label: 'Grisalho', color: '#B0B0B0' },
                    ] as const).map(s => (
                      <button
                        key={s.key}
                        title={s.label}
                        onClick={() => update('avatar_hair_color', s.key)}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: s.color,
                          border: (settings.avatar_hair_color ?? 'preto') === s.key
                            ? '2px solid #f5c842'
                            : '1.5px solid rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          boxShadow: (settings.avatar_hair_color ?? 'preto') === s.key
                            ? '0 0 0 1.5px rgba(245,200,66,0.4)'
                            : 'none',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset style={{ flex: 2, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: 0, minInlineSize: 0 }}>
                  <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Chapéu</legend>
                  <div style={{ display: 'flex', gap: '3px', marginTop: '-10px', paddingTop: '12px' }}>
                    {([
                      { val: false, label: 'Não' },
                      { val: true, label: 'Sim' },
                    ] as const).map(s => {
                      let currentStyle = settings.avatar_style ?? 1;
                      const hasHat = currentStyle >= 10;
                      const hairStyle = currentStyle % 10;
                      const isSelected = hasHat === s.val;

                      return (
                        <button
                          key={s.label}
                          onClick={() => {
                            const nextVal = hairStyle + (s.val ? 10 : 0);
                            update('avatar_style', nextVal);
                          }}
                          style={{
                            flex: 1, padding: '3px 0', borderRadius: '4px', border: 'none',
                            cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                            background: isSelected ? '#f5c842' : 'rgba(255,255,255,0.12)',
                            color: isSelected ? '#000' : '#fff',
                            transition: 'all 0.2s'
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              {/* Estilo do Cabelo */}
              <fieldset style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: '0 0 4px 0', minInlineSize: 0 }}>
                <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Estilo do cabelo</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', marginTop: '-10px', paddingTop: '12px' }}>
                  {([
                    { val: 0, label: 'Sem' },
                    { val: 1, label: 'Curto' },
                    { val: 3, label: 'Tupete' },
                    { val: 2, label: 'Longo' },
                    { val: 5, label: 'Ondul.' },
                    { val: 6, label: 'Cachos' },
                    { val: 4, label: 'Black' },
                  ] as const).map(s => {
                    let currentStyle = settings.avatar_style ?? 1;
                    const hasHat = currentStyle >= 10;
                    const hairStyle = currentStyle % 10;
                    const isSelected = hairStyle === s.val;

                    return (
                      <button
                        key={s.val}
                        onClick={() => {
                          const nextVal = s.val + (hasHat ? 10 : 0);
                          update('avatar_style', nextVal);
                        }}
                        style={{
                          padding: '3px 0', borderRadius: '4px', border: 'none',
                          cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                          background: isSelected ? '#f5c842' : 'rgba(255,255,255,0.12)',
                          color: isSelected ? '#000' : '#fff',
                          transition: 'all 0.2s'
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Óculos */}
              <fieldset style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: '0 0 4px 0', minInlineSize: 0 }}>
                <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Óculos</legend>
                <div style={{ display: 'flex', gap: '3px', marginTop: '-10px', paddingTop: '12px' }}>
                  {([
                    { val: 0, label: 'Nenhum' },
                    { val: 1, label: 'Redondo' },
                    { val: 2, label: 'Quadrado' },
                    { val: 3, label: 'Escuro' },
                  ] as const).map(s => (
                    <button
                      key={s.val}
                      onClick={() => update('avatar_glasses', s.val)}
                      style={{
                        flex: 1, padding: '3px 0', borderRadius: '4px', border: 'none',
                        cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                        background: settings.avatar_glasses === s.val
                          ? '#f5c842'
                          : 'rgba(255,255,255,0.12)',
                        color: settings.avatar_glasses === s.val ? '#000' : '#fff',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Barba & Bigode */}
              <fieldset style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0 4px 4px 4px', margin: 0, minInlineSize: 0 }}>
                <legend style={{ fontSize: '0.65rem', color: '#f0f8c2ff', padding: '0 4px', marginLeft: '2px' }}>Barba & Bigode</legend>
                <div style={{ display: 'flex', gap: '3px', marginTop: '-10px', paddingTop: '12px' }}>
                  {([
                    { val: 0, label: 'Nenhum' },
                    { val: 1, label: 'Fina' },
                    { val: 2, label: 'Bigode' },
                    { val: 3, label: 'Cavanhaque' },
                  ] as const).map(s => (
                    <button
                      key={s.val}
                      onClick={() => update('avatar_beard', s.val)}
                      style={{
                        flex: 1, padding: '3px 0', borderRadius: '4px', border: 'none',
                        cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                        background: settings.avatar_beard === s.val
                          ? '#f5c842'
                          : 'rgba(255,255,255,0.12)',
                        color: settings.avatar_beard === s.val ? '#000' : '#fff',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </SectionCard>

        {/* Admin Only Configs */}
        {isAdmin && (
          <>
            <SectionCard title="💬 Mensagem do Sistema (admin)">
              <Row>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">Mensagem da Tela Inicial</label>
                  <p className="settings-hint">Esta mensagem será exibida na tela de login e na tela inicial para todos os usuários.</p>
                  <textarea
                    className="settings-number"
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      textAlign: 'left',
                      padding: '0.5rem',
                      minHeight: '100px',
                      resize: 'vertical',
                      fontWeight: 'normal',
                      fontSize: '0.85rem',
                      lineHeight: '1.4'
                    }}
                    value={settings.sounds.beta_message ?? 'Bem Vindo ao FunPlayB!'}
                    onChange={e => update('sounds', { ...settings.sounds, beta_message: e.target.value })}
                  />

                  <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1.5rem 0' }} />

                  <label className="settings-label">
                    Notas de Atualização (Versão atual: {VERSION_CONFIG.version})
                  </label>
                  <p className="settings-hint">Informe aqui o que mudou nesta versão. O texto aparecerá no pop-up para todos os usuários recém-atualizados.</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <button className="btn-tiny" onClick={handleSelectAllNotes} style={{ flex: 1, padding: '8px' }}>Selec. Tudo</button>
                    <button className="btn-tiny" onClick={handleCopyNotes} style={{ flex: 1, padding: '8px' }}>Copiar</button>
                    <button className="btn-tiny" onClick={handlePasteNotes} style={{ flex: 1, padding: '8px' }}>Colar</button>
                  </div>
                  <textarea
                    ref={releaseNoteRef}
                    className="settings-number"
                    style={{ width: '100%', textAlign: 'left', padding: '0.5rem', minHeight: '200px', resize: 'vertical', fontWeight: 'normal', fontSize: '0.85rem', lineHeight: '1.4' }}
                    value={releaseNoteText}
                    onChange={e => setReleaseNoteText(e.target.value)}
                    placeholder="Ex: Correção de bugs, melhorias no design, etc..."
                  />

                  <p className="settings-hint" style={{ color: '#f5c842', marginTop: '0.5rem' }}>
                    Essas alterações serão salvas quando você clicar no botão principal "Salvar configurações" lá embaixo.
                  </p>
                </div>
              </Row>
            </SectionCard>

            <SectionCard title="🤖 Prompt Padrão para IA (admin)">
              <Row>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">Prompt de Sugestão para IA</label>
                  <p className="settings-hint">
                    Este texto serve como base para a criação de perguntas em IAs (como ChatGPT, Gemini, Claude).
                    Ele será copiado quando os usuários clicarem no botão "Copiar prompt para IA" na tela de importação CSV.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <button className="btn-tiny" onClick={handleSelectAllPrompt} style={{ flex: 1, padding: '8px' }}>Selec. Tudo</button>
                    <button className="btn-tiny" onClick={handleCopyPromptText} style={{ flex: 1, padding: '8px' }}>Copiar</button>
                    <button className="btn-tiny" onClick={handlePastePromptText} style={{ flex: 1, padding: '8px' }}>Colar</button>
                  </div>
                  <textarea
                    ref={aiPromptRef}
                    className="settings-number"
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      textAlign: 'left',
                      padding: '0.5rem',
                      minHeight: '350px',
                      resize: 'vertical',
                      fontWeight: 'normal',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      fontFamily: 'monospace'
                    }}
                    value={settings.ai_import_prompt ?? ''}
                    placeholder="Insira aqui o prompt personalizado a ser disponibilizado para os usuários."
                    onChange={e => update('ai_import_prompt', e.target.value)}
                  />
                  <p className="settings-hint" style={{ color: '#f5c842', marginTop: '0.5rem' }}>
                    Lembre-se de salvar para persistir as alterações.
                  </p>
                </div>
              </Row>
            </SectionCard>

            <SectionCard title="🔊 Sons do jogo (admin)">

              {/* KILL SWITCH GLOBAL */}
              <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.4)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                <Row>
                  <div>
                    <h3 style={{ margin: 0, color: '#e74c3c' }}>🚫 Desativar Sons Globalmente</h3>
                    <p className="settings-hint" style={{ marginTop: '5px' }}>
                      Se ativado, bloqueia definitivamente <b>todos os sons</b> para todos os usuários do aplicativo, para melhorar a fluidez caso o servidor de som apresente lentidão.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={globalMute} onChange={e => toggleGlobalMute(e.target.checked)} />
                    <span className="toggle-slider" style={{ background: globalMute ? '#e74c3c' : undefined }} />
                  </label>
                </Row>
              </div>

              {globalMute && (
                <p className="settings-hint" style={{ textAlign: 'center', margin: '2rem 0', color: '#e74c3c' }}>
                  As configurações individuais de som estão ocultas pois os sons estão desativados globalmente.
                </p>
              )}

              {!globalMute && SOUND_SLOTS.map(({ key, label, desc }) => renderSoundSlot(key, label, desc))}
            </SectionCard>
          </>
        )}

        {msg && <p className="form-success">{msg}</p>}

        <button 
          className="btn-primary" 
          onClick={handleSave} 
          disabled={saving} 
          style={{ 
            marginTop: '20px', 
            marginBottom: '10px',
            backgroundColor: isDirty ? '#f5c842' : '#4caf50',
            color: isDirty ? '#333' : '#fff',
            borderColor: isDirty ? '#e5b832' : '#4caf50',
            transition: 'background-color 0.3s ease'
          }}
        >
          {saving ? 'Salvando...' : '💾 Salvar configurações'}
        </button>

        {isAdmin ? (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <button
                className="btn-secondary"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '1rem',
                  padding: '12px 5px',
                  lineHeight: '1.3'
                }}
                onClick={handleRestoreDefaults}
                disabled={saving}
              >
                🔄 Restaurar<br />valores padrão
              </button>
              <button
                className="btn-secondary"
                style={{
                  flex: 1,
                  background: 'rgba(245, 200, 66, 0.15)',
                  color: '#f5c842',
                  border: '1px solid rgba(245, 200, 66, 0.4)',
                  fontSize: '1rem',
                  padding: '12px 5px',
                  lineHeight: '1.3'
                }}
                onClick={handleSaveGlobalDefaults}
                disabled={saving}
              >
                ⭐ Gravar<br />padrão global
              </button>
            </div>
            <button
              className="btn-secondary"
              style={{
                width: '100%',
                marginBottom: '30px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#5a4446ff',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontSize: '0.9rem',
                padding: '8px 10px',
                lineHeight: '1.3'
              }}
              onClick={handleRestoreAllUsersDefaults}
              disabled={saving}
            >
              🚨 Aplicar padrão global a todos os usuários imediatamente
            </button>
          </>
        ) : (
          <button
            className="btn-secondary"
            style={{
              marginBottom: '30px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '1.2rem',
              padding: '15px 10px',
              lineHeight: '1.3'
            }}
            onClick={handleRestoreDefaults}
            disabled={saving}
          >
            🔄 Restaurar<br />valores padrão
          </button>
        )}
      </div>
      
      {showVoiceManager && (
        <VoiceProfileManager 
          onClose={() => setShowVoiceManager(false)} 
          onUpdate={() => {
            if (!supabase) return;
            supabase.from('voice_profiles').select('*').order('name').then(({data}) => {
              if (data) setVoiceProfiles(data);
            });
          }} 
        />
      )}

      {showMicHelp && (
        <MicHelpModal
          onClose={() => setShowMicHelp(false)}
        />
      )}
    </div>
  );
}
