// ============================================================
// Forja - Modal de Visualização de Desenhos Técnicos
// Otimizado para desktop e tótem touch da fábrica
// ============================================================

import { useState, useEffect } from 'react';
import {
  type Desenho,
  LABELS_TIPO_DESENHO,
  obterUrlArquivoStream,
} from '../hooks/useDesenhos';

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
  const [zoom, setZoom] = useState(1);
  const [rotacao, setRotacao] = useState(0);
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
      setZoom(1);
      setRotacao(0);
    }
  }, [open, desenhoInicialId, desenhos]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
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
  }, [open, telaCheia, onClose]);

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

  const desenhoAtivo = desenhos.find((d) => d.id === desenhoAtivoId) ?? desenhos[0] ?? null;
  const temArquivo = Boolean(desenhoAtivo?.arquivoKey);
  const urlArquivo = desenhoAtivo && temArquivo ? obterUrlArquivoStream(artigo.id, desenhoAtivo.id) : null;
  const ehPdf =
    desenhoAtivo?.arquivoTipo === 'application/pdf' ||
    (desenhoAtivo?.arquivoNomeOriginal?.toLowerCase().endsWith('.pdf') ?? false);

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAbrirNovaAba = () => {
    if (urlArquivo) {
      window.open(urlArquivo, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (urlArquivo && desenhoAtivo) {
      const a = document.createElement('a');
      a.href = urlArquivo;
      a.download = desenhoAtivo.arquivoNomeOriginal ?? `${desenhoAtivo.codigoDesenho}-${desenhoAtivo.revisao}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${
          telaCheia ? 'h-full max-h-screen rounded-none' : 'max-w-6xl h-[92vh] rounded-2xl'
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
            {urlArquivo && (
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
                  onClick={() => {
                    setDesenhoAtivoId(d.id);
                    setZoom(1);
                    setRotacao(0);
                  }}
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

            {/* Controles de Imagem (quando não for PDF) */}
            {temArquivo && !ehPdf && (
              <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-200 font-bold"
                  title="Diminuir Zoom"
                >
                  −
                </button>
                <span className="px-1 text-[11px] font-mono text-neutral-400">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-200 font-bold"
                  title="Aumentar Zoom"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotacao(0);
                  }}
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-400 text-[11px]"
                  title="Resetar"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setRotacao((r) => (r + 90) % 360)}
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-200 text-xs"
                  title="Girar 90°"
                >
                  ↻ {rotacao}°
                </button>
              </div>
            )}
          </div>
        )}

        {/* Visualizador Principal */}
        <div className="flex-1 bg-neutral-950/70 p-2 sm:p-4 overflow-auto flex items-center justify-center relative">
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
          ) : ehPdf && urlArquivo ? (
            <div className="w-full h-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-inner flex flex-col">
              <iframe
                src={`${urlArquivo}#toolbar=1&navpanes=0&scrollbar=1`}
                title={`Desenho ${desenhoAtivo.codigoDesenho}`}
                className="w-full h-full border-0 rounded-xl bg-neutral-900"
              />
            </div>
          ) : urlArquivo ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={urlArquivo}
                alt={`Desenho ${desenhoAtivo.codigoDesenho}`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotacao}deg)`,
                  transition: 'transform 0.15s ease-out',
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  maxHeight: zoom <= 1 ? '100%' : 'none',
                }}
                className="object-contain rounded-lg shadow-2xl select-none"
              />
            </div>
          ) : null}
        </div>

        {/* Rodapé */}
        <footer className="flex items-center justify-between px-5 py-3 bg-neutral-950 border-t border-neutral-800 shrink-0">
          <div className="text-xs text-neutral-500">
            Pecsil Forja · Sistema de Controle de Produção
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-sm rounded-xl transition"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
