// ============================================================
// Forja - Modal de criar/editar Desenho
// Suporta upload de arquivo opcional durante a criação
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../../../components/Modal';
import {
  useCreateDesenho,
  useUpdateDesenho,
  useUploadDesenhoArquivo,
  LABELS_TIPO_DESENHO,
  type Desenho,
  type TipoDesenho,
} from '../../../hooks/useDesenhos';

interface DesenhoModalProps {
  open: boolean;
  artigoId: string;
  desenho: Desenho | null;
  onClose: () => void;
}

const TIPOS_OPCOES: TipoDesenho[] = ['cliente', 'forma', 'acompanhamento_dim'];

export function DesenhoModal({
  open,
  artigoId,
  desenho,
  onClose,
}: DesenhoModalProps) {
  const ehEdicao = desenho !== null;

  const [tipo, setTipo] = useState<TipoDesenho>('cliente');
  const [codigoDesenho, setCodigoDesenho] = useState('');
  const [revisao, setRevisao] = useState('');
  const [dataRevisao, setDataRevisao] = useState(''); // YYYY-MM-DD
  const [observacoes, setObservacoes] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const createMut = useCreateDesenho(artigoId);
  const updateMut = useUpdateDesenho(artigoId);
  const uploadMut = useUploadDesenhoArquivo(artigoId);

  useEffect(() => {
    if (open) {
      setTipo(desenho?.tipo ?? 'cliente');
      setCodigoDesenho(desenho?.codigoDesenho ?? '');
      setRevisao(desenho?.revisao ?? '');
      // Converte ISO de volta pra YYYY-MM-DD pro input date
      setDataRevisao(
        desenho?.dataRevisao
          ? desenho.dataRevisao.slice(0, 10)
          : ''
      );
      setObservacoes(desenho?.observacoes ?? '');
      setArquivo(null);
      setErro(null);
    }
  }, [open, desenho]);

  const loading =
    createMut.isPending || updateMut.isPending || uploadMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!codigoDesenho.trim()) {
      setErro('Código do desenho é obrigatório');
      return;
    }
    if (!revisao.trim()) {
      setErro('Revisão é obrigatória');
      return;
    }

    // Converte YYYY-MM-DD pro ISO datetime esperado pelo backend
    let dataRevisaoIso: string | undefined;
    if (dataRevisao) {
      try {
        // Adiciona meio-dia UTC pra evitar surpresas de timezone
        dataRevisaoIso = new Date(`${dataRevisao}T12:00:00Z`).toISOString();
      } catch {
        setErro('Data de revisão inválida');
        return;
      }
    }

    try {
      const payload = {
        tipo,
        codigoDesenho: codigoDesenho.trim(),
        revisao: revisao.trim(),
        dataRevisao: dataRevisaoIso,
        observacoes: observacoes.trim() || null,
      };

      let desenhoSalvo: Desenho;
      if (ehEdicao && desenho) {
        desenhoSalvo = await updateMut.mutateAsync({
          id: desenho.id,
          input: payload,
        });
      } else {
        desenhoSalvo = await createMut.mutateAsync(payload);
      }

      // Se tem arquivo selecionado, sobe agora
      if (arquivo) {
        await uploadMut.mutateAsync({ id: desenhoSalvo.id, arquivo });
      }

      onClose();
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ??
          err?.message ??
          'Erro ao salvar. Tente novamente.'
      );
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar Desenho' : 'Novo Desenho'}
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
            form="desenho-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="desenho-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Tipo *</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDesenho)}
            className="input"
          >
            {TIPOS_OPCOES.map((t) => (
              <option key={t} value={t}>
                {LABELS_TIPO_DESENHO[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Código do Desenho *</label>
            <input
              type="text"
              value={codigoDesenho}
              onChange={(e) => setCodigoDesenho(e.target.value)}
              className="input"
              placeholder="Ex: 2IS-5-070-F-VFW"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Revisão *</label>
            <input
              type="text"
              value={revisao}
              onChange={(e) => setRevisao(e.target.value)}
              className="input"
              placeholder="Ex: 01, A, B2"
            />
          </div>
        </div>

        <div>
          <label className="label">Data da Revisão</label>
          <input
            type="date"
            value={dataRevisao}
            onChange={(e) => setDataRevisao(e.target.value)}
            className="input"
          />
          <p className="text-xs text-neutral-500 mt-1">Opcional</p>
        </div>

        {/* Upload de arquivo */}
        <div>
          <label className="label">Arquivo (PDF, PNG, JPG)</label>
          {desenho?.arquivoKey && !arquivo && (
            <div className="text-xs text-neutral-400 mb-2">
              Arquivo atual:{' '}
              <span className="text-neutral-200">
                {desenho.arquivoNomeOriginal ?? desenho.arquivoKey}
              </span>{' '}
              ({formatBytes(desenho.arquivoTamanho ?? 0)})
            </div>
          )}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-neutral-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer"
          />
          {arquivo && (
            <p className="text-xs text-neutral-400 mt-2">
              Novo arquivo selecionado:{' '}
              <span className="text-neutral-200">{arquivo.name}</span> (
              {formatBytes(arquivo.size)})
              {desenho?.arquivoKey && ' — substituirá o atual'}
            </p>
          )}
          <p className="text-xs text-neutral-500 mt-1">
            Opcional. Limite 50 MB. Pode subir depois pela tabela.
          </p>
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input"
            rows={2}
            placeholder="Opcional — notas sobre a revisão, mudanças, etc."
          />
        </div>
      </form>
    </Modal>
  );
}
