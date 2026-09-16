import { useState, useEffect } from 'react';
import {
  type Desenho,
  LABELS_TIPO_DESENHO,
} from '../hooks/useDesenhos';
import { api } from '../lib/api';
import type { PaginaRenderizada } from '../lib/render-pdf';
import { ZoomDesenhoPopup } from './ZoomDesenhoPopup';
import { comPortal } from './Modal';

interface VisualizadorDesenhoModalProps {
  open: boolean;
  onClose: () => void;
  artigo: {
    id: string;
    codigo: string;
    descricao?: string;
  };
  desenhos?: Desenho[];
  desenhoInicialId?: string;
}

export function VisualizadorDesenhoModal({
  open,
  onClose,
  artigo,
  desenhos = [],
  desenhoInicialId,
}: VisualizadorDesenhoModalProps) {
  const [desenhoAtivoId, setDesenhoAtivoId] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [paginas, setPaginas] = useState<PaginaRenderizada[]>([]);
  const [paginaAtiva, setPaginaAtiva] = useState(0);
  const [popupAberto, setPopupAberto] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  useEffect(() => {
    if (open) {
      if (desenhoInicialId && desenhos.some((d) => d.id === desenhoInicialId)) {
        setDesenhoAtivoId(desenhoInicialId);
      } else if (desenhos.length > 0) {
        // Prioriza cliente -> forma -> outros
        const primeiro =
          desenhos.find((d) => d.tipo === 'cliente') ??
          desenhos.find((d) => d.tipo === 'forma') ??
          desenhos[0];
        setDesenhoAtivoId(primeiro.id);
      } else {
        setDesenhoAtivoId(null);
      }
    }
  }, [open, desenhoInicialId, desenhos]);

  const desenhoAtivo = desenhos.find((d) => d.id === desenhoAtivoId) ?? desenhos[0] ?? null;
  const temArquivo = Boolean(desenhoAtivo?.arquivoKey);
  const ehPdf =
    desenhoAtivo?.arquivoTipo === 'application/pdf' ||
    (desenhoAtivo?.arquivoNomeOriginal?.toLowerCase().endsWith('.pdf') ?? false);

  // Carrega o arquivo via API como Blob para evitar carregamento indevido do SPA
  useEffect(() => {
    let cancelado = false;
    const urlsCriadas: string[] = [];

    setPaginas([]);
    setPaginaAtiva(0);
    setPopupAberto(false);

    if (open && desenhoAtivo && desenhoAtivo.arquivoKey) {
      setCarregandoArquivo(true);
      setErroArquivo(null);
      setBlobUrl(null);

      api
        .get(`/artigos/${artigo.id}/desenhos/${desenhoAtivo.id}/arquivo`, {
          responseType: 'blob',
          timeout: 45000,
        })
        .then(async (res) => {
          if (cancelado) return;
          const blob = res.data as Blob;

          // Se a resposta for HTML ou JSON (ex: fallback SPA index.html do nginx se o backend antigo estiver rodando)
          if (blob.type.includes('text/html') || blob.type.includes('application/json')) {
            setErroArquivo(
              'O arquivo não foi encontrado no storage ou o servidor backend ainda não foi reiniciado/atualizado com as novas rotas.'
            );
            return;
          }

          const url = URL.createObjectURL(blob);
          urlsCriadas.push(url);
          setBlobUrl(url);

          if (ehPdf || blob.type === 'application/pdf') {
            try {
              // pdf.js só é baixado quando um PDF é aberto
              const { renderizarPdfComoImagens } = await import('../lib/render-pdf');
              const renderizadas = await renderizarPdfComoImagens(blob);
              urlsCriadas.push(...renderizadas.map((p) => p.url));
              if (cancelado) return;
              setPaginas(renderizadas);
            } catch (err) {
              if (cancelado) return;
              console.error('Erro ao renderizar PDF:', err);
              setErroArquivo(
                'Não foi possível exibir o PDF neste navegador. Use "Nova aba" ou "Baixar" para abrir o arquivo.'
              );
            }
            return;
          }

          const dimensoes = await new Promise<{ largura: number; altura: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
            img.onerror = () => reject(new Error('Imagem inválida'));
            img.src = url;
          });
          if (cancelado) return;
          setPaginas([{ url, ...dimensoes }]);
        })
        .catch((err) => {
          if (cancelado) return;
          console.error('Erro ao buscar desenho:', err);
          setErroArquivo(
            err?.response?.data?.message ??
              'Não foi possível carregar o arquivo. Certifique-se de que o backend foi atualizado no servidor e que o arquivo existe no MinIO.'
          );
        })
        .finally(() => {
          if (!cancelado) setCarregandoArquivo(false);
        });
    } else {
      setBlobUrl(null);
      setCarregandoArquivo(false);
      setErroArquivo(null);
    }

    return () => {
      cancelado = true;
      urlsCriadas.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artigo.id, desenhoAtivo?.id, desenhoAtivo?.arquivoKey]);

  // ESC fecha
  useEffect(() => {
    if (!open || popupAberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (telaCheia) {
          setTelaCheia(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, popupAberto, telaCheia, onClose]);

  // Lock scroll
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAbrirNovaAba = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (blobUrl && desenhoAtivo) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download =
        desenhoAtivo.arquivoNomeOriginal ??
        `${desenhoAtivo.codigoDesenho}-${desenhoAtivo.revisao}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };


  return comPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${
          telaCheia ? 'h-full max-h-screen rounded-none' : 'max-w-6xl h-[94vh] rounded-2xl'
        } bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Superior */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-forja-500/10 text-forja-400 font-mono text-xl font-bold">
              📐
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-100">{artigo.codigo}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {desenhos.length} {desenhos.length === 1 ? 'desenho' : 'desenhos'}
                </span>
              </div>
              {artigo.descricao && (
                <p className="text-xs text-neutral-400 truncate max-w-lg">{artigo.descricao}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blobUrl && (
              <>
                <button
                  type="button"
                  onClick={handleAbrirNovaAba}
                  className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 transition"
                  title="Abrir arquivo em nova aba"
                >
                  <span>↗</span> Nova aba
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 transition"
                  title="Baixar arquivo"
                >
                  <span>↓</span> Baixar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition"
              title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {telaCheia ? '⤢ Restaurar' : '⤢ Expandir'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 px-3 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg text-lg font-bold transition leading-none"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

        </header>

        {/* Abas dos Desenhos */}
        {desenhos.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-neutral-950/60 border-b border-neutral-800 overflow-x-auto shrink-0">
            {desenhos.map((d) => {
              const ativo = d.id === desenhoAtivo?.id;
              const possuiArquivo = Boolean(d.arquivoKey);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDesenhoAtivoId(d.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                    ativo
                      ? 'bg-forja-500 text-white shadow-lg shadow-forja-500/20'
                      : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700/80'
                  }`}
                >
                  <span>{LABELS_TIPO_DESENHO[d.tipo]}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      ativo ? 'bg-black/20 text-white' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    Rev. {d.revisao}
                  </span>
                  {!possuiArquivo && (
                    <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                      (sem arquivo)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Informações da Revisão Atual & Controles */}
        {desenhoAtivo && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 bg-neutral-900/90 border-b border-neutral-800 text-xs text-neutral-300 shrink-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <span className="text-neutral-500">Desenho: </span>
                <span className="font-mono text-neutral-100 font-semibold">
                  {desenhoAtivo.codigoDesenho}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Revisão: </span>
                <span className="font-mono text-forja-400 font-bold">{desenhoAtivo.revisao}</span>
              </div>
              {desenhoAtivo.dataRevisao && (
                <div>
                  <span className="text-neutral-500">Data: </span>
                  <span>{new Date(desenhoAtivo.dataRevisao).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {desenhoAtivo.arquivoNomeOriginal && (
                <div>
                  <span className="text-neutral-500">Arquivo: </span>
                  <span className="text-neutral-200">
                    {desenhoAtivo.arquivoNomeOriginal}{' '}
                    {desenhoAtivo.arquivoTamanho && `(${formatBytes(desenhoAtivo.arquivoTamanho)})`}
                  </span>
                </div>
              )}
              {desenhoAtivo.observacoes && (
                <div className="text-amber-300/90 italic truncate max-w-md">
                  "{desenhoAtivo.observacoes}"
                </div>
              )}
            </div>

            {paginas.length > 0 && (
              <div className="flex items-center gap-1.5">
                {paginas.length > 1 && (
                  <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setPaginaAtiva((i) => Math.max(0, i - 1))}
                      disabled={paginaAtiva === 0}
                      className="px-2 py-1 hover:bg-neutral-800 disabled:opacity-40 rounded text-neutral-200"
                      aria-label="Página anterior"
                    >
                      ‹
                    </button>
                    <span className="px-1 text-[11px] font-mono text-neutral-400">
                      pág. {paginaAtiva + 1}/{paginas.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaginaAtiva((i) => Math.min(paginas.length - 1, i + 1))}
                      disabled={paginaAtiva === paginas.length - 1}
                      className="px-2 py-1 hover:bg-neutral-800 disabled:opacity-40 rounded text-neutral-200"
                      aria-label="Próxima página"
                    >
                      ›
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPopupAberto(true)}
                  className="px-3 py-1.5 bg-forja-500 hover:bg-forja-600 text-white font-semibold rounded-lg transition"
                >
                  🔍 Ampliar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Visualizador Principal */}
        <div className="flex-1 min-h-0 bg-neutral-950/70 p-1 sm:p-2 overflow-hidden flex items-center justify-center relative">
          {desenhos.length === 0 ? (
            <div className="text-center p-8 max-w-md">
              <div className="text-5xl mb-3">📐</div>
              <h3 className="text-lg font-bold text-neutral-200 mb-1">Nenhum desenho cadastrado</h3>
              <p className="text-sm text-neutral-400">
                Este artigo ainda não possui desenhos técnicos vinculados no cadastro de Artigos.
              </p>
            </div>
          ) : !desenhoAtivo ? (
            <div className="text-center p-8 text-neutral-400">Selecione um desenho acima.</div>
          ) : !temArquivo ? (
            <div className="text-center p-8 max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl">
              <div className="text-5xl mb-3 text-amber-400">📁</div>
              <h3 className="text-lg font-bold text-neutral-200 mb-2">Arquivo não anexado</h3>
              <p className="text-sm text-neutral-400 mb-4">
                O desenho <strong className="text-neutral-200">{desenhoAtivo.codigoDesenho}</strong>{' '}
                (Rev. {desenhoAtivo.revisao}) está cadastrado no sistema, mas o arquivo PDF/imagem
                ainda não foi enviado.
              </p>
              <p className="text-xs text-neutral-500">
                O arquivo pode ser anexado na tela de Artigos &gt; Desenhos.
              </p>
            </div>
          ) : carregandoArquivo ? (
            <div className="text-center p-8 text-neutral-400 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-forja-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Carregando arquivo do desenho...</p>
            </div>
          ) : erroArquivo ? (
            <div className="text-center p-8 max-w-md bg-neutral-900 border border-red-500/30 rounded-2xl shadow-xl">
              <div className="text-5xl mb-3 text-red-400">⚠</div>
              <h3 className="text-lg font-bold text-red-200 mb-2">Arquivo não carregado</h3>
              <p className="text-sm text-neutral-300 mb-4">{erroArquivo}</p>
              <p className="text-xs text-neutral-500">
                Se você fez deploy recente, lembre-se de reiniciar o container do backend.
              </p>
            </div>
          ) : paginas.length > 0 ? (
            <button
              type="button"
              onClick={() => setPopupAberto(true)}
              className="group relative w-full h-full flex items-center justify-center cursor-zoom-in rounded-xl"
              title="Clique para ampliar"
            >
              <img
                src={(paginas[paginaAtiva] ?? paginas[0]).url}
                alt={`Desenho ${desenhoAtivo.codigoDesenho}`}
                draggable={false}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none bg-white"
              />
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/75 text-xs text-neutral-100 opacity-90 group-hover:opacity-100 transition">
                🔍 Clique no desenho para ampliar
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {popupAberto && paginas.length > 0 && desenhoAtivo && (
        <ZoomDesenhoPopup
          paginas={paginas}
          paginaInicial={paginaAtiva}
          titulo={`${artigo.codigo} · ${desenhoAtivo.codigoDesenho} · Rev. ${desenhoAtivo.revisao}`}
          onClose={() => setPopupAberto(false)}
        />
      )}
    </div>
  );
}
