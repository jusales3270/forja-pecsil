// ============================================================
// Forja - Tótem: faixa vermelha de falta de peças
// Aparece na estação de onde as peças saíram (a Fundição) enquanto a falta
// conferida no Desbaste estiver aberta. Regra do Domingo: o Desbaste segue
// trabalhando o que chegou, e a Fundição continua avisada até enviar o
// restante E o Desbaste confirmar que recebeu (ou o PCP aceitar a falta).
// ============================================================

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { useEnvioDaOrigem, useFaltasChegada, type FaltaChegadaAberta } from '../../hooks/useOPLote';

const quando = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function FaixaFaltaChegada({ etapaId, podeOperar }: { etapaId?: string; podeOperar: boolean }) {
  const { data } = useFaltasChegada(etapaId);
  const envio = useEnvioDaOrigem();
  const [enviando, setEnviando] = useState<FaltaChegadaAberta | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const faltas = data?.data ?? [];
  if (faltas.length === 0) return null;

  const paraEnviar = (f: FaltaChegadaAberta) => f.faltam - f.aguardandoConfirmacao;
  const qtd = Number(quantidade);
  const qtdValida = !!enviando && Number.isInteger(qtd) && qtd >= 1 && qtd <= paraEnviar(enviando);

  async function confirmarEnvio() {
    if (!enviando || !qtdValida || envio.isPending) return;
    try {
      await envio.mutateAsync({ id: enviando.opLoteId, quantidade: qtd });
      toast.sucesso('Envio registrado. O Desbaste foi avisado para confirmar quando as peças chegarem.');
      setEnviando(null);
    } catch (e: any) {
      toast.erro(e?.response?.data?.message ?? 'Não foi possível registrar o envio.');
    }
  }

  return (
    <div role="alert" className="mb-6 rounded-xl border-2 border-red-500 bg-red-600/20 px-5 py-4">
      <div className="text-lg font-bold text-red-300 uppercase tracking-wide">
        ⚠ Falta de peças {faltas.length > 1 ? `em ${faltas.length} lotes` : 'no lote'}
      </div>
      <ul className="mt-3 space-y-3">
        {faltas.map((f) => (
          <li key={f.opLoteId} className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base text-red-100">
              <strong className="font-mono">OS {f.codigoGrv}</strong> · Lote {f.numeroLote} ({f.artigo}): chegaram{' '}
              <strong>{f.contado} de {f.esperado}</strong> peças no Desbaste —{' '}
              <strong className="text-red-300">faltam {f.faltam}</strong>.
              <span className="text-red-200/80 text-sm">
                {' '}Conferido{f.conferidoPor ? ` por ${f.conferidoPor}` : ''} em {quando(f.conferidoEm)}.
              </span>
              {f.aguardandoConfirmacao > 0 && f.enviadoEm && (
                <div className="text-sm text-amber-200 mt-0.5">
                  📦 {f.aguardandoConfirmacao} enviada(s){f.enviadoPor ? ` por ${f.enviadoPor}` : ''} em {quando(f.enviadoEm)} — aguardando o Desbaste confirmar o recebimento.
                </div>
              )}
            </div>
            {podeOperar && paraEnviar(f) > 0 && (
              <button
                type="button"
                onClick={() => { setQuantidade(String(paraEnviar(f))); setEnviando(f); }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm whitespace-nowrap"
              >
                📦 Enviei as peças que faltam
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-red-200/90">
        O Desbaste segue trabalhando o que chegou. Esta faixa só some quando o Desbaste confirmar que recebeu o restante (ou o PCP aceitar a falta).
      </p>

      {enviando && (
        <Modal
          open
          forcarEscuro
          title={`Enviar peças que faltam — OS ${enviando.codigoGrv} · Lote ${enviando.numeroLote}`}
          onClose={() => { if (!envio.isPending) setEnviando(null); }}
          footer={<>
            <button className="btn-ghost px-4 py-2" disabled={envio.isPending} onClick={() => setEnviando(null)}>Cancelar</button>
            <button className="px-5 py-2 rounded-lg bg-red-600 disabled:opacity-50 text-white" disabled={!qtdValida || envio.isPending} onClick={confirmarEnvio}>
              {envio.isPending ? 'Registrando...' : 'Registrar envio'}
            </button>
          </>}
        >
          <label className="label-compact">Quantas peças você está enviando ao Desbaste?
            <input
              type="number" inputMode="numeric" min={1} max={paraEnviar(enviando)} autoFocus
              value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarEnvio(); }}
              className="input py-2 text-2xl font-semibold w-40 mt-1"
            />
          </label>
          {!qtdValida && quantidade !== '' && <p className="text-sm text-red-400 mt-2">Informe de 1 a {paraEnviar(enviando)}.</p>}
          <p className="text-sm text-neutral-400 mt-3">O Desbaste é avisado e confirma quando as peças chegarem. Até lá, a falta continua aparecendo aqui.</p>
        </Modal>
      )}
    </div>
  );
}
