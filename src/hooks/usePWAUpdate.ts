import { useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface PWAUpdateState {
  needsUpdate: boolean;
  updating: boolean;
  update: () => void;
  forceUpdate: (loggedIn?: boolean) => Promise<void>;
}

export function usePWAUpdate(): PWAUpdateState {
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  const update = useCallback(() => {
    setUpdating(true);
    const runUpdate = async () => {
      try { await updateServiceWorker(true); } catch (e) { console.error('Erro ao atualizar SW:', e); }
    };
    runUpdate();
  }, [updateServiceWorker]);

  /**
   * Força verificação ativa de update no servidor.
   * - Se há novo SW aguardando: limpa cache, ativa e recarrega.
   * - Se já está na última versão: apenas exibe as notas da versão atual.
   */
  const forceUpdate = useCallback(async (loggedIn = false) => {
    // Se já há atualização pendente detectada pelo SW, aplica diretamente
    if (needsUpdate) {
      setUpdating(true);
      await updateServiceWorker(true).catch(() => {});
      return;
    }

    // Se logado e sem update pendente: mostra as notas IMEDIATAMENTE (instantâneo)
    // e verifica o SW em background para não travar a UI
    if (loggedIn) {
      window.dispatchEvent(new CustomEvent('show-release-notes'));
    }

    // Verificação do SW em background (sem bloquear)
    setUpdating(true);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      let hasWaiting = false;
      for (const reg of registrations) {
        await reg.update().catch(() => {});
        if (reg.waiting) hasWaiting = true;
      }
      if (hasWaiting) {
        await updateServiceWorker(true).catch(() => {});
        return;
      }
    } catch (e) {
      console.error('Erro na verificação do SW:', e);
    }
    setUpdating(false);
  }, [needsUpdate, updateServiceWorker]);

  return { needsUpdate, updating, update, forceUpdate };
}
