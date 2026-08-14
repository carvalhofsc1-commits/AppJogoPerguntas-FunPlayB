import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
}

export function AppNotificationModal() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!session?.player_id || !supabase) return;
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, message')
          .eq('player_id', session.player_id)
          .eq('is_read', false)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Erro ao buscar notificações:', error);
          return;
        }

        if (data && data.length > 0) {
          setNotifications(data);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('Falha na conexão de notificações', err);
      }
    };

    fetchNotifications();
  }, [session]);

  const handleMarkAsRead = async () => {
    if (!supabase || notifications.length === 0) return;
    
    const currentNotif = notifications[currentIndex];
    
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', currentNotif.id);
        
      if (currentIndex < notifications.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Erro ao marcar notificação como lida', err);
    }
  };

  const handleReply = async () => {
    const title = notifications[currentIndex]?.title;
    await handleMarkAsRead();
    navigate(`/about?replyRef=${encodeURIComponent(title || 'Aviso do Sistema')}`);
  };

  if (notifications.length === 0) return null;

  const currentNotif = notifications[currentIndex];

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="modal-box" style={{ 
        maxWidth: '400px', 
        width: '90%', 
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        backgroundColor: '#f1c40f', // Amarelo de atenção do FunPlayB
        color: '#000', 
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>📢</span>
          <h2 style={{ margin: 0, color: '#000', fontSize: '1.3rem', fontWeight: 800 }}>
            {currentNotif.title || 'Aviso do Sistema'}
          </h2>
        </div>
        
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.85)', 
          padding: '1rem', 
          borderRadius: '8px',
          color: '#333',
          fontSize: '0.95rem',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          maxHeight: '50vh',
          overflowY: 'auto'
        }}>
          {currentNotif.message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>
            {notifications.length > 1 ? `Mensagem ${currentIndex + 1} de ${notifications.length}` : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleReply} 
              style={{ 
                padding: '10px 16px', 
                fontSize: '0.9rem', 
                fontWeight: 800, 
                backgroundColor: 'transparent', 
                color: '#000', 
                border: '2px solid #000', 
                borderRadius: '8px', 
                cursor: 'pointer' 
              }}
            >
              Responder
            </button>
            <button 
              onClick={handleMarkAsRead} 
              style={{ 
                padding: '10px 24px', 
                fontSize: '1rem', 
                fontWeight: 800, 
                backgroundColor: '#000', 
                color: '#f1c40f', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer' 
              }}
            >
              Ciente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
