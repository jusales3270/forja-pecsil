// ============================================================
// Forja - Modal de criar/editar Desenho
// Na criação aceita vários arquivos de uma vez: cada arquivo vira um desenho
// do artigo (código sugerido pelo nome do arquivo). Na edição, um arquivo
// substitui o atual.
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

/** Código sugerido a partir do nome do arquivo: "2IS-5-070-F.pdf" → "2IS-5-070-F". */
export function codigoDoArquivo(nome: string): string {
  return nome.replace(/\.[^.]+$/, '').trim().slice(0, 200);
}

interface ArquivoNovo {
  chave: string;
  arquivo: File;
  codigo: string;
  erro?: string;
}

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
  // Criação com vários arquivos: um desenho por arquivo
  const [arquivos, setArquivos] = useState<ArquivoNovo[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const variosArquivos = !ehEdicao && arquivos.length > 1;

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
      setArquivos([]);
      setProgresso(null);
      setErro(null);
    }
  }, [open, desenho]);

  function escolherArquivos(lista: FileList | null) {
    const escolhidos = Array.from(lista ?? []);
    if (ehEdicao) {
      setArquivo(escolhidos[0] ?? null);
      return;
    }
    const novos = escolhidos.map((f, i) => ({ chave: `${Date.now()}-${i}-${f.name}`, arquivo: f, codigo: codigoDoArquivo(f.name) }));
    // Soma aos já escolhidos (dá pra selecionar de pastas diferentes). O
    // código que já foi digitado para o primeiro arquivo é mantido.
    const anteriores = arquivos.length === 1 && codigoDesenho.trim()
      ? [{ ...arquivos[0], codigo: codigoDesenho.trim() }]
      : arquivos;
    const todos = [...anteriores, ...novos];
    setArquivos(todos);
    setArquivo(todos.length === 1 ? todos[0].arquivo : null);
    if (todos.length === 1 && !codigoDesenho.trim()) setCodigoDesenho(todos[0].codigo);
    setErro(null);
  }

  function removerArquivo(chave: string) {
    const restantes = arquivos.filter((a) => a.chave !== chave);
    setArquivos(restantes);
    setArquivo(restantes.length === 1 ? restantes[0].arquivo : null);
    if (restantes.length === 1 && !codigoDesenho.trim()) setCodigoDesenho(restantes[0].codigo);
  }

  /** Cria um desenho por arquivo. Os que falharem ficam na lista para tentar de novo. */
  async function criarVarios(base: { tipo: TipoDesenho; revisao: string; dataRevisao?: string; observacoes: string | null }) {
    const codigos = arquivos.map((a) => a.codigo.trim().toLowerCase());
    if (codigos.some((c) => !c)) return setErro('Preencha o código de todos os desenhos.');
    if (new Set(codigos).size !== codigos.length) {
      return setErro('Há códigos repetidos na lista. Cada desenho precisa de um código diferente (mesmo tipo e revisão).');
    }
    const falhas: ArquivoNovo[] = [];
    let criados = 0;
    for (const [i, item] of arquivos.entries()) {
      setProgresso(`Enviando ${i + 1} de ${arquivos.length}: ${item.arquivo.name}`);
      try {
        const salvo = await createMut.mutateAsync({ ...base, codigoDesenho: item.codigo.trim() });
        try {
          await uploadMut.mutateAsync({ id: salvo.id, arquivo: item.arquivo });
          criados++;
        } catch (e: any) {
          // O desenho foi criado: o arquivo pode ser enviado depois pela tabela
          criados++;
          falhas.push({ ...item, erro: `Desenho criado, mas o arquivo falhou (${e?.response?.data?.message ?? 'erro no upload'}). Suba pela tabela.` });
        }
      } catch (e: any) {
        falhas.push({ ...item, erro: e?.response?.data?.message ?? 'Não foi possível criar' });
      }
    }
    setProgresso(null);
    if (falhas.length === 0) return onClose();
    setArquivos(falhas.filter((f) => !f.erro?.startsWith('Desenho criado')));
    setErro(`${criados} de ${arquivos.length} desenho(s) criado(s). Veja os itens com problema abaixo.` +
      (falhas.some((f) => f.erro?.startsWith('Desenho criado')) ? ' Alguns arquivos precisam ser reenviados pela tabela.' : ''));
  }

  const loading =
    createMut.isPending || updateMut.isPending || uploadMut.isPending || progresso !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!variosArquivos && !codigoDesenho.trim()) {
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

    if (variosArquivos) {
      await criarVarios({ tipo, revisao: revisao.trim(), dataRevisao: dataRevisaoIso, observacoes: observacoes.trim() || null });
      return;
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
        try {
          await uploadMut.mutateAsync({ id: desenhoSalvo.id, arquivo });
        } catch (uploadErr: any) {
          setErro(
            `Desenho salvo, mas falhou ao enviar o arquivo: ${
              uploadErr?.response?.data?.message ?? uploadErr?.message ?? 'Erro no upload'
            }. Você pode tentar subir o arquivo novamente pela tabela.`
          );
          return;
        }
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
            {progresso
              ? 'Enviando...'
              : uploadMut.isPending
              ? 'Enviando arquivo...'
              : loading
              ? 'Salvando...'
              : ehEdicao
              ? 'Salvar'
              : variosArquivos
              ? `Criar ${arquivos.length} desenhos`
              : 'Criar'}
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

        <div className={`grid grid-cols-1 gap-3 ${variosArquivos ? '' : 'md:grid-cols-2'}`}>
          {!variosArquivos && (
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
          )}
          <div>
            <label className="label">Revisão *{variosArquivos && <span className="text-neutral-500 font-normal"> (vale para todos)</span>}</label>
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
          <label className="label">{ehEdicao ? 'Arquivo (PDF, PNG, JPG)' : 'Arquivos (PDF, PNG, JPG) — pode escolher vários'}</label>
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
            multiple={!ehEdicao}
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              escolherArquivos(e.target.files);
              e.target.value = ''; // permite escolher de novo o mesmo arquivo
            }}
            className="block w-full text-sm text-neutral-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer"
          />
          {variosArquivos && (
            <div className="mt-3 space-y-2" role="list" aria-label="Desenhos a criar">
              <p className="text-xs text-neutral-400">
                Cada arquivo vira um desenho deste artigo. Confira o código de cada um:
              </p>
              {arquivos.map((a) => (
                <div key={a.chave} role="listitem" className={`rounded-lg border p-2 ${a.erro ? 'border-red-500/50 bg-red-500/5' : 'border-neutral-800 bg-neutral-950/50'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={a.codigo}
                      onChange={(e) => setArquivos((lista) => lista.map((x) => (x.chave === a.chave ? { ...x, codigo: e.target.value, erro: undefined } : x)))}
                      className="input py-1.5 text-sm font-mono flex-1 min-w-0"
                      aria-label={`Código do desenho para ${a.arquivo.name}`}
                      disabled={loading}
                    />
                    <button type="button" onClick={() => removerArquivo(a.chave)} disabled={loading} className="text-neutral-500 hover:text-red-400 px-2 text-lg leading-none" aria-label={`Remover ${a.arquivo.name}`}>
                      ×
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 truncate">
                    {a.arquivo.name} ({formatBytes(a.arquivo.size)})
                  </p>
                  {a.erro && <p className="text-[11px] text-red-400 mt-0.5">{a.erro}</p>}
                </div>
              ))}
              {progresso && <p role="status" className="text-xs text-forja-300">{progresso}</p>}
            </div>
          )}
          {!variosArquivos && arquivo && (
            <p className="text-xs text-neutral-400 mt-2">
              Novo arquivo selecionado:{' '}
              <span className="text-neutral-200">{arquivo.name}</span> (
              {formatBytes(arquivo.size)})
              {desenho?.arquivoKey && ' — substituirá o atual'}
            </p>
          )}
          <p className="text-xs text-neutral-500 mt-1">
            Opcional. Limite 50 MB por arquivo. Pode subir depois pela tabela.
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
