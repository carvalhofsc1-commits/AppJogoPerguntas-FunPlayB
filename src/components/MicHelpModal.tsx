import React from 'react';

interface MicHelpModalProps {
  onClose: () => void;
}

export function MicHelpModal({ onClose }: MicHelpModalProps) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.82)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', boxSizing: 'border-box',
        maxWidth: 'none', maxHeight: 'none', width: '100vw', height: '100vh'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e', borderRadius: '20px', padding: '24px',
          width: '100%', maxWidth: '500px', maxHeight: '88vh', overflowY: 'auto',
          border: '2px solid rgba(245,200,66,0.35)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.75)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#f5c842', fontSize: '1.1rem' }}>🎤 Como usar o Microfone</h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: '50%', width: '32px', height: '32px',
              cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Intro */}
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
          O microfone abre automaticamente após a pergunta ser narrada. Você tem tempo até o timer chegar em <b style={{ color: '#f5c842' }}>15 segundos</b> para falar sua resposta.
        </p>

        {/* Respostas */}
        <Section icon="💬" title="Responder a pergunta">
          <CommandRow cmd="Letra A" desc='Diga "Letra A", "Opção A" ou "Alternativa A"' />
          <CommandRow cmd="Letra B" desc='Diga "Letra B", "Opção B" ou "Alternativa B"' />
          <CommandRow cmd="Letra C" desc='Diga "Letra C", "Opção C" ou "Alternativa C"' />
          <CommandRow cmd="Letra D" desc='Diga "Letra D", "Opção D" ou "Alternativa D"' />
        </Section>

        {/* Navegação */}
        <Section icon="⏭️" title="Navegação">
          <CommandRow cmd="Pular" desc='Diga "pular" ou "pula" para pular esta pergunta (se tiver pulos disponíveis)' />
          <CommandRow cmd="Pausa" desc='Diga "pausa", "para" ou "pausar" para pausar o jogo' />
        </Section>

        {/* Ajudas */}
        <Section icon="🙋" title="Usar Ajudas">
          <CommandRow cmd="Eliminar" desc='Diga "eliminar" ou "elimina" para usar a ajuda de eliminação de alternativas' />
          <CommandRow cmd="Ajuda" desc='Diga "ajuda" ou "ajuda externa" para pedir ajuda externa' />
          <CommandRow cmd="Gravura" desc='Diga "gravura", "imagem" ou "dica" para ver a imagem da pergunta (se disponível)' />
        </Section>

        {/* Dicas */}
        <div style={{
          background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)',
          borderRadius: '12px', padding: '14px', marginTop: '16px',
        }}>
          <p style={{ color: '#f5c842', fontWeight: 700, margin: '0 0 8px', fontSize: '0.85rem' }}>💡 Dicas</p>
          <ul style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', lineHeight: 1.6, margin: 0, paddingLeft: '18px' }}>
            <li>Fale de forma clara e pausada.</li>
            <li>O microfone fecha sozinho após reconhecer sua fala.</li>
            <li>Se o mic não abrir, o botão de resposta na tela continua funcionando normalmente.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: '20px', padding: '12px',
            background: 'linear-gradient(135deg, #f5c842, #e0a800)',
            color: '#000', border: 'none', borderRadius: '25px',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
          }}
        >
          Entendido! Vamos jogar 🎮
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 8px' }}>{icon} {title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {children}
      </div>
    </div>
  );
}

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px',
    }}>
      <span style={{
        background: 'rgba(245,200,66,0.18)', color: '#f5c842', fontWeight: 700,
        fontSize: '0.75rem', borderRadius: '6px', padding: '2px 8px',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{cmd}</span>
      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', lineHeight: 1.4 }}>{desc}</span>
    </div>
  );
}
