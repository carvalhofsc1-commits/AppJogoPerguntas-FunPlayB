import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SystemStatus } from '@/components/SystemStatus';
import { Navbar } from '@/components/Navbar';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { AppNotificationModal } from '@/components/AppNotificationModal';

// Cada página vira o próprio chunk (code-splitting) — o bundle principal
// deixa de carregar o código de todas as telas (Play.tsx e Questions.tsx
// sozinhas somam mais de 5000 linhas) de uma vez só no primeiro acesso.
const Welcome = lazy(() => import('@/pages/Welcome'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const RecoverPin = lazy(() => import('@/pages/RecoverPin'));
const Home = lazy(() => import('@/pages/Home'));
const Profile = lazy(() => import('@/pages/Profile'));
const Questions = lazy(() => import('@/pages/Questions'));
const Settings = lazy(() => import('@/pages/Settings'));
// import Groups from '@/pages/Groups'; // OCULTO — modo grupo desativado temporariamente
const SelectTheme = lazy(() => import('@/pages/SelectTheme'));
const Play = lazy(() => import('@/pages/Play'));
const Ranking = lazy(() => import('@/pages/Ranking'));
const Users = lazy(() => import('@/pages/Users'));
const About = lazy(() => import('@/pages/About'));

import { AudioProvider } from '@/context/AudioContext';

function RouteFallback() {
  return (
    <div className="screen-center">
      <div className="spinner" />
    </div>
  );
}

/* Extrai as rotas num sub-componente para poder usar useLocation dentro do BrowserRouter */
function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Públicas */}
      <Route path="/welcome"     element={<Welcome />} />
      <Route path="/login"       element={<Login />} />
      <Route path="/register"    element={<Register />} />
      <Route path="/recover-pin" element={<RecoverPin />} />

      {/* Protegidas */}
      <Route path="/"             element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/ranking"       element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
      <Route path="/users"         element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
      <Route path="/questions"     element={<ProtectedRoute><Questions /></ProtectedRoute>} />
      <Route path="/settings"      element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/about"         element={<ProtectedRoute><About /></ProtectedRoute>} />
      {/* <Route path="/groups"        element={<ProtectedRoute><Groups /></ProtectedRoute>} /> */}
      <Route path="/select-theme"  element={<ProtectedRoute><SelectTheme /></ProtectedRoute>} />

      {/* key={location.key} força o remount do Play a cada nova navegação para /play,
          mesmo que a URL seja idêntica — isso reseta todo o estado do jogo sem reload,
          mantendo o AudioProvider (e seus buffers de sons) vivo */}
      <Route path="/play"          element={<ProtectedRoute><Play key={location.key} /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
    </Suspense>
  );
}

function AppContent() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SystemStatus />
      <Navbar />
      <ReleaseNotesModal />
      <AppNotificationModal />
      <AppRoutes />
    </BrowserRouter>
  );
}


import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Pre-carrega as vozes do TTS assim que o app abre para evitar o bug
    // de lazy-loading do Chrome (que faz a primeira fala sair com voz robótica)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  return (
    <AuthProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </AuthProvider>
  );
}
