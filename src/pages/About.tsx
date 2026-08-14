import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';

/* ─── Tipos ────────────────────────────────────────────────── */
interface AppSettings {
  about_game_text: string;
  dev_name: string;
  dev_email: string;
  dev_phone: string;
  dev_site: string;
  admin_whatsapp: string;
  show_dev_site: string;
}

interface ContactMessage {
  id: string;
  player_id: string;
  player_nickname: string;
  subject: string;
  message: string;
  is_read: boolean;
  reply: string | null;
  replied_at: string | null;
  reply_read: boolean;
  created_at: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  about_game_text: 'Carregando...',
  dev_name: '—',
  dev_email: '—',
  dev_phone: '—',
  dev_site: '—',
  admin_whatsapp: '',
  show_dev_site: 'true',
};

/* ─── Helper: formata data ─────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ─── Modal de edição simples ──────────────────────────────── */
function EditModal({ title, fields, onSave, onClose, large }: {
  title: string;
  fields: { key: string; label: string; value: string; multiline?: boolean; type?: 'text' | 'checkbox' }[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  large?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(values);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-box" 
        onClick={e => e.stopPropagation()}
        style={large ? { maxWidth: '750px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' } : undefined}
      >
        <h3 className="modal-title">✏️ {title}</h3>
        {fields.map(f => (
          <div key={f.key} className="form-group" style={large ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}>
            <label className="form-label">{f.label}</label>
            {f.type === 'checkbox' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
                <input
                  type="checkbox"
                  style={{ width: '1.2rem', height: '1.2rem' }}
                  checked={values[f.key] === 'true'}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.checked ? 'true' : 'false' }))}
                />
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Habilitar</span>
              </div>
            ) : f.multiline ? (
              <textarea
                className="form-input"
                rows={large ? 18 : 5}
                value={values[f.key]}
                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ 
                  resize: 'vertical',
                  flex: large ? 1 : undefined,
                  minHeight: large ? '350px' : 'auto',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  lineHeight: '1.4'
                }}
              />
            ) : (
              <input
                className="form-input"
                value={values[f.key]}
                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <div className="modal-actions" style={{ 
          marginTop: '1rem',
          display: 'flex',
          flexDirection: 'row',
          gap: '10px'
        }}>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={saving}
            style={{
              flex: 1,
              padding: '8px 16px',
              fontSize: '0.9rem',
              margin: 0,
              minHeight: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button 
            className="btn-secondary" 
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              fontSize: '0.9rem',
              margin: 0,
              minHeight: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página Principal ─────────────────────────────────────── */
export default function About() {
  const { session, isAdmin } = useAuth();
  const location = useLocation();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [editModal, setEditModal] = useState<null | 'game' | 'dev' | 'contact' | 'privacy'>(null);

  // States para o prompt de IA
  const [aiImportPrompt, setAiImportPrompt] = useState<string>('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Termos e Privacidade
  const [privacyPolicy, setPrivacyPolicy] = useState('Carregando...');
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);

  // Formulário de contato (jogador)
  const [subject, setSubject] = useState('');
  const [msgType, setMsgType] = useState('Sugestão');
  const [msgText, setMsgText] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'ok' | 'error' | null>(null);

  // Mensagens do jogador
  const [myMessages, setMyMessages] = useState<ContactMessage[]>([]);
  const [myNotifications, setMyNotifications] = useState<any[]>([]);

  // Caixa de entrada (admin)
  const [allMessages, setAllMessages] = useState<ContactMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File[]>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [activeAdminMsg, setActiveAdminMsg] = useState<string | null>(null);

  /* ── Carregar configurações ── */
  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
        setSettings(prev => ({ ...prev, ...map }));
      }
    } catch { /* tabela pode não existir ainda */ }
    setSettingsLoaded(true);
  }, []);

  /* ── Carregar Política de Privacidade e Termos de Uso ── */
  const loadPrivacyPolicy = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('app_policies')
        .select('content')
        .eq('policy_type', 'privacy_policy_terms')
        .maybeSingle();
      if (data) {
        setPrivacyPolicy(data.content);
      }
    } catch (err) {
      console.error('Erro ao buscar política de privacidade:', err);
    }
  }, []);

  /* ── Carregar mensagens do jogador ── */
  const loadMyMessages = useCallback(async () => {
    if (!supabase || !session) return;
    try {
      const { data } = await supabase
        .from('contact_messages')
        .select('*')
        .eq('player_id', session.player_id)
        .order('created_at', { ascending: true });
      setMyMessages((data as ContactMessage[]) ?? []);

      // Marca respostas como lidas
      const unreadReplies = (data as ContactMessage[])?.filter(m => m.reply && !m.reply_read);
      if (unreadReplies && unreadReplies.length > 0) {
        await supabase
          .from('contact_messages')
          .update({ reply_read: true })
          .eq('player_id', session.player_id)
          .not('reply', 'is', null);
      }
    } catch { /* tabela ou coluna nova pode não existir ainda */ }
  }, [session]);

  /* ── Carregar notificações do sistema (jogador) ── */
  const loadMyNotifications = useCallback(async () => {
    if (!supabase || !session) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('player_id', session.player_id)
        .order('created_at', { ascending: true });
      setMyNotifications(data ?? []);
    } catch { /* tabela pode não existir ainda */ }
  }, [session]);

  /* ── Carregar todas as mensagens (admin) ── */
  const loadAllMessages = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    try {
      const { data } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: true });
      const msgs = (data as ContactMessage[]) ?? [];
      setAllMessages(msgs);
      setUnreadCount(msgs.filter(m => !m.is_read).length);
    } catch { /* tabela pode não existir ainda */ }
  }, [isAdmin]);

  /* ── Admin: Limpeza automática (> 30 dias) ── */
  const cleanupOldMessages = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .not('replied_at', 'is', null)
        .lt('replied_at', thirtyDaysAgo.toISOString());
      
      if (!error) console.log('🧹 Limpeza de mensagens antigas concluída.');
    } catch { /* erro silencioso */ }
  }, [isAdmin]);

  useEffect(() => {
    loadSettings();
    loadPrivacyPolicy();
    loadMyMessages();
    loadMyNotifications();
    loadAllMessages();
    if (isAdmin) cleanupOldMessages();

    // Parse URL para auto-preencher resposta de notificação
    const params = new URLSearchParams(location.search);
    const replyRef = params.get('replyRef');
    if (replyRef) {
      setMsgType('Resposta ao Admin');
      setSubject(`Ref: ${replyRef}`);
      setTimeout(() => {
        const formEl = document.getElementById('contact-form-section');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }

    // Fetch custom AI prompt from global defaults settings
    if (supabase) {
      (async () => {
        try {
          const { data } = await supabase.from('game_settings')
            .select('ai_import_prompt')
            .eq('player_id', '00000000-0000-0000-0000-000000000000')
            .maybeSingle();
          if (data?.ai_import_prompt) {
            setAiImportPrompt(data.ai_import_prompt);
          } else {
            setAiImportPrompt('');
          }
        } catch (err) {
          console.error('Erro ao carregar prompt no About:', err);
        }
      })();
    }
  }, [loadSettings, loadPrivacyPolicy, loadMyMessages, loadMyNotifications, loadAllMessages, isAdmin, cleanupOldMessages, location.search]);

  /* ── Salvar configuração no banco ── */
  const saveSetting = async (values: Record<string, string>) => {
    if (!supabase) return;
    for (const [key, value] of Object.entries(values)) {
      await supabase.from('app_settings').upsert({ key, value });
    }
    await loadSettings();
  };

  /* ── Salvar política de privacidade no banco ── */
  const savePrivacyPolicy = async (values: Record<string, string>) => {
    if (!supabase) return;
    const content = values.privacyPolicy;
    const { error } = await supabase
      .from('app_policies')
      .upsert({ policy_type: 'privacy_policy_terms', content }, { onConflict: 'policy_type' });
    
    if (error) {
      console.error('Erro ao salvar termos/política:', error);
      alert('❌ Erro ao salvar termos!');
    } else {
      setPrivacyPolicy(content);
    }
  };

  /* ── Enviar mensagem ── */
  const handleSend = async () => {
    if (!supabase || !session || !subject.trim() || !msgText.trim()) return;
    setSending(true);
    try {
      let finalMsg = msgText.trim();
      
      // Upload de anexos (máximo 3)
      if (attachmentFiles.length > 0) {
        for (const file of attachmentFiles) {
          const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const fileName = `${session.player_id}_${Date.now()}_${safeName}`;
          const filePath = `attachments/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('question-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('question-images')
            .getPublicUrl(filePath);

          finalMsg += `\n\n📎 ANEXO: ${publicUrl}`;
        }
      }

      const { error } = await supabase.from('contact_messages').insert({
        player_id: session.player_id,
        player_nickname: session.nickname,
        subject: `[${msgType}] ${subject.trim()}`,
        message: finalMsg,
      });

      if (error) throw error;
      setSubject('');
      setMsgText('');
      setMsgType('Sugestão');
      setAttachmentFiles([]);
      setSendResult('ok');
      await loadMyMessages();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setSendResult('error');
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 4000);
    }
  };

  /* ── Admin: responder mensagem ── */
  const handleReply = async (msgId: string) => {
    let reply = replyText[msgId]?.trim();
    const files = replyFiles[msgId] || [];
    if (!supabase || (!reply && files.length === 0)) return;
    setReplying(msgId);
    try {
      // Upload de anexos da resposta se existirem
      if (files.length > 0) {
        for (const file of files) {
          const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const fileName = `reply_${msgId}_${Date.now()}_${safeName}`;
          const filePath = `attachments/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('question-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('question-images')
            .getPublicUrl(filePath);

          reply += `\n\n📎 ANEXO: ${publicUrl}`;
        }
      }

      await supabase.from('contact_messages').update({
        reply,
        replied_at: new Date().toISOString(),
        is_read: true,
      }).eq('id', msgId);
      
      setReplyText(prev => ({ ...prev, [msgId]: '' }));
      setReplyFiles(prev => ({ ...prev, [msgId]: [] }));
      setActiveAdminMsg(null);
      await loadAllMessages();
    } catch (err) {
      console.error('Erro ao responder:', err);
    }
    setReplying(null);
  };

  /* ── Admin: marcar como lida ── */
  const handleMarkRead = async (msgId: string) => {
    if (!supabase) return;
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', msgId);
    await loadAllMessages();
  };

  /* ── Admin: apagar uma mensagem ── */
  const handleDeleteMessage = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!supabase || !window.confirm('Deseja realmente apagar esta mensagem?')) return;
    try {
      await supabase.from('contact_messages').delete().eq('id', msgId);
      await loadAllMessages();
    } catch { /* erro silencioso */ }
  };

  const handleCopyPrompt = () => {
    const promptText = aiImportPrompt ? aiImportPrompt.trim() : '';
    if (!promptText) {
      alert('⚠️ Nenhum prompt foi configurado nos ajustes.');
      return;
    }
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    alert('📋 Prompt copiado com sucesso! Agora você pode colar na conversa com a sua IA.');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  /* ── Link WhatsApp ── */
  const whatsappLink = settings.admin_whatsapp
    ? `https://wa.me/${settings.admin_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Sou ${session?.nickname ?? 'um jogador'} e gostaria de entrar em contato sobre o FunPlayB.`)}`
    : null;

  /* ── Helper: Renderiza corpo da mensagem com pílula de anexo ── */
  const renderMessageBody = (text: string) => {
    const parts = text.split('\n\n📎 ANEXO: ');
    const body = parts[0];
    const attachmentUrls = parts.slice(1);

    return (
      <>
        <p className="about-msg-body">{body}</p>
        {attachmentUrls.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {attachmentUrls.map((url, i) => (
              <a 
                key={i}
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="attachment-pill"
                title={`Clique para abrir o anexo ${i + 1}`}
              >
                {url.split('_').pop() || `Anexo ${i + 1}`}
              </a>
            ))}
          </div>
        )}
      </>
    );
  };

  /* ── Helper: Renderiza assunto com destaque no tipo ── */
  const renderSubject = (fullSubject: string) => {
    const match = fullSubject.match(/^\[(.*?)\] (.*)$/);
    if (match) {
      return (
        <>
          <span className="msg-type-tag">[{match[1]}]</span>
          <span>{match[2]}</span>
        </>
      );
    }
    return fullSubject;
  };

  return (
    <div className="page-screen">

      {/* ── 1. COMO JOGAR ── */}
      <section className="about-section">
        <h2 className="about-section-title">📖 Como Jogar</h2>
        <div className="about-card">
          <div className="about-rule-list">
            <div className="about-rule-item">
              <span className="about-rule-icon">🎯</span>
              <span>Selecione um <strong>tema</strong> e inicie a partida</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">⏱️</span>
              <span>Cada pergunta tem um <strong>tempo limite</strong> configurável</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">✅</span>
              <span>Acertos somam pontos; erros descontam conforme a dificuldade</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🆘</span>
              <span>Use <strong>ajudas</strong>: Pular, Eliminar 2, Dica e Ajuda externa</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🏆</span>
              <span>Ao final veja seu resultado e compare no <strong>Ranking Global</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 1B. SISTEMA DE VOZ E MICROFONE ── */}
      <section className="about-section">
        <h2 className="about-section-title">🎙️ Sistema de Voz e Microfone</h2>
        <div className="about-card">
          <div className="about-faq-item">
            <p className="about-faq-q">O que é a Experiência por Voz?</p>
            <p className="about-faq-a">
              Quando ativada nas <strong>Configurações → Experiência por Voz</strong>, o jogo narra as perguntas e opções em voz alta usando o sintetizador de fala do seu dispositivo (TTS). Você também pode ativar respostas por microfone para jogar sem tocar na tela.
            </p>
          </div>

          <div className="about-faq-item" style={{ marginTop: '1rem' }}>
            <p className="about-faq-q">🔔 Por que aparece o botão "▶ Toque para Iniciar"?</p>
            <p className="about-faq-a">
              Em celulares (<strong>iOS e Android</strong>), os navegadores bloqueiam áudio e voz até que o usuário toque na tela. Esse botão serve justamente para desbloquear o sistema de áudio — sem ele, a narração não funcionaria. Após tocá-lo, a contagem regressiva (3, 2, 1…) inicia normalmente.
            </p>
          </div>

          <div className="about-faq-item" style={{ marginTop: '1rem' }}>
            <p className="about-faq-q">🎤 Por que o app pede permissão de microfone?</p>
            <p className="about-faq-a">
              A permissão é solicitada quando a opção <strong>"Respostas por Voz (Microfone)"</strong> está ativa. O microfone é usado para capturar sua resposta falada (ex: "letra A"). No <strong>iOS</strong>, a permissão é pedida a cada sessão; no <strong>Android</strong>, após conceder uma vez, o navegador lembra automaticamente.
            </p>
          </div>

          <div className="about-faq-item" style={{ marginTop: '1rem' }}>
            <p className="about-faq-q">⏱️ Quando o microfone fica ativo durante o jogo?</p>
            <div className="about-rule-list" style={{ marginTop: '0.5rem' }}>
              <div className="about-rule-item">
                <span className="about-rule-icon">1️⃣</span>
                <span>A pergunta é narrada em voz alta.</span>
              </div>
              <div className="about-rule-item">
                <span className="about-rule-icon">2️⃣</span>
                <span>Após a narração, o app fala: <em>"Pode responder"</em>.</span>
              </div>
              <div className="about-rule-item">
                <span className="about-rule-icon">3️⃣</span>
                <span>O microfone abre automaticamente com um contador visual.</span>
              </div>
              <div className="about-rule-item">
                <span className="about-rule-icon">4️⃣</span>
                <span>Fale a letra da resposta (ex: <strong>"letra B"</strong>) ou repita uma ou mais palavras contidas no texto da opção escolhida, ou use um comando (<strong>"pular"</strong>, <strong>"eliminar"</strong>, <strong>"ajuda"</strong>).</span>
              </div>
            </div>
          </div>

          <div className="about-faq-item" style={{ marginTop: '1rem' }}>
            <p className="about-faq-q">📵 E se eu não quiser usar a voz?</p>
            <p className="about-faq-a">
              Basta deixar a <strong>Experiência por Voz desativada</strong> nas configurações. O jogo funciona normalmente sem narração e sem microfone — você responde tocando nas alternativas como de costume. O avanço automático de perguntas também <strong>só ocorre com a voz ativada</strong>.
            </p>
          </div>

          <div className="about-faq-item" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <p className="about-faq-a" style={{ fontSize: '0.85rem', color: '#f5c842' }}>
              ⚠️ <strong>Importante:</strong> O sistema de voz depende do sintetizador de fala instalado no seu dispositivo. Se a narração não funcionar, verifique se o idioma <strong>Português (Brasil)</strong> está instalado nas configurações de acessibilidade do seu celular.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. CUSTOMIZAÇÕES ── */}
      <section className="about-section">
        <h2 className="about-section-title">⚙️ Personalizações</h2>
        <div className="about-card">
          <div className="about-rule-list">
            <div className="about-rule-item">
              <span className="about-rule-icon">📝</span>
              <span>Crie e envie <strong>suas próprias perguntas</strong> para aprovação</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🏷️</span>
              <span>Importe perguntas em <strong>lote via CSV</strong></span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🎚️</span>
              <span>Configure <strong>dificuldade e quantidade</strong> de perguntas por partida</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🖼️</span>
              <span>Adicione <strong>imagens</strong> às perguntas para enriquecer o conteúdo</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🔒</span>
              <span>Marque temas como <strong>privados/exclusivos</strong> para que apareçam apenas para você (criador) e administradores</span>
            </div>
            <div className="about-rule-item">
              <span className="about-rule-icon">🔄</span>
              <span>Reinicie o progresso de temas para jogar <strong>perguntas novamente</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2B. CRIAÇÃO DE PERGUNTAS COM IA ── */}
      <section className="about-section">
        <h2 className="about-section-title">🤖 Criação de Perguntas com IA</h2>
        <div className="about-card">
          <p className="about-text" style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.45', color: 'rgba(255,255,255,0.85)' }}>
            É possível criar perguntas para o jogo utilizando a IA de sua preferência. Para facilitar esse processo, fornecemos um prompt semi-pronto para ser adaptado. Clique no botão abaixo para acessar o prompt e obter mais instruções.
          </p>
          <button 
            className="btn-primary" 
            style={{ 
              width: '100%', 
              marginTop: '1rem', 
              padding: '10px', 
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
              color: '#fff',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)',
              cursor: 'pointer'
            }}
            onClick={() => setShowPromptModal(true)}
          >
            🤖 Copiar prompt para IA
          </button>
        </div>
      </section>

      {/* ── 3. DINÂMICA DE CRIAÇÃO DE PERGUNTAS ── */}
      <section className="about-section">
        <h2 className="about-section-title">❓ Dinâmica de criação de perguntas</h2>
        <div className="about-card">
          <div className="about-faq-item">
            <p className="about-faq-q">Por que não visualizo nenhuma pergunta na tela de administração de perguntas?</p>
            <p className="about-faq-a">
              Nesta tela, você visualiza apenas as <strong>perguntas que você mesmo criou</strong>. 
              Isso garante que cada colaborador gerencie suas próprias contribuições de forma organizada.
            </p>
          </div>
          <div className="about-faq-item" style={{ marginTop: '1rem' }}>
            <p className="about-faq-q">Como funciona o fluxo de aprovação?</p>
            <div className="about-rule-list" style={{ marginTop: '0.5rem' }}>
              <div className="about-rule-item">
                <span className="about-rule-icon">1️⃣</span>
                <span><strong>Criação:</strong> Você envia a pergunta e ela fica como <em>Pendente</em>.</span>
              </div>
              <div className="about-rule-item">
                <span className="about-rule-icon">2️⃣</span>
                <span><strong>Revisão:</strong> Um administrador avalia o conteúdo enviado.</span>
              </div>
              <div className="about-rule-item">
                <span className="about-rule-icon">3️⃣</span>
                <span><strong>Ativação:</strong> Uma vez <em>Aprovada</em>, ela entra oficialmente no rodízio do jogo.</span>
              </div>
            </div>
          </div>
          <div className="about-faq-item" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <p className="about-faq-a" style={{ fontSize: '0.85rem', color: '#f5c842' }}>
              ⚠️ <strong>Atenção:</strong> Toda vez que você <strong>editar</strong> uma pergunta que já estava aprovada, 
              ela voltará automaticamente para o status <em>Pendente</em> para que um administrador valide a alteração antes de ela voltar a ficar ativa.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. SOBRE O JOGO ── */}
      <section className="about-section">
        <div className="about-section-header">
          <h2 className="about-section-title">🎮 Sobre o Jogo</h2>
          {isAdmin && settingsLoaded && (
            <button className="about-edit-btn" onClick={() => setEditModal('game')}>✏️ Editar</button>
          )}
        </div>
        <div className="about-card">
          <p className="about-text">{settings.about_game_text}</p>
        </div>
      </section>

      {/* ── 4B. POLÍTICA DE PRIVACIDADE E DIREITOS AUTORAIS ── */}
      <section className="about-section">
        <div className="about-section-header">
          <h2 className="about-section-title">🔒 Termos de Uso e Privacidade</h2>
          {isAdmin && settingsLoaded && (
            <button className="about-edit-btn" onClick={() => setEditModal('privacy')}>✏️ Editar</button>
          )}
        </div>
        <div className="about-card" style={{ padding: '12px' }}>
          {!isPrivacyExpanded ? (
            <div style={{ position: 'relative' }}>
              <p style={{
                margin: 0,
                fontSize: '0.88rem',
                lineHeight: '1.45',
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'justify',
                height: '75px',
                overflow: 'hidden'
              }}>
                {privacyPolicy}
              </p>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '40px',
                background: 'linear-gradient(to bottom, rgba(123, 63, 160, 0), rgba(255, 255, 255, 0.05))',
                pointerEvents: 'none'
              }} />
              <button 
                onClick={() => setIsPrivacyExpanded(true)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  background: 'rgba(245, 200, 66, 0.15)',
                  border: '1.5px solid rgba(245, 200, 66, 0.3)',
                  color: '#f5c842',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ▼ Ler Termos Completos
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '10px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'justify',
                fontSize: '0.88rem',
                lineHeight: '1.5',
                color: 'rgba(255,255,255,0.95)',
                whiteSpace: 'pre-wrap'
              }}>
                {privacyPolicy}
              </div>
              <button 
                onClick={() => setIsPrivacyExpanded(false)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '6px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ▲ Recolher Termos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. DESENVOLVEDOR ── */}
      <section className="about-section">
        <div className="about-section-header">
          <h2 className="about-section-title">👨‍💻 Desenvolvedor</h2>
          {isAdmin && settingsLoaded && (
            <button className="about-edit-btn" onClick={() => setEditModal('dev')}>✏️ Editar</button>
          )}
        </div>
        <div className="about-card about-dev-card">
          <div className="about-dev-row">
            <span className="about-dev-icon">👤</span>
            <span>{settings.dev_name}</span>
          </div>
           {settings.dev_email && settings.dev_email !== '—' && (
            <div className="about-dev-row">
              <span className="about-dev-icon">📧</span>
              <a href={`mailto:${settings.dev_email}`} className="about-link">{settings.dev_email}</a>
            </div>
          )}
          {settings.dev_phone && settings.dev_phone !== '—' && (
            <div className="about-dev-row">
              <span className="about-dev-icon">📱</span>
              <a 
                href={`https://wa.me/${settings.dev_phone.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="about-link"
              >
                {settings.dev_phone}
              </a>
            </div>
          )}
          {settings.dev_site && settings.dev_site !== '—' && settings.show_dev_site === 'true' && (
            <div className="about-dev-row">
              <span className="about-dev-icon">🌐</span>
              <a href={settings.dev_site} target="_blank" rel="noopener noreferrer" className="about-link">{settings.dev_site}</a>
            </div>
          )}
        </div>
      </section>

      {/* ── 5. CONTATO ── */}
      <section className="about-section">
        <div className="about-section-header">
          <h2 className="about-section-title">📬 Falar com o Desenvolvedor</h2>
          {isAdmin && settingsLoaded && (
            <button className="about-edit-btn" onClick={() => setEditModal('contact')}>✏️ Editar contato</button>
          )}
        </div>

        {/* WhatsApp */}
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="about-whatsapp-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.115 1.524 5.845L.057 23.272a.5.5 0 0 0 .671.671l5.432-1.467A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.587-.5-5.076-1.367l-.363-.214-3.761 1.015 1.015-3.756-.222-.373A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Chamar no WhatsApp
          </a>
        )}

        {/* Formulário de mensagem interna */}
        <div id="contact-form-section" className="about-card" style={{ marginTop: '0.75rem' }}>
          <p className="about-contact-label">Ou envie uma mensagem:</p>
          
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem', opacity: 0.8 }}>Tipo de mensagem</label>
            <select 
              className="settings-select" 
              value={msgType} 
              onChange={e => setMsgType(e.target.value)}
              style={{ marginBottom: '0.8rem', width: '100%', padding: '0.6rem' }}
            >
              <option value="Elogio">🌟 Elogio</option>
              <option value="Sugestão">💡 Sugestão</option>
              <option value="Reportar um erro">🐞 Reportar um erro</option>
              <option value="Dúvidas">❓ Dúvidas</option>
              <option value="Resposta ao Admin">💬 Resposta ao Admin</option>
              <option value="Outros">⚙️ Outros</option>
            </select>
          </div>

          <div className="form-group">
            <input
              className="form-input"
              placeholder="Assunto"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="form-group">
            <textarea
              className="form-input"
              placeholder="Sua mensagem..."
              rows={4}
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem', opacity: 0.8 }}>Anexar arquivos (até 3 - imagem, pdf, txt, etc.)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <label className="btn-action-outline" style={{ flex: 1, margin: 0, cursor: 'pointer', padding: '8px 12px', fontSize: '0.85rem', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {attachmentFiles.length > 0 ? '➕ Adicionar' : '📁 Escolher arquivos'}
                  <input 
                    type="file" 
                    multiple
                    style={{ display: 'none' }} 
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      setAttachmentFiles(files.slice(0, 3));
                    }}
                    accept="image/*,.pdf,.txt,.xlsx,.xls,.doc,.docx"
                  />
                </label>
                {attachmentFiles.length > 0 && (
                  <button 
                    className="btn-action-outline" 
                    style={{ flex: 1, color: '#ff6b6b', borderColor: '#ff6b6b', padding: '8px 12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}
                    onClick={() => setAttachmentFiles([])}
                  >
                    🗑️ Limpar
                  </button>
                )}
              </div>
              {attachmentFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {attachmentFiles.map((f, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={handleSend}
            disabled={sending || !subject.trim() || !msgText.trim()}
          >
            {sending ? 'Enviando...' : '📤 Enviar Mensagem'}
          </button>
          {sendResult === 'ok' && <p className="about-feedback-ok">✅ Mensagem enviada com sucesso!</p>}
          {sendResult === 'error' && <p className="about-feedback-err">❌ Erro ao enviar. Tente novamente.</p>}
        </div>

        {/* Histórico Unificado (Mensagens e Notificações) */}
        {(myMessages.length > 0 || myNotifications.length > 0) && (
          <div style={{ marginTop: '1.5rem' }}>
            <p className="about-contact-label" style={{ marginBottom: '0.5rem' }}>🕒 Histórico de Conversas:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                const combined = [
                  ...myMessages.map(m => ({ ...m, _type: 'message', _date: new Date(m.created_at).getTime() })),
                  ...myNotifications.map(n => ({ ...n, _type: 'notification', _date: new Date(n.created_at).getTime() }))
                ].sort((a, b) => a._date - b._date);

                return combined.map((item: any) => {
                  if (item._type === 'message') {
                    const m = item as ContactMessage;
                    return (
                      <div key={`msg-${m.id}`} className="about-msg-card" style={{ 
                        marginLeft: 'auto',
                        width: '90%',
                        borderRight: '4px solid #2ecc71',
                        background: 'rgba(46, 204, 113, 0.15)'
                      }}>
                        <div className="about-msg-header">
                          <span className="about-msg-subject">{renderSubject(m.subject)}</span>
                          <span className="about-msg-date">{fmtDate(m.created_at)}</span>
                        </div>
                        {renderMessageBody(m.message)}
                        {m.reply ? (
                          <div className="about-msg-reply" style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid rgba(255,255,255,0.2)' }}>
                            <span className="about-msg-reply-label">💬 Resposta do Admin:</span>
                            {renderMessageBody(m.reply)}
                            <span className="about-msg-date">{fmtDate(m.replied_at!)}</span>
                          </div>
                        ) : (
                          <p className="about-msg-pending" style={{ color: '#2ecc71', fontWeight: 'bold' }}>⏳ Aguardando resposta...</p>
                        )}
                      </div>
                    );
                  } else {
                    const n = item;
                    return (
                      <div key={`notif-${n.id}`} className="about-msg-card" style={{ 
                        marginRight: 'auto',
                        width: '90%',
                        borderLeft: '4px solid #f1c40f',
                        background: 'rgba(241, 196, 15, 0.15)'
                      }}>
                        <div className="about-msg-header">
                          <span className="about-msg-subject">📢 {n.title}</span>
                          <span className="about-msg-date">{fmtDate(n.created_at)}</span>
                        </div>
                        <p className="about-msg-body" style={{ whiteSpace: 'pre-wrap' }}>{n.message}</p>
                        
                        <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-action-outline" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#f1c40f', color: '#f1c40f' }}
                            onClick={() => {
                              setMsgType('Resposta ao Admin');
                              setSubject(`Ref: ${n.title}`);
                              document.getElementById('contact-form-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            Responder
                          </button>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          </div>
        )}
      </section>

      {/* ── 6. CAIXA DE ENTRADA (apenas admin) ── */}
      {isAdmin && (
        <section className="about-section">
          <div className="about-section-header">
            <h2 className="about-section-title">
              📥 Caixa de Mensagens
              {unreadCount > 0 && <span className="about-unread-badge">{unreadCount}</span>}
            </h2>
          </div>

          {allMessages.length === 0 ? (
            <div className="about-card">
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: '0.85rem' }}>
                Nenhuma mensagem recebida.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {allMessages.map(m => (
                <div
                  key={m.id}
                  className={`about-admin-msg-card ${!m.is_read ? 'unread' : ''}`}
                  onClick={() => {
                    setActiveAdminMsg(activeAdminMsg === m.id ? null : m.id);
                    if (!m.is_read) handleMarkRead(m.id);
                  }}
                >
                  <div className="about-msg-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!m.is_read && <span className="about-new-dot" />}
                      <span className="about-msg-from">👤 {m.player_nickname}</span>
                      <span className="about-msg-subject" style={{ marginLeft: '0.5rem' }}>{renderSubject(m.subject)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                      <span className="about-msg-date">{fmtDate(m.created_at)}</span>
                      <button 
                        className="about-admin-delete-icon" 
                        onClick={(e) => handleDeleteMessage(e, m.id)}
                        title="Apagar esta mensagem"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {activeAdminMsg === m.id && (
                    <div onClick={e => e.stopPropagation()}>
                      <div style={{ marginTop: '0.5rem' }}>
                        {renderMessageBody(m.message)}
                      </div>

                      {m.reply && (
                        <div className="about-msg-reply">
                          <span className="about-msg-reply-label">💬 Sua resposta anterior:</span>
                          {renderMessageBody(m.reply)}
                        </div>
                      )}

                      {/* Editor de Resposta */}
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <p className="about-contact-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Responder:</p>
                        <textarea
                          className="form-input"
                          placeholder="Escreva uma resposta..."
                          rows={3}
                          value={replyText[m.id] ?? ''}
                          onChange={e => setReplyText(prev => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ resize: 'vertical' }}
                        />
                      </div>

                      {/* Anexos da Resposta */}
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                          <label className="btn-action-outline" style={{ flex: 1, margin: 0, cursor: 'pointer', padding: '8px 12px', fontSize: '0.85rem', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {(replyFiles[m.id]?.length || 0) > 0 ? '➕ Adicionar' : '📁 Anexar arquivos'}
                            <input 
                              type="file" 
                              multiple
                              style={{ display: 'none' }} 
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                setReplyFiles(prev => ({ ...prev, [m.id]: files.slice(0, 3) }));
                              }}
                              accept="image/*,.pdf,.txt,.xlsx,.xls,.doc,.docx"
                            />
                          </label>
                          {(replyFiles[m.id]?.length || 0) > 0 && (
                            <button 
                              className="btn-action-outline" 
                              style={{ flex: 1, color: '#ff6b6b', borderColor: '#ff6b6b', padding: '8px 12px', fontSize: '0.85rem' }}
                              onClick={() => setReplyFiles(prev => ({ ...prev, [m.id]: [] }))}
                            >
                              🗑️ Limpar
                            </button>
                          )}
                        </div>
                        {(replyFiles[m.id]?.length || 0) > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {replyFiles[m.id]?.map((f, i) => (
                              <span key={i} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                {f.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="about-admin-actions" style={{ marginTop: '1rem' }}>
                        <button
                          className="btn-primary about-action-btn"
                          onClick={() => handleReply(m.id)}
                          disabled={replying === m.id || (!replyText[m.id]?.trim() && (replyFiles[m.id]?.length || 0) === 0)}
                        >
                          {replying === m.id ? 'Enviando...' : '💬 Enviar Resposta'}
                        </button>
                        <button
                          className="about-btn-danger about-action-btn"
                          onClick={(e) => handleDeleteMessage(e, m.id)}
                          title="Apagar esta mensagem e sua resposta"
                        >
                          🗑️ Apagar Mensagem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Modais de edição ── */}
      {editModal === 'game' && (
        <EditModal
          title="Editar texto do jogo"
          fields={[{ key: 'about_game_text', label: 'Texto sobre o jogo', value: settings.about_game_text, multiline: true }]}
          onSave={saveSetting}
          onClose={() => setEditModal(null)}
        />
      )}
      {editModal === 'dev' && (
        <EditModal
          title="Editar dados do desenvolvedor"
          fields={[
            { key: 'dev_name',  label: 'Nome',  value: settings.dev_name },
            { key: 'dev_email', label: 'E-mail', value: settings.dev_email },
            { key: 'dev_phone', label: 'Telefone/Zap', value: settings.dev_phone },
            { key: 'dev_site',  label: 'Site',  value: settings.dev_site },
            { key: 'show_dev_site', label: 'Exibir Site', value: settings.show_dev_site, type: 'checkbox' },
          ]}
          onSave={saveSetting}
          onClose={() => setEditModal(null)}
        />
      )}
      {editModal === 'contact' && (
        <EditModal
          title="Editar dados de contato"
          fields={[
            { key: 'admin_whatsapp', label: 'WhatsApp (só números, com DDI: 5511999999999)', value: settings.admin_whatsapp },
          ]}
          onSave={saveSetting}
          onClose={() => setEditModal(null)}
        />
      )}
      {editModal === 'privacy' && (
        <EditModal
          title="Editar Política de Privacidade"
          fields={[{ key: 'privacyPolicy', label: 'Termos de Uso e Política de Privacidade', value: privacyPolicy, multiline: true }]}
          onSave={savePrivacyPolicy}
          onClose={() => setEditModal(null)}
          large
        />
      )}

      {showPromptModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowPromptModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 className="modal-title">💡 Instruções do Prompt para IA</h3>
            
            <div style={{ fontSize: '0.88rem', color: '#fff', opacity: 0.95, lineHeight: '1.5', textAlign: 'left', marginBottom: '1.2rem' }}>
              <p style={{ marginBottom: '0.8rem' }}>
                ⚠️ <strong>Atenção:</strong> O texto a ser copiado é apenas uma sugestão padrão e precisa ser adaptado antes do envio.
              </p>
              <p style={{ marginBottom: '0.8rem' }}>
                No prompt sugerido, é proposta a criação de <strong>30 perguntas</strong>. Ao colar o texto na sua IA, lembre-se de:
              </p>
              <ul style={{ paddingLeft: '1.2rem', marginBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Preencher o campo <strong>Tema das perguntas</strong> no texto (substituindo a marcação entre colchetes).</li>
                <li><strong>Anexar na mesma conversa</strong> o material de base (que pode ser um arquivo PDF da publicação, um link com o endereço da publicação, ou outro formato que a IA aceite).</li>
              </ul>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary" 
                onClick={handleCopyPrompt}
                style={{ flex: 1, padding: '0.8rem', background: '#4ade80', color: '#000', fontWeight: 'bold' }}
              >
                {copiedPrompt ? '✅ Copiado!' : '📋 COPIAR PROMPT'}
              </button>
              <button className="btn-action-outline" onClick={() => setShowPromptModal(false)} style={{ flex: 1 }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
