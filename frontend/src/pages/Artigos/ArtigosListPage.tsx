// ============================================================
// Forja - Lista de Artigos
// Tela principal de gestão. CRUD básico + filtros + drill down.
// ============================================================

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ObservacaoBadge } from '../../components/ObservacaoBadge';
import { useClientesList } from '../../hooks/useClientes';
import {
  useArtigosList,
  useCreateArtigo,
  useDeleteArtigo,
  type Artigo,
  type TipoProduto,
} from '../../hooks/useArtigos';

const TIPOS_PRODUTO: { value: TipoProduto; label: string }[] = [
  { value: 'forma', label: 'Forma' },
  { value: 'bloco', label: 'Bloco' },
  { value: 'fundo_forma', label: 'Fundo de Forma' },
  { value: 'fundo_bloco', label: 'Fundo de Bloco' },
  { value: 'molde', label: 'Molde' },
];

const LABELS_TIPO: Record<TipoProduto, string> = {
  forma: 'Forma',
  bloco: 'Bloco',
  fundo_forma: 'Fundo de Forma',
  fundo_bloco: 'Fundo de Bloco',
  molde: 'Molde',
};

const LABELS_STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  arquivado: 'Arquivado',
};

export function ArtigosListPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [criando, setCriando] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [deletando, setDeletando] = useState<Artigo | null>(null);

  const { data: clientes } = useClientesList();
  const { data: artigos, isLoading, isError } = useArtigosList({
    ativo: mostrarInativos ? undefined : true,
    clienteId: clienteFiltro || undefined,
  });
  const deleteMut = useDeleteArtigo();

  // Busca client-side (código + descrição)
  const artigosFiltrados = useMemo(() => {
    if (!artigos) return [];
    const buscaLower = busca.trim().toLowerCase();
    if (!buscaLower) return artigos;
    return artigos.filter(
      (a) =>
        a.codigo.toLowerCase().includes(buscaLower) ||
        a.descricao.toLowerCase().includes(buscaLower)
    );
  }, [artigos, busca]);

  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    try {
      await deleteMut.mutateAsync(deletando.id);
      setDeletando(null);
    } catch (err) {
      // erro fica em deleteMut.isError
    }
  };

  return (
    <AppLayout title="Artigos" voltarPara="/">
      <div className="space-y-6">
        {/* Barra de filtros + ação */}
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Buscar</label>
              <input
                type="text"
                placeholder="Código ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Cliente</label>
              <select
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
                className="input"
              >
                <option value="">Todos</option>
                {clientes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setCriando(true)}
                className="btn-primary px-5 py-3 w-full"
              >
                + Novo Artigo
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-300 select-none cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="w-4 h-4 accent-forja-500"
            />
            Mostrar inativos
          </label>
        </div>

        {/* Erro de delete */}
        {deleteMut.isError && (
          <div className="error-message">
            Erro ao desativar:{' '}
            {(deleteMut.error as any)?.response?.data?.message ??
              'Tente novamente.'}
          </div>
        )}

        {/* Estados */}
        {isLoading && (
          <div className="card text-center text-neutral-400">Carregando...</div>
        )}
        {isError && (
          <div className="error-message">
            Não foi possível carregar os Artigos.
          </div>
        )}
        {!isLoading && !isError && artigosFiltrados.length === 0 && (
          <div className="card text-center text-neutral-400">
            {busca || clienteFiltro
              ? 'Nenhum Artigo bate com os filtros.'
              : 'Nenhum Artigo cadastrado. Clique em "+ Novo Artigo" para começar.'}
          </div>
        )}

        {/* Tabela */}
        {artigosFiltrados.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Descrição</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {artigosFiltrados.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-mono text-neutral-100">
                      <span className="inline-flex items-center gap-1.5">{a.codigo}<ObservacaoBadge texto={a.observacoes} /></span>
                    </td>
                    <td className="px-4 py-3 text-neutral-200">
                      {a.descricao}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 text-xs">
                      {a.cliente?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 text-xs">
                      {LABELS_TIPO[a.tipoProduto]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        a.status === 'ativo'
                          ? 'badge-forja'
                          : a.status === 'arquivado'
                          ? 'badge-neutral opacity-60'
                          : 'badge-neutral'
                      }>
                        {LABELS_STATUS[a.status]}
                      </span>
                      {!a.ativo && (
                        <span className="badge-neutral ml-2 opacity-60">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/artigos/${a.id}`)}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => setDeletando(a)}
                        className="btn px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                      >
                        Desativar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de criação */}
      <NovoArtigoModal
        open={criando}
        onClose={() => setCriando(false)}
        onCreated={(id) => {
          setCriando(false);
          navigate(`/artigos/${id}`);
        }}
      />

      {/* Confirmação de desativação */}
      <ConfirmDialog
        open={deletando !== null}
        title="Desativar Artigo"
        message={
          deletando
            ? `Tem certeza que deseja desativar "${deletando.codigo}"? O Artigo ficará oculto da lista mas pode ser reativado depois marcando "Mostrar inativos".`
            : ''
        }
        confirmLabel="Desativar"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmarDelete}
        onCancel={() => setDeletando(null)}
      />
    </AppLayout>
  );
}

// ============================================================
// Modal de Novo Artigo (dados básicos apenas)
// ============================================================

interface NovoArtigoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

function NovoArtigoModal({ open, onClose, onCreated }: NovoArtigoModalProps) {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoProduto, setTipoProduto] = useState<TipoProduto>('forma');
  const [clienteId, setClienteId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: clientes } = useClientesList();
  const createMut = useCreateArtigo();

  useEffect(() => {
    if (open) {
      setCodigo('');
      setDescricao('');
      setTipoProduto('forma');
      setClienteId('');
      setErro(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

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
      const artigo = await createMut.mutateAsync({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        tipoProduto,
        clienteId,
      });
      onCreated(artigo.id);
    } catch (err: any) {
      const mensagem =
        err?.response?.data?.message ??
        err?.message ??
        'Erro ao criar Artigo. Tente novamente.';
      setErro(mensagem);
    }
  };

  const loading = createMut.isPending;

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Novo Artigo"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="novo-artigo-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Criando...' : 'Criar e Editar'}
          </button>
        </>
      }
    >
      <form id="novo-artigo-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Código *</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="input"
            placeholder="Ex: 070-FOFO-Q3"
            autoFocus
          />
        </div>

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

        <div>
          <label className="label">Cliente *</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="input"
          >
            <option value="">Selecione...</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-neutral-500">
          Após criar, você poderá adicionar desenhos, operações e plano de inspeção.
        </p>
      </form>
    </Modal>
  );
}
