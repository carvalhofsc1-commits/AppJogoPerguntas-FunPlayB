import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) return <Navigate to="/welcome" replace />;
  if (adminOnly && session.category !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}
