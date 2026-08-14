import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SystemStatus } from '@/components/SystemStatus';
import { Navbar } from '@/components/Navbar';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { AppNotificationModal } from '@/components/AppNotificationModal';

import Welcome from '@/pages/Welcome';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import RecoverPin from '@/pages/RecoverPin';
import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import Questions from '@/pages/Questions';
import Settings from '@/pages/Settings';
// import Groups from '@/pages/Groups'; // OCULTO — modo grupo desativado temporariamente
import SelectTheme from '@/pages/SelectTheme';
import Play from '@/pages/Play';
import Result from '@/pages/Result';
import Ranking from '@/pages/Ranking';
import Users from '@/pages/Users';
import About from '@/pages/About';

import { AudioProvider } from '@/context/AudioContext';

/* Extrai as rotas num sub-componente para poder usar useLocation dentro do BrowserRouter */
function AppRoutes() {
  const location = useLocation();

  return (
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
      <Route path="/result"        element={<ProtectedRoute><Result /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
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
