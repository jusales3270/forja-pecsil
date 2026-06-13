// ============================================================
// Forja - Aba 2: Desenhos do Artigo
// Lista compacta + modal de criar/editar com upload integrado
// ============================================================

import { useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ObservacaoBadge } from '../../../components/ObservacaoBadge';
import {
  useDesenhosList,
  useDeleteDesenho,
  useUploadDesenhoArquivo,
  obterUrlDesenho,
  LABELS_TIPO_DESENHO,
  type Desenho,
} from '../../../hooks/useDesenhos';
import { DesenhoModal } from './DesenhoModal';

interface DesenhosTabProps {
  artigoId: string;
}

export function DesenhosTab({ artigoId }: DesenhosTabProps) {
  const { data: desenhos, isLoading, isError } = useDesenhosList(artigoId);
  const deleteMut = useDeleteDesenho(artigoId);
  const uploadMut = useUploadDesenhoArquivo(artigoId);

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Desenho | null>(null);
  const [deletando, setDeletando] = useState<Desenho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindoUrl, setAbrindoUrl] = useState<string | null>(null);

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
    try {
      await uploadMut.mutateAsync({ id: desenho.id, arquivo: file });
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao subir arquivo');
    }
  };

  // Visualizar arquivo via URL assinada
  const handleVisualizar = async (desenho: Desenho) => {
    setErro(null);
    setAbrindoUrl(desenho.id);
    try {
      const url = await obterUrlDesenho(artigoId, desenho.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao gerar URL');
    } finally {
      setAbrindoUrl(null);
    }
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
                        disabled={abrindoUrl === d.id}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1"
                      >
                        {abrindoUrl === d.id ? 'Abrindo...' : 'Visualizar'}
                      </button>
                    )}
                    <label className="btn-ghost px-3 py-1.5 text-xs mr-1 cursor-pointer inline-block">
                      {d.arquivoKey ? 'Substituir' : 'Subir arquivo'}
                      <input
                        type="file"
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
                      className="btn-ghost px-3 py-1.5 text-xs mr-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletando(d)}
                      className="btn px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200"
                    >
                      Deletar
                    </button>
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
