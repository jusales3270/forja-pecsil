// ============================================================
// Forja - Tótem: falta de peças na chegada ao Desbaste
// O lote continua valendo o total: só fecha quando as peças que faltam
// chegarem (o Desbaste registra) ou quando o PCP aceitar a falta.
// ============================================================

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { useAceitarFalta, useComplementoChegada, type OPLotePendente } from '../../hooks/useOPLote';
import { useAuth } from '../../lib/auth-store';

export function FaltaNaChegada({ op, podeOperar }: { op: OPLotePendente; podeOperar: boolean }) {
  const falta = op.faltaChegada;
  const papel = useAuth((s) => s.pessoa?.papel);
  const ehPcp = papel === 'pcp' || papel === 'admin';
  const [modal, setModal] = useState<'chegaram' | 'aceitar' | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const complemento = useComplementoChegada();
  const aceitar = useAceitarFalta();
  if (!falta) return null;

  const qtd = Number(quantidade);
  const qtdValida = Number.isInteger(qtd) && qtd >= 1 && qtd <= falta.faltam;
  const ocupado = complemento.isPending || aceitar.isPending;

  async function registrarChegada() {
    if (!qtdValida || ocupado) return;
    try {
      const r = await complemento.mutateAsync({ id: op.id, quantidade: qtd });
      toast.sucesso(r.data.faltam > 0 ? `Registrado. Ainda faltam ${r.data.faltam}.` : 'Registrado. Não falta mais nenhuma peça.');
      setModal(null);
    } catch (e: any) {
      toast.erro(e?.response?.data?.message ?? 'Não foi possível registrar.');
    }
  }

  async function aceitarFalta() {
    if (ocupado) return;
    try {
      const r = await aceitar.mutateAsync({ id: op.id });
      toast.sucesso(`Falta aceita. O lote passa a valer ${r.data.quantidadeDepois} peças.`);
      setModal(null);
    } catch (e: any) {
      toast.erro(e?.response?.data?.message ?? 'Não foi possível aceitar a falta.');
    }
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
      <div className="text-sm text-amber-300 font-medium">
        ⚠ Faltam {falta.faltam} peça(s) da chegada
      </div>
      <div className="text-xs text-neutral-300 mt-0.5">
        Chegaram {falta.contado} de {falta.esperado}. Pode seguir trabalhando o que chegou; o lote fecha quando as que faltam chegarem ou o PCP aceitar a falta.
      </div>
      {falta.aguardandoConfirmacao > 0 && (
        <div className="text-sm text-emerald-300 mt-1.5 font-medium">
          📦 A Fundição enviou {falta.aguardandoConfirmacao} peça(s){falta.enviadoEm ? ` em ${new Date(falta.enviadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}. Confirme quando chegarem.
        </div>
      )}
      {(podeOperar || ehPcp) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {podeOperar && (
            <button
              type="button"
              onClick={() => { setQuantidade(String(falta.aguardandoConfirmacao || falta.faltam)); setModal('chegaram'); }}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Chegaram peças
            </button>
          )}
          {ehPcp && (
            <button
              type="button"
              onClick={() => setModal('aceitar')}
              className="px-3 py-1.5 text-sm rounded-lg border border-amber-500/50 text-amber-200 hover:bg-amber-500/10"
            >
              Aceitar falta (PCP)
            </button>
          )}
        </div>
      )}

      {modal === 'chegaram' && (
        <Modal
          open
          forcarEscuro
          title={`Peças que faltavam — OS ${op.lote.os.codigoGrv} · Lote ${op.lote.numeroLote}`}
          onClose={() => { if (!ocupado) setModal(null); }}
          footer={<>
            <button className="btn-ghost px-4 py-2" disabled={ocupado} onClick={() => setModal(null)}>Cancelar</button>
            <button className="px-5 py-2 rounded-lg bg-emerald-600 disabled:opacity-50 text-white" disabled={!qtdValida || ocupado} onClick={registrarChegada}>
              {complemento.isPending ? 'Registrando...' : 'Registrar'}
            </button>
          </>}
        >
          <label className="label-compact">Quantas das {falta.faltam} que faltavam chegaram?
            <input
              type="number" inputMode="numeric" min={1} max={falta.faltam} autoFocus
              value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') registrarChegada(); }}
              className="input py-2 text-2xl font-semibold w-40 mt-1"
            />
          </label>
          {!qtdValida && quantidade !== '' && <p className="text-sm text-red-400 mt-2">Informe de 1 a {falta.faltam}.</p>}
        </Modal>
      )}

      {modal === 'aceitar' && (
        <Modal
          open
          forcarEscuro
          title={`Aceitar falta — OS ${op.lote.os.codigoGrv} · Lote ${op.lote.numeroLote}`}
          onClose={() => { if (!ocupado) setModal(null); }}
          footer={<>
            <button className="btn-ghost px-4 py-2" disabled={ocupado} onClick={() => setModal(null)}>Cancelar</button>
            <button className="px-5 py-2 rounded-lg bg-amber-600 disabled:opacity-50 text-white" disabled={ocupado} onClick={aceitarFalta}>
              {aceitar.isPending ? 'Aceitando...' : `Aceitar falta de ${falta.faltam}`}
            </button>
          </>}
        >
          <p className="mb-3">
            O lote passa a valer <strong>{op.lote.quantidadePecas - falta.faltam}</strong> peças (era {op.lote.quantidadePecas}).
            As {falta.faltam} que faltaram ficam registradas na OS e não voltam mais para este lote.
          </p>
          <p className="text-sm text-neutral-400">
            Se precisar repor, abra uma nova OS ou lote. Operações que já fizeram as {op.lote.quantidadePecas - falta.faltam} peças fecham agora.
          </p>
        </Modal>
      )}
    </div>
  );
}
