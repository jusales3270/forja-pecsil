// ============================================================
// Forja - Aba "Dados" do detalhe da OS
// ============================================================

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import {
  useUpdateOS,
  type OS,
  type UpdateOSInput,
} from '../../../hooks/useOS';

interface DadosOSTabProps {
  os: OS;
  podeEditar: boolean;
}

// Converte ISO datetime → 'yyyy-mm-dd' pro <input type="date">
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// Converte 'yyyy-mm-dd' → ISO datetime fim do dia
function dateInputToIso(s: string): string | null {
  if (!s) return null;
  return new Date(s + 'T17:00:00').toISOString();
}

export function DadosOSTab({ os, podeEditar }: DadosOSTabProps) {
  const updateOS = useUpdateOS(os.id);

  // Form state
  const [prazoEntrega, setPrazoEntrega] = useState(isoToDateInput(os.prazoEntrega));
  const [prioridade, setPrioridade] = useState(os.prioridade);
  const [observacoes, setObservacoes] = useState(os.observacoes ?? '');
  const [precoUnitario, setPrecoUnitario] = useState(os.precoUnitario ?? '');
  const [poCliente, setPoCliente] = useState(os.poCliente ?? '');
  const [statusFiscal, setStatusFiscal] = useState(os.statusFiscal ?? '');
  const [numeroFiscal, setNumeroFiscal] = useState(os.numeroFiscal ?? '');
  const [valorRecebido, setValorRecebido] = useState(os.valorRecebido ?? '');
  const [dataNf, setDataNf] = useState(isoToDateInput(os.dataNf));
  const [dataPagamento, setDataPagamento] = useState(isoToDateInput(os.dataPagamento));

  const [erro, setErro] = useState<string | null>(null);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Reset state quando OS muda
  useEffect(() => {
    setPrazoEntrega(isoToDateInput(os.prazoEntrega));
    setPrioridade(os.prioridade);
    setObservacoes(os.observacoes ?? '');
    setPrecoUnitario(os.precoUnitario ?? '');
    setPoCliente(os.poCliente ?? '');
    setStatusFiscal(os.statusFiscal ?? '');
    setNumeroFiscal(os.numeroFiscal ?? '');
    setValorRecebido(os.valorRecebido ?? '');
    setDataNf(isoToDateInput(os.dataNf));
    setDataPagamento(isoToDateInput(os.dataPagamento));
  }, [os]);

  // Detectar mudanças
  const mudou = useMemo(() => {
    return (
      prazoEntrega !== isoToDateInput(os.prazoEntrega) ||
      prioridade !== os.prioridade ||
      observacoes !== (os.observacoes ?? '') ||
      String(precoUnitario) !== String(os.precoUnitario ?? '') ||
      poCliente !== (os.poCliente ?? '') ||
      statusFiscal !== (os.statusFiscal ?? '') ||
      numeroFiscal !== (os.numeroFiscal ?? '') ||
      String(valorRecebido) !== String(os.valorRecebido ?? '') ||
      dataNf !== isoToDateInput(os.dataNf) ||
      dataPagamento !== isoToDateInput(os.dataPagamento)
    );
  }, [
    prazoEntrega,
    prioridade,
    observacoes,
    precoUnitario,
    poCliente,
    statusFiscal,
    numeroFiscal,
    valorRecebido,
    dataNf,
    dataPagamento,
    os,
  ]);

  // Calcula valor total automaticamente
  const valorTotalCalculado = useMemo(() => {
    const preco = parseFloat(String(precoUnitario));
    if (isNaN(preco)) return null;
    return preco * os.quantidadeTotal;
  }, [precoUnitario, os.quantidadeTotal]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mudou || !podeEditar) return;
    setErro(null);
    setSalvoComSucesso(false);

    const input: UpdateOSInput = {
      prazoEntrega: dateInputToIso(prazoEntrega) ?? undefined,
      prioridade,
      observacoes: observacoes.trim() || null,
      precoUnitario: precoUnitario === '' ? null : parseFloat(String(precoUnitario)),
      valorTotal: valorTotalCalculado,
      poCliente: poCliente.trim() || null,
      statusFiscal: statusFiscal.trim() || null,
      numeroFiscal: numeroFiscal.trim() || null,
      valorRecebido:
        valorRecebido === '' ? null : parseFloat(String(valorRecebido)),
      dataNf: dateInputToIso(dataNf),
      dataPagamento: dateInputToIso(dataPagamento),
    };

    try {
      await updateOS.mutateAsync(input);
      setSalvoComSucesso(true);
      setTimeout(() => setSalvoComSucesso(false), 2500);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? err?.message ?? 'Erro ao salvar');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* ============ DADOS GERAIS ============ */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide mb-4">
          Dados Gerais
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Prazo de entrega
            </label>
            <input
              type="date"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
              disabled={!podeEditar}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">
              Prioridade
            </label>
            <div className="flex gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="prioridade-edit"
                  checked={prioridade === 'normal'}
                  onChange={() => setPrioridade('normal')}
                  disabled={!podeEditar}
                  className="accent-forja-500"
                />
                <span className="text-sm">Normal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="prioridade-edit"
                  checked={prioridade === 'urgente'}
                  onChange={() => setPrioridade('urgente')}
                  disabled={!podeEditar}
                  className="accent-forja-500"
                />
                <span className="text-sm text-red-400 font-medium">Urgente</span>
              </label>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={!podeEditar}
              rows={3}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none resize-none"
            />
          </div>
        </div>
      </section>

      {/* ============ FINANCEIRO ============ */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide mb-4">
          Financeiro / Comercial
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Preço unitário
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precoUnitario}
              onChange={(e) => setPrecoUnitario(e.target.value)}
              disabled={!podeEditar}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-mono disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Valor total <span className="text-neutral-600">(calculado)</span>
            </label>
            <div className="w-full px-3 py-2 bg-neutral-800/30 border border-neutral-700/50 rounded-lg text-sm font-mono text-forja-400">
              {valorTotalCalculado !== null
                ? valorTotalCalculado.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              PO do cliente
            </label>
            <input
              type="text"
              value={poCliente}
              onChange={(e) => setPoCliente(e.target.value)}
              disabled={!podeEditar}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Status fiscal
            </label>
            <input
              type="text"
              value={statusFiscal}
              onChange={(e) => setStatusFiscal(e.target.value)}
              disabled={!podeEditar}
              placeholder="FERRO, OK, PASIFER..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Nº fiscal (NF)
            </label>
            <input
              type="text"
              value={numeroFiscal}
              onChange={(e) => setNumeroFiscal(e.target.value)}
              disabled={!podeEditar}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Data emissão NF
            </label>
            <input
              type="date"
              value={dataNf}
              onChange={(e) => setDataNf(e.target.value)}
              disabled={!podeEditar}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Valor recebido
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
              disabled={!podeEditar}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-mono disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Data pagamento
            </label>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              disabled={!podeEditar}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm disabled:opacity-50 focus:border-forja-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Erro / Sucesso */}
      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {erro}
        </div>
      )}
      {salvoComSucesso && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400">
          Alterações salvas com sucesso.
        </div>
      )}

      {/* Botão salvar */}
      {podeEditar && (
        <div className="flex items-center justify-end gap-2 sticky bottom-4 bg-neutral-950/80 backdrop-blur-sm p-3 -mx-3 rounded-lg">
          {mudou && (
            <span className="text-xs text-amber-400">Você tem alterações não salvas</span>
          )}
          <button
            type="submit"
            disabled={!mudou || updateOS.isPending}
            className="px-4 py-2 bg-forja-500 hover:bg-forja-600 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition"
          >
            {updateOS.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {!podeEditar && (
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-3 text-sm text-neutral-400">
          OS está com status "{os.status}" e não pode ser editada.
        </div>
      )}
    </form>
  );
}
