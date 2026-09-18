// ============================================================
// Forja - Faixa de fluxo das fases de uma etapa
// ============================================================
// A fundição tem 5 operações internas apontando pra mesma Etapa. Sem esta
// faixa, tótem e painel mostram um balde só e ninguém sabe em que fase cada
// OS está. Aqui o fluxo aparece na sequência produtiva, com contadores.
//
// Usada em dois lugares:
//   - tótem  → interativa, filtra a lista de OPs abaixo
//   - painel → compacta, só leitura
// ============================================================

import type { FasePipeline, PipelineEtapa } from '../hooks/usePipelineEtapa';
import { tempoNaFase, faltaPara } from '../hooks/usePipelineEtapa';

interface Props {
  pipeline: PipelineEtapa;
  /** Interativa filtra a lista abaixo; compacta é só leitura. */
  variante?: 'interativa' | 'compacta';
  /** Fase selecionada (só na variante interativa). */
  faseSelecionada?: string | null;
  onSelecionarFase?: (tipoServicoId: string | null) => void;
  /** Callback ao clicar na lista de OSs de uma fase (abre popup). */
  onVerOSsFase?: (fase: FasePipeline) => void;
  /** Painel do chefe alterna tema; o tótem é sempre escuro. */
  claro?: boolean;
}

function classes(claro: boolean) {
  return claro
    ? {
        caixa: 'bg-white border-slate-200',
        caixaAtiva: 'bg-forja-50 border-forja-500',
        caixaVazia: 'bg-slate-50 border-slate-200 border-dashed',
        titulo: 'text-slate-700',
        tituloAtivo: 'text-forja-700',
        numero: 'text-slate-900',
        numeroVazio: 'text-slate-300',
        sub: 'text-slate-500',
        grv: 'text-slate-700',
        seta: 'text-slate-300',
        rotulo: 'text-slate-500',
        divisor: 'border-slate-200',
      }
    : {
        caixa: 'bg-neutral-900 border-neutral-800',
        caixaAtiva: 'bg-forja-500/10 border-forja-500',
        caixaVazia: 'bg-neutral-900/40 border-neutral-800 border-dashed',
        titulo: 'text-neutral-300',
        tituloAtivo: 'text-forja-300',
        numero: 'text-neutral-100',
        numeroVazio: 'text-neutral-700',
        sub: 'text-neutral-500',
        grv: 'text-neutral-300',
        seta: 'text-neutral-700',
        rotulo: 'text-neutral-500',
        divisor: 'border-neutral-800',
      };
}

export function PipelineEtapa({
  pipeline,
  variante = 'interativa',
  faseSelecionada = null,
  onSelecionarFase,
  onVerOSsFase,
  claro = false,
}: Props) {
  if (!pipeline.temFases) return null;

  const T = classes(claro);
  const interativa = variante === 'interativa';
  const totalNaEtapa = pipeline.fases.reduce((s, f) => s + f.total, 0);
  // A fundição tem 8 fases. Com caixa fixa a última — o tratamento térmico,
  // justamente a que importa — sai da tela. Aperta conforme o número de fases.
  const largura = pipeline.fases.length > 6 ? 'w-[116px] min-w-[116px]' : 'w-[150px] min-w-[150px]';

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${T.rotulo}`}>
          Fluxo da {pipeline.etapaNome}
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${T.sub}`}>
            {totalNaEtapa} {totalNaEtapa === 1 ? 'OP ativa' : 'OPs ativas'}
          </span>
          {interativa && faseSelecionada && (
            <button
              onClick={() => onSelecionarFase?.(null)}
              className="text-xs text-forja-400 hover:underline"
            >
              ver todas
            </button>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {pipeline.fases.map((fase, i) => (
          <div key={fase.tipoServicoId} className="flex items-stretch gap-1">
            <CaixaFase
              fase={fase}
              T={T}
              largura={largura}
              interativa={interativa}
              selecionada={faseSelecionada === fase.tipoServicoId}
              onClick={() =>
                onSelecionarFase?.(
                  faseSelecionada === fase.tipoServicoId ? null : fase.tipoServicoId,
                )
              }
              onVerOSs={interativa && onVerOSsFase ? () => onVerOSsFase(fase) : undefined}
            />
            {i < pipeline.fases.length - 1 && (
              <div className={`flex items-center ${T.seta} text-sm select-none px-0.5`}>→</div>
            )}
          </div>
        ))}
      </div>

      {pipeline.semFase.length > 0 && (
        <div className={`mt-2 text-xs ${T.sub}`}>
          {pipeline.semFase.length} OP(s) nesta etapa fora das fases cadastradas:{' '}
          {[...new Set(pipeline.semFase.map((c) => c.tipoServico))].join(', ')}
        </div>
      )}
    </div>
  );
}

