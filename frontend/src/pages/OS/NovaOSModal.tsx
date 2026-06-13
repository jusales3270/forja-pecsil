// ============================================================
// Forja - Modal de criação de OS
// ============================================================

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useArtigosList } from '../../hooks/useArtigos';
import { useClientesList as useClientes } from '../../hooks/useClientes';
import { useCreateOS, type CreateOSInput, type DivisaoLotes } from '../../hooks/useOS';

interface NovaOSModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function NovaOSModal({ onClose, onCreated }: NovaOSModalProps) {
  // Busca de Artigo
  const [buscaArtigo, setBuscaArtigo] = useState('');
  const [artigoId, setArtigoId] = useState<string | null>(null);

  // Identificação
  const [codigoGrv, setCodigoGrv] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [quantidadeTotal, setQuantidadeTotal] = useState<string>('');
  const [prazoEntrega, setPrazoEntrega] = useState<string>('');
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [observacoes, setObservacoes] = useState('');

  // Divisão de Lotes
  const [tipoDivisao, setTipoDivisao] = useState<'unico' | 'quantidade_lotes' | 'tamanho_lote'>('unico');
  const [quantidadeLotes, setQuantidadeLotes] = useState<string>('2');
  const [tamanhoLote, setTamanhoLote] = useState<string>('');

  // Financeiro
  const [financeiroAberto, setFinanceiroAberto] = useState(false);
  const [precoUnitario, setPrecoUnitario] = useState<string>('');
  const [poCliente, setPoCliente] = useState('');
  const [statusFiscal, setStatusFiscal] = useState('');
  const [numeroFiscal, setNumeroFiscal] = useState('');

  const [erro, setErro] = useState<string | null>(null);

  // Hooks
  const createOS = useCreateOS();
  const { data: artigosData } = useArtigosList();
  const { data: clientesData } = useClientes();

  const artigos = (artigosData ?? []).filter((a) => a.status === 'ativo');
  const clientes = clientesData?.data ?? [];

  // Filtro de busca
  const sugestoes = useMemo(() => {
    if (!buscaArtigo) return [];
    if (artigoId) return []; // já selecionou
    const termo = buscaArtigo.toLowerCase();
    return artigos
      .filter(
        (a) =>
          a.codigo.toLowerCase().includes(termo) ||
          a.descricao.toLowerCase().includes(termo),
      )
      .slice(0, 8);
  }, [buscaArtigo, artigoId, artigos]);

  const artigoSelecionado = artigos.find((a) => a.id === artigoId);

  // Quando seleciona Artigo, sugere cliente padrão automaticamente
  useEffect(() => {
    if (!artigoId) return;
    const a = artigos.find((x) => x.id === artigoId);
    if (a && !clienteId) {
      setClienteId(a.clienteId);
    }
  }, [artigoId]);

  // Cálculo automático de valor total
  const valorTotalCalculado = useMemo(() => {
    const qtd = parseFloat(quantidadeTotal);
    const preco = parseFloat(precoUnitario);
    if (isNaN(qtd) || isNaN(preco)) return null;
    return qtd * preco;
  }, [quantidadeTotal, precoUnitario]);

  // Preview da divisão
  const previewLotes = useMemo<number[]>(() => {
    const total = parseInt(quantidadeTotal, 10);
    if (isNaN(total) || total <= 0) return [];
    if (tipoDivisao === 'unico') return [total];
    if (tipoDivisao === 'quantidade_lotes') {
      const n = parseInt(quantidadeLotes, 10);
      if (isNaN(n) || n <= 0 || n > total) return [total];
      const base = Math.floor(total / n);
      const resto = total - base * n;
      return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
    }
    if (tipoDivisao === 'tamanho_lote') {
      const x = parseInt(tamanhoLote, 10);
      if (isNaN(x) || x <= 0 || x >= total) return [total];
      const lotes: number[] = [];
      let restante = total;
      while (restante > 0) {
        const q = Math.min(x, restante);
        lotes.push(q);
        restante -= q;
      }
      return lotes;
    }
    return [total];
  }, [quantidadeTotal, tipoDivisao, quantidadeLotes, tamanhoLote]);

