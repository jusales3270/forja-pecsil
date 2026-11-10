import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { useMetalizacaoExterna, formatarDataHora, type OPLotePendente } from '../../hooks/useOPLote';

export function EnviosExternos({ ops, podeOperar, carregando, erro }: {
  ops: OPLotePendente[]; podeOperar: boolean; carregando: boolean; erro: boolean;
}) {
  const [selecionada, setSelecionada] = useState<OPLotePendente | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const receber = useMetalizacaoExterna();
  async function confirmar() {
    if (!selecionada || !confirmado || receber.isPending) return;
    try {
      await receber.mutateAsync({ id: selecionada.id, acao: 'receber-externo' });
      toast.sucesso('Retorno confirmado. Lote liberado nesta estação.');
      setSelecionada(null);
    } catch (e: any) {
      toast.erro(e?.response?.data?.message ?? 'Não foi possível confirmar o recebimento.');
    }
  }
  return <section className="space-y-4">
    <p className="text-neutral-400">Lotes indicados no Desbaste para metalização externa. Ficam travados aqui até a confirmação de que voltaram do fornecedor.</p>
    {carregando ? <p>Carregando...</p> : erro ? <p className="text-red-400">Não foi possível carregar a lista. Atualize a página.</p> : ops.length === 0 && <p className="p-6 border border-neutral-800 rounded-xl">Nenhum lote em metalização externa.</p>}
    {ops.map(op => {
      const saiu = op.saiuParaExterno !== false;
      return <article key={op.id} className="p-5 rounded-xl border border-amber-500/30 bg-neutral-900 space-y-3">
        <h2 className="text-xl font-semibold">🔒 OS {op.lote.os.codigoGrv} · Lote {op.lote.numeroLote}</h2>
        <p>{op.lote.os.artigo.codigo} — {op.lote.os.artigo.descricao}</p>
        <p className="text-neutral-400">{op.lote.os.cliente.nome} · {op.quantidadeEnvioExterno} peças</p>
        {saiu
          ? <p className="text-amber-300">No fornecedor desde {formatarDataHora(op.envioExternoEm!)} · Aguardando retorno</p>
          : <p className="text-sky-300">Ainda no {op.operacaoAnterior?.estacao ?? 'processo anterior'} ({op.operacaoAnterior?.concluidas ?? 0} de {op.lote.quantidadePecas} peças). Vai para o fornecedor quando o lote inteiro sair de lá.</p>}
        {op.fornecedor && <p>Fornecedor: {op.fornecedor}</p>}
        {podeOperar && saiu && <button className="px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium" onClick={() => { setSelecionada(op); setConfirmado(false); }}>Confirmar retorno</button>}
      </article>;
    })}
    {selecionada && <Modal open forcarEscuro title={`Receber OS ${selecionada.lote.os.codigoGrv} · Lote ${selecionada.lote.numeroLote}`} onClose={() => { if (!receber.isPending) setSelecionada(null); }} footer={<>
      <button className="btn-ghost px-4 py-3" disabled={receber.isPending} onClick={() => setSelecionada(null)}>Cancelar</button>
      <button className="px-5 py-3 rounded-lg bg-emerald-600 disabled:opacity-50" disabled={!confirmado || receber.isPending} onClick={confirmar}>{receber.isPending ? 'Confirmando...' : 'Confirmar retorno'}</button>
    </>}>
      <p className="mb-5">Esta confirmação registra o retorno das {selecionada.quantidadeEnvioExterno} peças da metalização externa e libera o lote nesta estação.</p>
      <label className="flex gap-3 p-4 border border-neutral-700 rounded-lg cursor-pointer"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Todas as peças enviadas retornaram metalizadas e estão prontas para seguir o fluxo.</label>
    </Modal>}
  </section>;
}