function CaixaFase({
  fase,
  T,
  largura,
  interativa,
  selecionada,
  onClick,
  onVerOSs,
}: {
  fase: FasePipeline;
  T: ReturnType<typeof classes>;
  largura: string;
  interativa: boolean;
  selecionada: boolean;
  onClick: () => void;
  onVerOSs?: () => void;
}) {
  const vazia = fase.total === 0;
  // Só o que já rodou tem tempo: a mais antiga em processo mostra há quanto
  // tempo está ali. É o número que denuncia fase travada.
  const maisAntiga = fase.cards
    .filter((c) => c.desdeQuando)
    .sort((a, b) => new Date(a.desdeQuando!).getTime() - new Date(b.desdeQuando!).getTime())[0];
  const avisados = fase.cards.filter((c) => c.alertaInicioEm).length;
  // Fase que não é trabalho: ou a peça está fora da fábrica, ou é só o relógio.
  const fora = fase.cards.filter((c) => c.terceirizada).length;
  const esperando = fase.cards.filter((c) => c.liberaEm);
  const proximaLiberacao = esperando
    .map((c) => c.liberaEm!)
    .sort()[0];

  const borda = selecionada ? T.caixaAtiva : vazia ? T.caixaVazia : T.caixa;

  const Conteudo = (
    <>
      {/* Altura fixa de duas linhas: nome curto e nome longo têm que deixar os
          números na mesma linha, senão a faixa perde a leitura de relance. */}
      <div
        className={`text-[11px] font-semibold uppercase tracking-wide leading-tight min-h-[26px] ${
          selecionada ? T.tituloAtivo : T.titulo
        }`}
      >
        {fase.nome}
      </div>

      <div className="flex items-baseline gap-2 mt-1">
        <span
          className={`text-2xl font-bold tabular-nums ${vazia ? T.numeroVazio : T.numero}`}
        >
          {fase.total}
        </span>
        {!vazia && (
          <div className="flex flex-col gap-0.5 text-[10px] leading-tight">
            {fase.emProcesso > 0 && (
              <span className="text-amber-500">● {fase.emProcesso} rodando</span>
            )}
            {fase.naFila > 0 && (
              <span className={T.sub}>○ {fase.naFila} na fila</span>
            )}
            {fase.parado > 0 && (
              <span className="text-red-500">■ {fase.parado} parado</span>
            )}
          </div>
        )}
      </div>

      {proximaLiberacao ? (
        <div className="text-[10px] mt-1 text-indigo-400">
          ⏳ libera {faltaPara(proximaLiberacao)}
        </div>
      ) : fora > 0 ? (
        <div className="text-[10px] mt-1 text-sky-400">
          🚚 {fora === 1 ? 'fora da fábrica' : `${fora} fora da fábrica`}
          {maisAntiga && ` · ${tempoNaFase(maisAntiga.desdeQuando!)}`}
        </div>
      ) : maisAntiga ? (
        <div className={`text-[10px] mt-1 ${T.sub}`}>
          mais antiga: {tempoNaFase(maisAntiga.desdeQuando!)}
        </div>
      ) : null}

      {fase.cards.length > 0 && (
        <div
          className={`mt-2 pt-2 border-t ${T.divisor} ${onVerOSs ? 'cursor-pointer hover:bg-white/5 -mx-1 px-1 rounded transition-colors' : ''}`}
          onClick={onVerOSs ? (e) => { e.stopPropagation(); onVerOSs(); } : undefined}
        >
          <div
            className="space-y-0.5 overflow-y-auto pr-0.5"
            style={{ maxHeight: '60px' }}
          >
            {fase.cards.map((c) => (
              <div
                key={c.opLoteId}
                className={`text-[11px] font-mono flex items-center gap-1 ${T.grv}`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: c.paradaAtiva
                      ? '#E24B4A'
                      : c.status === 'em_processo'
                        ? '#EF9F27'
                        : '#6b7280',
                  }}
                />
                <span className="truncate">{c.codigoGrv}</span>
                {c.prioridade === 'urgente' && (
                  <span className="text-red-500 font-bold shrink-0">!</span>
                )}
              </div>
            ))}
          </div>
          {onVerOSs && (
            <div className={`text-[9px] mt-1 text-center ${T.sub} opacity-60`}>toque para ver todas</div>
          )}
        </div>
      )}

      {avisados > 0 && (
        <div className="mt-2 text-[10px] text-blue-400 leading-tight">
          ⚑ {avisados === 1 ? 'engenharia avisada' : `${avisados} avisos à engenharia`}
        </div>
      )}
    </>
  );

  const base = `${largura} shrink-0 rounded-xl border p-2.5 text-left transition ${borda}`;

  return interativa ? (
    <button onClick={onClick} className={`${base} hover:border-forja-500/60`}>
      {Conteudo}
    </button>
  ) : (
    <div className={base}>{Conteudo}</div>
  );
}