  // Validações pra habilitar botão
  const formValido = useMemo(() => {
    if (!artigoId) return false;
    if (!codigoGrv.trim()) return false;
    if (!clienteId) return false;
    const qtd = parseInt(quantidadeTotal, 10);
    if (isNaN(qtd) || qtd < 1) return false;
    if (!prazoEntrega) return false;
    const prazo = new Date(prazoEntrega);
    if (prazo.getTime() <= Date.now()) return false;
    // Validar divisão escolhida
    if (tipoDivisao === 'quantidade_lotes') {
      const n = parseInt(quantidadeLotes, 10);
      if (isNaN(n) || n < 1 || n > qtd) return false;
    }
    if (tipoDivisao === 'tamanho_lote') {
      const x = parseInt(tamanhoLote, 10);
      if (isNaN(x) || x < 1) return false;
    }
    return true;
  }, [artigoId, codigoGrv, clienteId, quantidadeTotal, prazoEntrega, tipoDivisao, quantidadeLotes, tamanhoLote]);

  function selecionarArtigo(id: string, codigo: string, descricao: string) {
    setArtigoId(id);
    setBuscaArtigo(`${codigo} — ${descricao}`);
  }

  function limparArtigo() {
    setArtigoId(null);
    setBuscaArtigo('');
    setClienteId('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formValido) return;
    setErro(null);

    // Monta divisao
    let divisao: DivisaoLotes;
    if (tipoDivisao === 'unico') {
      divisao = { tipoDivisao: 'unico' };
    } else if (tipoDivisao === 'quantidade_lotes') {
      divisao = {
        tipoDivisao: 'quantidade_lotes',
        quantidadeLotes: parseInt(quantidadeLotes, 10),
      };
    } else {
      divisao = {
        tipoDivisao: 'tamanho_lote',
        tamanhoLote: parseInt(tamanhoLote, 10),
      };
    }

    const input: CreateOSInput = {
      codigoGrv: codigoGrv.trim(),
      clienteId,
      artigoId: artigoId!,
      quantidadeTotal: parseInt(quantidadeTotal, 10),
      prazoEntrega: new Date(prazoEntrega).toISOString(),
      prioridade,
      observacoes: observacoes.trim() || null,
      precoUnitario: precoUnitario ? parseFloat(precoUnitario) : null,
      valorTotal: valorTotalCalculado,
      numeroFiscal: numeroFiscal.trim() || null,
      poCliente: poCliente.trim() || null,
      statusFiscal: statusFiscal.trim() || null,
      divisao,
    };

    try {
      const res = await createOS.mutateAsync(input);
      onCreated(res.data.id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Erro ao criar OS. Tente novamente.';
      setErro(msg);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Nova Ordem de Serviço" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============ BUSCA DE ARTIGO ============ */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Artigo *
          </label>
          <div className="relative">
            <input
              type="text"
              value={buscaArtigo}
              onChange={(e) => {
                setBuscaArtigo(e.target.value);
                if (artigoId) setArtigoId(null);
              }}
              placeholder="Digite código ou descrição..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
              autoFocus
            />
            {artigoId && (
              <button
                type="button"
                onClick={limparArtigo}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-100 px-2 py-1 text-xs"
              >
                Limpar
              </button>
            )}
            {sugestoes.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {sugestoes.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => selecionarArtigo(a.id, a.codigo, a.descricao)}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-700 text-sm border-b border-neutral-700/50 last:border-b-0"
                  >
                    <div className="font-mono text-forja-400">{a.codigo}</div>
                    <div className="text-xs text-neutral-400">{a.descricao}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============ PREVIEW DO ARTIGO ============ */}
        {artigoSelecionado && (
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-3 text-sm space-y-1">
            <div className="flex gap-4">
              <span className="text-neutral-400">Tipo:</span>
              <span className="text-neutral-200">
                {artigoSelecionado.tipoProduto ?? '—'}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-neutral-400">Material:</span>
              <span className="text-neutral-200">
                {artigoSelecionado.material ?? '—'}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-neutral-400">Cliente padrão:</span>
              <span className="text-neutral-200">
                {artigoSelecionado.cliente?.nome ?? '—'}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-neutral-400">Operações cadastradas:</span>
              <span className="text-neutral-200">
                {artigoSelecionado._count?.operacoes ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* ============ IDENTIFICAÇÃO ============ */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Código GRV *
            </label>
            <input
              type="text"
              value={codigoGrv}
              onChange={(e) => setCodigoGrv(e.target.value)}
              placeholder="ex: 1-11638/001"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-mono focus:border-forja-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Cliente *
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Quantidade Total *
            </label>
            <input
              type="number"
              min="1"
              value={quantidadeTotal}
              onChange={(e) => setQuantidadeTotal(e.target.value)}
              placeholder="ex: 6"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-mono focus:border-forja-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
              Prazo de Entrega *
            </label>
            <input
              type="date"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Prioridade */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">
            Prioridade
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="prioridade"
                value="normal"
                checked={prioridade === 'normal'}
                onChange={() => setPrioridade('normal')}
                className="accent-forja-500"
              />
              <span className="text-sm">Normal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="prioridade"
                value="urgente"
                checked={prioridade === 'urgente'}
                onChange={() => setPrioridade('urgente')}
                className="accent-forja-500"
              />
              <span className="text-sm text-red-400 font-medium">Urgente</span>
            </label>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none resize-none"
          />
        </div>

        {/* ============ DIVISÃO DE LOTES ============ */}
        <div className="bg-neutral-800/30 border border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-3">
            Divisão de Lotes
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="divisao"
                checked={tipoDivisao === 'unico'}
                onChange={() => setTipoDivisao('unico')}
                className="accent-forja-500"
              />
              <span className="text-sm">Lote único ({quantidadeTotal || '?'} peças)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="divisao"
                checked={tipoDivisao === 'quantidade_lotes'}
                onChange={() => setTipoDivisao('quantidade_lotes')}
                className="accent-forja-500"
              />
              <span className="text-sm">Múltiplos lotes</span>
              {tipoDivisao === 'quantidade_lotes' && (
                <>
                  <span className="text-sm text-neutral-400">→</span>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={quantidadeLotes}
                    onChange={(e) => setQuantidadeLotes(e.target.value)}
                    className="w-16 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm font-mono"
                  />
                  <span className="text-sm text-neutral-400">lotes</span>
                </>
              )}
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="divisao"
                checked={tipoDivisao === 'tamanho_lote'}
                onChange={() => setTipoDivisao('tamanho_lote')}
                className="accent-forja-500"
              />
              <span className="text-sm">Por tamanho máximo</span>
              {tipoDivisao === 'tamanho_lote' && (
                <>
                  <span className="text-sm text-neutral-400">→</span>
                  <input
                    type="number"
                    min="1"
                    value={tamanhoLote}
                    onChange={(e) => setTamanhoLote(e.target.value)}
                    className="w-16 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm font-mono"
                  />
                  <span className="text-sm text-neutral-400">peças por lote</span>
                </>
              )}
            </label>
          </div>

          {previewLotes.length > 0 && tipoDivisao !== 'unico' && (
            <div className="mt-3 text-xs text-neutral-400">
              Será gerado:{' '}
              <span className="text-forja-400 font-mono">
                {previewLotes.length} lote{previewLotes.length > 1 ? 's' : ''}
              </span>{' '}
              ({previewLotes.join(' + ')} peças)
            </div>
          )}
        </div>

        {/* ============ FINANCEIRO (colapsável) ============ */}
        <div className="border border-neutral-700 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setFinanceiroAberto(!financeiroAberto)}
            className="w-full px-4 py-3 bg-neutral-800/50 hover:bg-neutral-800 flex items-center justify-between text-sm font-medium transition"
          >
            <span className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`transition-transform ${
                  financeiroAberto ? 'rotate-90' : ''
                }`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Financeiro
              <span className="text-xs text-neutral-500 font-normal">(opcional)</span>
            </span>
            {valorTotalCalculado !== null && (
              <span className="text-forja-400 font-mono text-xs">
                {valorTotalCalculado.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            )}
          </button>

          {financeiroAberto && (
            <div className="p-4 bg-neutral-900 grid grid-cols-2 gap-3">
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
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-mono focus:border-forja-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                  Valor total
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
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
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
                  placeholder="FERRO, OK, PASIFER..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                  Nº fiscal (NF)
                </label>
                <input
                  type="text"
                  value={numeroFiscal}
                  onChange={(e) => setNumeroFiscal(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {erro}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!formValido || createOS.isPending}
            className="px-4 py-2 bg-forja-500 hover:bg-forja-600 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition"
          >
            {createOS.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
