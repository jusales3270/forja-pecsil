// ============================================================
// Forja - Aba 1: Dados Básicos do Artigo
// Edição direta dos campos cadastrais
// ============================================================

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useClientesList } from '../../../hooks/useClientes';
import {
  useUpdateArtigo,
  type Artigo,
  type TipoProduto,
} from '../../../hooks/useArtigos';

const TIPOS_PRODUTO: { value: TipoProduto; label: string }[] = [
  { value: 'arruela', label: 'Arruela' },
  { value: 'bloco', label: 'Bloco' },
  { value: 'cabeca_sopro', label: 'Cabeça de Sopro' },
  { value: 'forma', label: 'Forma' },
  { value: 'forminha', label: 'Forminha' },
  { value: 'fundo_bloco', label: 'Fundo de Bloco' },
  { value: 'fundo_forma', label: 'Fundo de Forma' },
  { value: 'funil', label: 'Funil' },
  { value: 'molde', label: 'Molde' },
  { value: 'puncao', label: 'Punção' },
];

interface DadosBasicosTabProps {
  artigo: Artigo;
}

export function DadosBasicosTab({ artigo }: DadosBasicosTabProps) {
  const { data: clientes } = useClientesList();
  const updateMut = useUpdateArtigo();

  const [codigo, setCodigo] = useState(artigo.codigo);
  const [descricao, setDescricao] = useState(artigo.descricao);
  const [tipoProduto, setTipoProduto] = useState<TipoProduto>(artigo.tipoProduto);
  const [clienteId, setClienteId] = useState(artigo.clienteId);
  const [clienteBusca, setClienteBusca] = useState('');
  const [material, setMaterial] = useState(artigo.material ?? '');
  const [poPadrao, setPoPadrao] = useState(artigo.poPadrao ?? '');
  const [observacoes, setObservacoes] = useState(artigo.observacoes ?? '');

  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Re-sincroniza quando o artigo muda (ex: depois de salvar)
  useEffect(() => {
    setCodigo(artigo.codigo);
    setDescricao(artigo.descricao);
    setTipoProduto(artigo.tipoProduto);
    setClienteId(artigo.clienteId);
    setClienteBusca('');
    setMaterial(artigo.material ?? '');
    setPoPadrao(artigo.poPadrao ?? '');
    setObservacoes(artigo.observacoes ?? '');
  }, [artigo]);

  // Detecta mudanças não salvas
  const temMudancas =
    codigo !== artigo.codigo ||
    descricao !== artigo.descricao ||
    tipoProduto !== artigo.tipoProduto ||
    clienteId !== artigo.clienteId ||
    material !== (artigo.material ?? '') ||
    poPadrao !== (artigo.poPadrao ?? '') ||
    observacoes !== (artigo.observacoes ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    if (!codigo.trim()) {
      setErro('Código é obrigatório');
      return;
    }
    if (!descricao.trim()) {
      setErro('Descrição é obrigatória');
      return;
    }
    if (!clienteId) {
      setErro('Selecione um cliente');
      return;
    }

    try {
      await updateMut.mutateAsync({
        id: artigo.id,
        input: {
          codigo: codigo.trim(),
          descricao: descricao.trim(),
          tipoProduto,
          clienteId,
          material: material.trim() || null,
          poPadrao: poPadrao.trim() || null,
          observacoes: observacoes.trim() || null,
        },
      });
      setSucesso(true);
      // Esconde a mensagem de sucesso depois de 3s
      setTimeout(() => setSucesso(false), 3000);
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ??
          err?.message ??
          'Erro ao salvar. Tente novamente.'
      );
    }
  };

  const handleReset = () => {
    setCodigo(artigo.codigo);
    setDescricao(artigo.descricao);
    setTipoProduto(artigo.tipoProduto);
    setClienteId(artigo.clienteId);
    setClienteBusca('');
    setMaterial(artigo.material ?? '');
    setPoPadrao(artigo.poPadrao ?? '');
    setObservacoes(artigo.observacoes ?? '');
    setErro(null);
  };

  // Sugestões de cliente por nome, enquanto o usuário digita
  const sugestoesCliente = useMemo(() => {
    const termo = clienteBusca.trim().toLowerCase();
    if (!termo) return [];
    return (clientes ?? [])
      .filter((c) => c.nome.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [clienteBusca, clientes]);

  const nomeClienteAtual =
    artigo.cliente?.nome ?? clientes?.find((c) => c.id === clienteId)?.nome ?? null;

  function selecionarCliente(id: string, nome: string) {
    setClienteId(id);
    setClienteBusca(nome);
  }

  const loading = updateMut.isPending;

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      {erro && <div className="error-message">{erro}</div>}
      {sucesso && (
        <div className="info-message">Dados salvos com sucesso.</div>
      )}

      {/* Linha: código + tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Código *</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="input"
            placeholder="Ex: 070-FOFO-Q3"
          />
        </div>
        <div>
          <label className="label">Tipo de Produto *</label>
          <select
            value={tipoProduto}
            onChange={(e) => setTipoProduto(e.target.value as TipoProduto)}
            className="input"
          >
            {TIPOS_PRODUTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="label">Descrição *</label>
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="input"
          placeholder="Ex: FORMA GFA. CHAMPANHA 187ML"
        />
      </div>

      {/* Cliente */}
      <div>
        <label className="label">Cliente *</label>
        <div className="relative">
          <input
            type="text"
            value={clienteBusca}
            onChange={(e) => setClienteBusca(e.target.value)}
            className="input"
            placeholder="Digite o nome do cliente..."
            autoComplete="off"
          />
          {sugestoesCliente.length > 0 && (
            <div className="dropdown-panel absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto">
              {sugestoesCliente.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selecionarCliente(c.id, c.nome)}
                  className="dropdown-panel-item w-full text-left px-3 py-2 text-sm"
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Cliente atual: {nomeClienteAtual ?? '—'}
          {clienteId !== artigo.clienteId && ' (alteração pendente de salvar)'}
        </p>
      </div>

      {/* Linha: material + PO padrão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Material</label>
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="input"
            placeholder="Ex: Ferro fundido nodular, Aço 1045..."
          />
          <p className="text-xs text-neutral-500 mt-1">Opcional</p>
        </div>
        <div>
          <label className="label">PO Padrão</label>
          <input
            type="text"
            value={poPadrao}
            onChange={(e) => setPoPadrao(e.target.value)}
            className="input"
            placeholder="Ex: PO-2024-001"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Pedido de Compra de referência, se aplicável
          </p>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="label">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input"
          rows={4}
          placeholder="Observações livres sobre o Artigo, particularidades, histórico..."
        />
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
        {temMudancas && (
          <span className="text-xs text-neutral-500 mr-auto">
            Mudanças não salvas
          </span>
        )}
        <button
          type="button"
          onClick={handleReset}
          disabled={loading || !temMudancas}
          className="btn-ghost px-4 py-2 text-sm"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={loading || !temMudancas}
          className="btn-primary px-5 py-2 text-sm"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
