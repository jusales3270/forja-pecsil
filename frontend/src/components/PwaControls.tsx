import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// O cabeçalho só aparece quando há uma atualização pendente do aplicativo.
export function PwaControls() {
  const [error, setError] = useState('');
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { console.warn('Não foi possível registrar o aplicativo Forja.', error); },
  });
  async function handleUpdate() {
    setError('');
    try { await updateServiceWorker(true); }
    catch { setError('Não foi possível atualizar. Tente novamente quando a conexão voltar.'); }
  }
  if (!needRefresh && !error) return null;
  return <aside aria-label="Atualização do Forja" className="border-b border-neutral-800 bg-neutral-950 text-neutral-100 px-4 py-2">
    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-end gap-3 text-sm">
      {needRefresh && <>
        <span>Nova versão disponível. Conclua o apontamento antes de atualizar.</span>
        <button type="button" className="btn-primary px-4 py-2" onClick={handleUpdate}>Atualizar agora</button>
        <button type="button" className="px-3 py-2 underline" onClick={() => setNeedRefresh(false)}>Depois</button>
      </>}
    </div>
    {error && <p role="alert" className="max-w-7xl mx-auto mt-2 text-sm text-red-300">{error}</p>}
  </aside>;
}
