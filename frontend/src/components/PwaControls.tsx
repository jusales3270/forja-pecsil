import { useState, useSyncExternalStore } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getInstallSnapshot, installForja, subscribeInstall } from '../lib/pwa-install';

export function PwaControls() {
  const { installed } = useSyncExternalStore(subscribeInstall, getInstallSnapshot);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Não foi possível registrar o aplicativo Forja.', error);
    },
  });

  async function handleInstall() {
    setError('');
    setBusy(true);
    try {
      const outcome = await installForja();
      setHelp(outcome !== 'accepted');
    } catch {
      setError('Não foi possível abrir a instalação. Tente pelo menu do navegador.');
      setHelp(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    setError('');
    try {
      await updateServiceWorker(true);
    } catch {
      setError('Não foi possível atualizar. Tente novamente quando a conexão voltar.');
    }
  }

  if (installed && !needRefresh && !error) return null;

  return (
    <aside aria-label="Aplicativo Forja" className="border-b border-neutral-800 bg-neutral-950 text-neutral-100 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-end gap-3 text-sm">
        {!installed && (
          <button type="button" className="btn-primary px-4 py-2" disabled={busy} onClick={handleInstall}>
            {busy ? 'Abrindo instalação...' : 'Instalar Forja'}
          </button>
        )}
        {needRefresh && (
          <>
            <span>Nova versão disponível. Conclua o apontamento antes de atualizar.</span>
            <button type="button" className="btn-primary px-4 py-2" onClick={handleUpdate}>Atualizar agora</button>
            <button type="button" className="px-3 py-2 underline" onClick={() => setNeedRefresh(false)}>Depois</button>
          </>
        )}
      </div>
      {help && !installed && (
        <div className="max-w-7xl mx-auto mt-3 text-sm text-neutral-300 space-y-2">
          <p>Instale uma vez neste tótem para abrir o Forja pelo ícone, em uma janela própria.</p>
          {!window.isSecureContext ? (
            <p>A instalação PWA precisa do endereço HTTPS do Forja com certificado válido. Peça à TI o endereço seguro deste servidor.</p>
          ) : (
            <p>No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção de instalar este site como aplicativo no menu. Se já estiver instalado, abra Forja pelo menu Iniciar.</p>
          )}
          <p>Na instalação, marque “Criar atalho na área de trabalho”, se essa opção aparecer. O registro de produção continua precisando de conexão com o servidor.</p>
          <button type="button" className="underline py-2" onClick={() => setHelp(false)}>Fechar instruções</button>
        </div>
      )}
      {error && <p role="alert" className="max-w-7xl mx-auto mt-2 text-sm text-red-300">{error}</p>}
    </aside>
  );
}
