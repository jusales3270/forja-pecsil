import { useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ObservacaoBadge } from '../../../components/ObservacaoBadge';
import { VisualizadorDesenhoModal } from '../../../components/VisualizadorDesenhoModal';
import {
  useDesenhosList,
  useDeleteDesenho,
  useUploadDesenhoArquivo,
  LABELS_TIPO_DESENHO,
  type Desenho,
} from '../../../hooks/useDesenhos';
import { DesenhoModal } from './DesenhoModal';
import { useAuth } from '../../../lib/auth-store';
import { temCapacidade } from '../../../lib/permissions';

interface DesenhosTabProps {
  artigoId: string;
  artigo?: {
    id: string;
    codigo: string;
    descricao?: string;
  };
}

export function DesenhosTab({ artigoId, artigo }: DesenhosTabProps) {
  const pessoa = useAuth((s) => s.pessoa);
  const ehAdmin = temCapacidade(pessoa, 'excluir_dados');

  const { data: desenhos, isLoading, isError } = useDesenhosList(artigoId);
  const deleteMut = useDeleteDesenho(artigoId);
  const uploadMut = useUploadDesenhoArquivo(artigoId);

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Desenho | null>(null);
  const [deletando, setDeletando] = useState<Desenho | null>(null);
  const [visualizando, setVisualizando] = useState<Desenho | null>(null);
  const [uploadandoId, setUploadandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    setErro(null);
    try {
      await deleteMut.mutateAsync(deletando.id);
      setDeletando(null);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao deletar');
    }
  };

  // Upload direto da tabela (input file escondido)
  const handleUploadInline = async (desenho: Desenho, file: File) => {
    setErro(null);
    setUploadandoId(desenho.id);
    try {
      await uploadMut.mutateAsync({ id: desenho.id, arquivo: file });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao subir arquivo');
    } finally {
      setUploadandoId(null);
    }
  };

  // Visualizar arquivo via modal integrado
  const handleVisualizar = (desenho: Desenho) => {
    setVisualizando(desenho);
  };


  const formatBytes = (bytes: number | null) => {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-400">
          {desenhos && desenhos.length > 0
            ? `${desenhos.length} desenho(s) cadastrado(s)`
            : 'Nenhum desenho cadastrado ainda'}
        </div>
        <button
          onClick={() => setCriando(true)}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Novo Desenho
        </button>
      </div>

      {erro && <div className="error-message">{erro}</div>}

      {/* Estados */}
      {isLoading && (
        <div className="card text-center text-neutral-400">Carregando...</div>
      )}
      {isError && (
        <div className="error-message">
          Não foi possível carregar os desenhos.
        </div>
      )}
      {!isLoading && !isError && desenhos && desenhos.length === 0 && (
        <div className="card text-center text-neutral-400">
          <p className="text-neutral-300 mb-2">
            Nenhum desenho anexado a este Artigo.
          </p>
          <p className="text-sm">
            Recomendado cadastrar: desenho do cliente, desenho da forma e folha
            de acompanhamento dimensional.
          </p>
        </div>
      )}

      {/* Tabela */}
      {desenhos && desenhos.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3">Tipo</th>
                <th className="text-left px-3 py-3">Código</th>
                <th className="text-left px-3 py-3">Revisão</th>
                <th className="text-left px-3 py-3">Data</th>
                <th className="text-left px-3 py-3">Arquivo</th>
                <th className="text-right px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {desenhos.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-800/30">
                  <td className="px-3 py-3 text-neutral-200">
                    {LABELS_TIPO_DESENHO[d.tipo]}
                  </td>
                  <td className="px-3 py-3 font-mono text-neutral-100">
                    <span className="inline-flex items-center gap-1.5">{d.codigoDesenho}<ObservacaoBadge texto={d.observacoes} /></span>
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs font-mono">
                    {d.revisao}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {formatDate(d.dataRevisao)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {d.arquivoKey ? (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-200 truncate max-w-xs">
                          {d.arquivoNomeOriginal ?? d.arquivoKey}
                        </span>
                        <span className="text-neutral-500">
                          ({formatBytes(d.arquivoTamanho)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-neutral-500 italic">
                        sem arquivo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {d.arquivoKey && (
                      <button
                        onClick={() => handleVisualizar(d)}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1 text-forja-400 hover:text-forja-300 font-semibold"
                      >
                        Visualizar
                      </button>
                    )}
                    <label className="btn-ghost px-3 py-1.5 text-xs mr-1 cursor-pointer inline-block">
                      {uploadandoId === d.id
                        ? 'Enviando...'
                        : d.arquivoKey
                        ? 'Substituir'
                        : 'Subir arquivo'}
                      <input
                        type="file"
                        disabled={uploadandoId === d.id}
                        className="hidden"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadInline(d, file);
                            e.target.value = ''; // reset pra permitir mesmo arquivo de novo
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setEditando(d)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-forja-500/15 hover:bg-forja-500 text-forja-300 hover:text-white border border-forja-500/40 transition shadow-sm mr-1"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      Editar
                    </button>
                    {ehAdmin && (
                      <button
                        onClick={() => setDeletando(d)}
                        className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:text-red-300 ml-1"
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar/editar */}
      <DesenhoModal
        open={criando || editando !== null}
        artigoId={artigoId}
        desenho={editando}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      {/* Visualizador de Desenhos */}
      {visualizando && (
        <VisualizadorDesenhoModal
          open={true}
          artigo={artigo ?? { id: artigoId, codigo: visualizando.codigoDesenho }}
          desenhos={desenhos ?? []}
          desenhoInicialId={visualizando.id}
          onClose={() => setVisualizando(null)}
        />
      )}

      {/* Confirmação de delete */}
      <ConfirmDialog
        open={deletando !== null}
        title="Deletar Desenho"
        message={
          deletando
            ? `Tem certeza que deseja deletar o desenho "${deletando.codigoDesenho}" (rev. ${deletando.revisao})? ${
                deletando.arquivoKey
                  ? 'O arquivo anexado também será apagado.'
                  : ''
              } Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Deletar"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmarDelete}
        onCancel={() => setDeletando(null)}
      />
    </div>
  );
}

