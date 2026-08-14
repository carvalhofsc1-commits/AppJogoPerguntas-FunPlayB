import { useEffect } from 'react';

// Pull-to-refresh DESATIVADO.
// A atualização é feita exclusivamente pelo botão "Atualizar" na barra inferior.
export function usePullToRefresh() {
  useEffect(() => {
    // Não faz nada — gesture desabilitado intencionalmente.
  }, []);
}
