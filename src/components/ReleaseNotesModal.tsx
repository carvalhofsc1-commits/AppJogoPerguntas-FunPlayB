import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { VERSION_CONFIG } from '@/lib/version';
import { useAuth } from '@/context/AuthContext';


interface ReleaseNote {
  id: string;
  version: string;
  notes: string;
  created_at: string;
}

export function ReleaseNotesModal() {
  const { session } = useAuth();
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);


  // Busca uma nota customizada (override) salva pelo admin para a versão atual.
  // Se não houver, cai para a mensagem do commit (VERSION_CONFIG.notes).
  const getCurrentVersionNote = async (): Promise<ReleaseNote> => {
    try {
      const { data } = await supabase!
        .from('release_notes')
        .select('*')
        .eq('version', VERSION_CONFIG.version)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.notes) return data;
    } catch (e) {
      console.error('Erro ao buscar nota de atualização customizada', e);
    }

    return {
      id: 'commit-note',
      version: VERSION_CONFIG.version,
      notes: VERSION_CONFIG.notes,
      created_at: '',
    };
  };

  useEffect(() => {
    const checkNotes = async () => {
      const lastSeenVersion = localStorage.getItem('last_seen_version');

      // Se for o primeiro acesso, apenas registra a versão atual silenciosamente
      if (!lastSeenVersion) {
        localStorage.setItem('last_seen_version', VERSION_CONFIG.version);
        return;
      }

      if (lastSeenVersion === VERSION_CONFIG.version) return;

      const note = await getCurrentVersionNote();
      setNotes([note]);
      setIsOpen(true);
    };

    if (!session) return;
    checkNotes();
  }, [session]);


  useEffect(() => {
    const handleForceShow = async () => {
      const note = await getCurrentVersionNote();
      setNotes([note]);
      setIsOpen(true);
    };

    window.addEventListener('show-release-notes', handleForceShow);
    return () => window.removeEventListener('show-release-notes', handleForceShow);
  }, []);

  const handleClose = () => {
    localStorage.setItem('last_seen_version', VERSION_CONFIG.version);
    setIsOpen(false);
  };

  if (!isOpen || notes.length === 0 || !session) return null;


  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-box" style={{ 
        maxWidth: '400px', 
        width: '90%', 
        maxHeight: '85dvh',
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        backgroundColor: '#5c358f', 
        color: '#fff', 
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <h2 style={{ margin: 0, color: '#f5c842', fontSize: '1.4rem' }}>🎉 Atualização Concluída!</h2>
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#e0d4f7' }}>
          Você está na versão <strong>{VERSION_CONFIG.version}</strong> do FunPlayB.
        </p>

        <div style={{ 
          backgroundColor: 'rgba(0,0,0,0.2)', 
          padding: '1rem', 
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#fff' }}>O que há de novo:</h3>

          <div 
            className="release-notes-scroll"
            style={{
              fontSize: '0.9rem',
              color: '#e0d4f7',
              whiteSpace: 'pre-line',
              maxHeight: expanded ? '50dvh' : '40px',
              overflowY: 'auto',
              paddingRight: '5px',
              transition: 'max-height 0.3s ease-in-out'
            }}
          >
            {notes.map((n, i) => `${i === 0 ? `[v${VERSION_CONFIG.version}]\n` : ''}${n.notes}\n\n`).join('')}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f5c842',
              padding: '0.5rem 0 0 0',
              cursor: 'pointer',
              fontWeight: 'bold',
              width: '100%',
              textAlign: 'center',
              fontSize: '0.85rem'
            }}
          >
            {expanded ? 'Mostrar menos ▲' : 'Ver detalhes completos ▼'}
          </button>
        </div>

        <button className="btn-primary" onClick={handleClose} style={{ marginTop: '0.5rem' }}>
          Continuar
        </button>
      </div>
    </div>
  );
}
