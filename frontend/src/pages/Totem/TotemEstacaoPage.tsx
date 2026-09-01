// ============================================================
// Forja - Tótem: Tela da Estação
// Lista OPs pendentes + em andamento, permite buscar e operar
// ============================================================

import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useOPsPendentes,
  useOPsEmAndamento,
  useRetomarOP,
  type OPLotePendente,
  type OPLoteEmAndamento,
  tempoDesde,
  corPrazoOS,
} from '../../hooks/useOPLote';
import { useEtapasList } from '../../hooks/useEtapas';
import { usePipelineEtapa } from '../../hooks/usePipelineEtapa';
import { PipelineEtapa } from '../../components/PipelineEtapa';
import { useApontamentosPeca, useRegistrarPeca, useDesfazerPeca } from '../../hooks/useApontamentoPeca';
import { useAbrirInspecao } from '../../hooks/useInspecao';
import { temCapacidade, podeOperarEstacao, type Papel } from '../../lib/permissions';
import { useAuth } from '../../lib/auth-store';
import { getSocket, joinEstacao, leaveEstacao } from '../../lib/socket';
import { useQueryClient } from '@tanstack/react-query';
import { IniciarOPModal } from './IniciarOPModal';
import { EncerrarOPModal } from './EncerrarOPModal';
import { PausarOPModal } from './PausarOPModal';
import { PainelAvisos } from '../../components/PainelAvisos';
import { VisualizadorDesenhoModal } from '../../components/VisualizadorDesenhoModal';
import type { Desenho } from '../../hooks/useDesenhos';

export function TotemEstacaoPage() {
  const navigate = useNavigate();
  const { etapaId } = useParams<{ etapaId: string }>();
  const pessoa = useAuth((s) => s.pessoa);
  const logout = useAuth((s) => s.logout);
  const qc = useQueryClient();

  const { data: etapas } = useEtapasList();
  const etapa = etapas?.find((e) => e.id === etapaId);

  const [busca, setBusca] = useState('');
  const [faseSelecionada, setFaseSelecionada] = useState<string | null>(null);
  const [opIniciar, setOpIniciar] = useState<OPLotePendente | null>(null);
  const [opEncerrar, setOpEncerrar] = useState<OPLoteEmAndamento | null>(null);
  const [opPausar, setOpPausar] = useState<OPLoteEmAndamento | null>(null);
  const [modalDesenhos, setModalDesenhos] = useState<{
    artigo: { id: string; codigo: string; descricao?: string };
    desenhos: Desenho[];
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const retomar = useRetomarOP();

  const { data: pendentesData, isLoading: loadingPend } = useOPsPendentes(
    etapaId ? { etapaId, busca: busca || undefined } : null,
  );
  const { data: andamentoData, isLoading: loadingAnd } = useOPsEmAndamento(
    etapaId ? { etapaId } : null,
  );

  const { data: pipeline } = usePipelineEtapa(etapaId);

  const pendentesTodos = pendentesData?.data ?? [];
  const emAndamentoTodos = andamentoData?.data ?? [];

  // Fases só existem onde a etapa tem operações internas (fundição). Sem elas,
  // nada é filtrado e a tela é a de sempre.
  const nomeFaseSelecionada = useMemo(() => {
    if (!faseSelecionada || !pipeline?.temFases) return null;
    return pipeline.fases.find((f) => f.tipoServicoId === faseSelecionada)?.nome ?? null;
  }, [faseSelecionada, pipeline]);

  const naFase = (tipoServico: string) =>
    !nomeFaseSelecionada ||
    tipoServico.trim().toLowerCase() === nomeFaseSelecionada.trim().toLowerCase();

  const pendentes = pendentesTodos.filter((op) => naFase(op.tipoServico));
  const emAndamento = emAndamentoTodos.filter((op) => naFase(op.tipoServico));

  // Socket.IO: entra na sala da estação e revalida queries em eventos
  useEffect(() => {
    if (!etapaId) return;
    const socket = getSocket();
    joinEstacao(etapaId);

    const refetch = () => {
      qc.invalidateQueries({ queryKey: ['op-lote-pendentes'] });
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
      qc.invalidateQueries({ queryKey: ['pipeline-etapa'] });
      // O sino da estação avisada tem que acender na hora, sem esperar o
      // refetch de 30s — é justamente o aviso do tratamento térmico.
      qc.invalidateQueries({ queryKey: ['avisos'] });
    };

    socket.on('op:iniciada', refetch);
    socket.on('op:encerrada', refetch);
    socket.on('op:nova-na-fila', refetch);
    socket.on('op:fase-iniciada', refetch);

    return () => {
      socket.off('op:iniciada', refetch);
      socket.off('op:encerrada', refetch);
      socket.off('op:nova-na-fila', refetch);
      socket.off('op:fase-iniciada', refetch);
      leaveEstacao(etapaId);
    };
  }, [etapaId, qc]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Operar depende da ESTAÇÃO aberta, não só do papel: a conta da fundição
  // enxerga o torno, mas não mexe nele. O backend valida de novo em cada ação —
  // aqui é só pra não oferecer botão que vai tomar 403.
  const podeOperar = useMemo(
    () => podeOperarEstacao(pessoa, etapaId),
    [pessoa, etapaId],
  );

  const somenteObservando = Boolean(
    etapaId && !podeOperar && temCapacidade(pessoa?.papel as Papel, 'totem_acessar'),
  );

  if (!etapaId) {
    navigate('/totem');
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 text-sm text-neutral-400 mb-1">
              <button
                onClick={() => navigate('/totem')}
                className="hover:text-neutral-200"
              >
                ← Trocar estação
              </button>
            </div>
            <h1 className="text-4xl font-bold text-forja-50">
              {etapa?.nome ?? 'Estação'}
            </h1>
            <p className="text-neutral-400 mt-1">
              {pessoa?.papel === 'estacao' ? 'Conta' : 'Programador'}:{' '}
              <span className="text-forja-400">{pessoa?.nome}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PainelAvisos etapaId={etapaId} />
            <button
              onClick={() => navigate('/fim-de-turno')}
              className="px-4 py-2 text-sm text-forja-400 hover:text-forja-300 border border-forja-500/30 hover:border-forja-500 rounded-lg"
            >
              Fim de turno
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-lg"
            >
              Sair
            </button>
          </div>
        </div>

        {somenteObservando && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-900 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">👁</span>
            <div className="text-sm">
              <div className="text-neutral-200 font-medium">Modo observação</div>
              <div className="text-neutral-400 mt-0.5">
                Você está vendo {etapa?.nome ?? 'esta estação'}
                {pessoa?.etapa ? ` com a conta ${pessoa.etapa.nome}` : ''}. Para
                operar, entre com a conta desta estação.
              </div>
            </div>
          </div>
        )}

        {/* Fluxo interno da etapa — só aparece onde a etapa tem operações
            internas (hoje, a fundição). Nas demais a tela segue igual. */}
        {pipeline?.temFases && (
          <PipelineEtapa
            pipeline={pipeline}
            variante="interativa"
            faseSelecionada={faseSelecionada}
            onSelecionarFase={setFaseSelecionada}
          />
        )}

        {/* Busca */}
        <div className="mb-6">
          <input
            ref={inputRef}
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por OS, artigo, cliente..."
            className="w-full px-5 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-lg focus:border-forja-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pendentes primeiro: é a fila que o operador ataca. O que já está
              rodando fica à direita, como consequência do que ele iniciou. */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-forja-400">
                Pendentes
              </h2>
              <span className="text-sm text-neutral-500">{pendentes.length}</span>
            </div>
            <div className="space-y-3">
              {loadingPend && (
                <div className="p-6 text-center text-neutral-500 bg-neutral-900 rounded-xl">
                  Carregando...
                </div>
              )}
              {!loadingPend && pendentes.length === 0 && (
                <div className="p-6 text-center text-neutral-500 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
                  {nomeFaseSelecionada
                    ? `Nenhuma OP pendente em ${nomeFaseSelecionada}`
                    : 'Nenhuma OP pendente'}
                </div>
              )}
              {pendentes.map((op) => (
                <CardPendente
                  key={op.id}
                  op={op}
                  podeOperar={podeOperar}
                  onIniciar={() => setOpIniciar(op)}
                  onAbrirDesenhos={(artigo, desenhos) =>
                    setModalDesenhos({ artigo, desenhos })
                  }
                />
              ))}
            </div>
          </section>

          {/* Em andamento */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-amber-400">
                Em andamento
              </h2>
              <span className="text-sm text-neutral-500">
                {emAndamento.length}
              </span>
            </div>
            <div className="space-y-3">
              {loadingAnd && (
                <div className="p-6 text-center text-neutral-500 bg-neutral-900 rounded-xl">
                  Carregando...
                </div>
              )}
              {!loadingAnd && emAndamento.length === 0 && (
                <div className="p-6 text-center text-neutral-500 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
                  {nomeFaseSelecionada
                    ? `Nenhuma OP em andamento em ${nomeFaseSelecionada}`
                    : 'Nenhuma OP em andamento'}
                </div>
              )}
              {emAndamento.map((op) => (
                <CardEmAndamento
                  key={op.id}
                  op={op}
                  podeOperar={podeOperar}
                  onEncerrar={() => setOpEncerrar(op)}
                  onPausar={() => setOpPausar(op)}
                  onRetomar={() => retomar.mutate({ opLoteId: op.id })}
                  retomando={retomar.isPending}
                  onAbrirDesenhos={(artigo, desenhos) =>
                    setModalDesenhos({ artigo, desenhos })
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {opIniciar && etapaId && (
        <IniciarOPModal
          op={opIniciar}
          etapaId={etapaId}
          onClose={() => setOpIniciar(null)}
        />
      )}
      {opEncerrar && (
        <EncerrarOPModal op={opEncerrar} onClose={() => setOpEncerrar(null)} />
      )}
      {opPausar && (
        <PausarOPModal
          opLoteId={opPausar.id}
          codigoOp={opPausar.codigoOp}
          onClose={() => setOpPausar(null)}
        />
      )}
      {modalDesenhos && (
        <VisualizadorDesenhoModal
          open={true}
          artigo={modalDesenhos.artigo}
          desenhos={modalDesenhos.desenhos}
          onClose={() => setModalDesenhos(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Cards
// ============================================================

function CardPendente({
  op,
  podeOperar,
  onIniciar,
  onAbrirDesenhos,
}: {
  op: OPLotePendente;
  podeOperar: boolean;
  onIniciar: () => void;
  onAbrirDesenhos: (
    artigo: { id: string; codigo: string; descricao?: string },
    desenhos: Desenho[],
  ) => void;
}) {
  const urgente = op.lote.os.prioridade === 'urgente';
  const desenhos = op.lote.os.artigo.desenhos ?? [];
  const temDesenhosComArquivo = desenhos.some((d) => Boolean(d.arquivoKey));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-forja-600 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <CabecalhoOP op={op} urgente={urgente} />
        <span className={`text-xs shrink-0 ${corPrazoOS(op.lote.os.prazoEntrega)}`}>
          {new Date(op.lote.os.prazoEntrega).toLocaleDateString('pt-BR')}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2 mb-1">
        <div
          onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
          className="cursor-pointer group"
          title="Clique para ver desenhos técnicos"
        >
          <div className="text-neutral-100 group-hover:text-forja-400 font-medium text-base transition flex items-center gap-1.5">
            <span>{op.lote.os.artigo.codigo}</span>
            <span className="text-xs text-neutral-500 group-hover:text-forja-400">↗</span>
          </div>
          <div className="text-xs text-neutral-500">
            {op.lote.os.artigo.descricao}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            desenhos.length > 0
              ? temDesenhosComArquivo
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30 shadow-sm'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
              : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400 hover:bg-neutral-750'
          }`}
          title={
            desenhos.length > 0
              ? `${desenhos.length} desenho(s) cadastrado(s)`
              : 'Clique para detalhes dos desenhos'
          }
        >
          <span>📐</span>
          <span>
            {desenhos.length > 0
              ? `Desenho (${desenhos.length})`
              : 'Sem desenho'}
          </span>
        </button>
      </div>

      {op.exigeInspecao && (
        <div className="my-3">
          <span className="inline-block px-2 py-0.5 text-[10px] uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded">
            inspeção
          </span>
        </div>
      )}

      {/* Observações herdadas (OS, OP, Artigo) */}
      <ObservacoesHerdadas op={op} />

      {/* Recado do passo anterior (carimbo de saída da OP anterior do mesmo lote) */}
      {op.carimboAnterior && op.carimboAnterior.observacoes && (
        <div className="mb-3 px-3 py-2 bg-purple-500/5 border border-purple-500/30 rounded-lg">
          <div className="text-[10px] uppercase tracking-wide text-purple-400 font-semibold mb-1">
            💬 Recado do passo anterior — {op.carimboAnterior.etapa.nome}
          </div>
          <div className="text-xs text-neutral-200 leading-snug">
            {op.carimboAnterior.observacoes}
          </div>
          <div className="text-[10px] text-purple-300/80 mt-1">
            {op.carimboAnterior.programador?.nome
              ? `por ${op.carimboAnterior.programador.nome}`
              : 'autor desconhecido'}
            {op.carimboAnterior.maquina && ` · ${op.carimboAnterior.maquina.nome}`}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
        <div className="text-xs text-neutral-500">{op.lote.os.cliente.nome}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-sm font-medium rounded-lg border border-neutral-700 transition flex items-center gap-1.5"
          >
            <span>📐</span>
            <span>Ver Desenho</span>
          </button>
          {podeOperar &&
            (op.bloqueadoPor ? (
              <span
                className="px-4 py-2 text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300"
                title={`${op.bloqueadoPor.tipoServico} fechou ${op.bloqueadoPor.concluidas} de ${op.bloqueadoPor.total}. Esta operação só libera com o lote inteiro.`}
              >
                🔒 aguarda {op.bloqueadoPor.tipoServico} fechar o lote (
                {op.bloqueadoPor.concluidas}/{op.bloqueadoPor.total})
              </span>
            ) : (
              <button
                onClick={onIniciar}
                className="px-5 py-2 bg-forja-500 hover:bg-forja-600 text-white text-sm font-medium rounded-lg transition"
              >
                {op.terceirizada
                  ? '🚚 Enviar'
                  : op.esperaHoras != null
                    ? `⏳ Iniciar espera (${op.esperaHoras}h)`
                    : 'Iniciar OP'}
              </button>
            ))}
        </div>
      </div>

    </div>
  );
}

/**
 * A fase vem PRIMEIRO, em caixa alta e sem negrito; a OS logo abaixo, em
 * negrito. O operador olha a coluna e sabe na hora a que parte do processo
 * aquela pendência pertence, sem ler linha por linha.
 *
 * Quando o lote vem parcial, mostra "3 de 12" — quantas peças chegaram desta
 * vez, sempre coladas na OS a que pertencem.
 */
function CabecalhoOP({ op, urgente }: { op: OPLotePendente; urgente: boolean }) {
  const parcial = op.pecasDisponiveis < op.lote.quantidadePecas;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs uppercase tracking-wider text-neutral-400">
          {op.tipoServico}
        </span>
        <SeloTipoOP op={op} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {urgente && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 text-xs font-bold shrink-0">
            !
          </span>
        )}
        <span className="font-mono text-forja-400 font-bold uppercase">
          {op.lote.os.codigoGrv}
        </span>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            parcial
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'text-neutral-400'
          }`}
          title={
            parcial
              ? `${op.pecasDisponiveis} peças chegaram desta vez; o lote inteiro tem ${op.lote.quantidadePecas}`
              : 'Lote completo'
          }
        >
          {op.pecasDisponiveis} de {op.lote.quantidadePecas} pç
        </span>
        <span className="text-xs text-neutral-500">Lote {op.lote.numeroLote}</span>
      </div>
    </div>
  );
}

/**
 * Diz de cara que tipo de OP é aquela: feita fora da fábrica (rebarbação) ou
 * só tempo de espera (cura, resfriamento). Nenhuma das duas ocupa máquina, e
 * o operador precisa saber disso antes de clicar.
 */
function SeloTipoOP({ op }: { op: OPLotePendente }) {
  if (op.terceirizada) {
    return (
      <span className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded">
        🚚 fora da fábrica{op.fornecedor ? ` · ${op.fornecedor}` : ''}
      </span>
    );
  }
  if (op.esperaHoras != null) {
    return (
      <span className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded">
        ⏳ espera de {op.esperaHoras}h
      </span>
    );
  }
  return null;
}

function ObservacoesHerdadas({ op }: { op: OPLotePendente }) {
  const autorOS = op.lote.os.criadoPor?.nome ?? null;
  const obsOS = op.lote.os.observacoes ?? null;
  const obsLote = op.lote.observacoes ?? null;
  const obsOP = op.observacoes ?? null;
  const obsArtigo = op.lote.os.artigo.observacoes ?? null;

  const itens = [
    { rotulo: 'OS', texto: obsOS, autor: autorOS },
    { rotulo: 'Artigo', texto: obsArtigo, autor: null },
    { rotulo: 'OP', texto: obsOP, autor: null },
    { rotulo: 'Lote', texto: obsLote, autor: null },
  ].filter((i) => i.texto && i.texto.trim().length > 0);

  if (itens.length === 0) return null;

  return (
    <div className="mb-3 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold">
        ⚠ Observações
      </div>
      {itens.map((i) => (
        <div key={i.rotulo} className="text-xs text-neutral-200 leading-snug">
          <div className="flex items-baseline gap-2">
            <span className="text-neutral-500 text-[10px] uppercase">{i.rotulo}</span>
            {i.autor && (
              <span className="text-amber-400/80 text-[10px]">por {i.autor}</span>
            )}
          </div>
          <div className="mt-0.5">{i.texto}</div>
        </div>
      ))}
    </div>
  );
}

function CardEmAndamento({
  op,
  podeOperar,
  onEncerrar,
  onPausar,
  onRetomar,
  retomando,
  onAbrirDesenhos,
}: {
  op: OPLoteEmAndamento;
  podeOperar: boolean;
  onEncerrar: () => void;
  onPausar: () => void;
  onRetomar: () => void;
  retomando: boolean;
  onAbrirDesenhos: (
    artigo: { id: string; codigo: string; descricao?: string },
    desenhos: Desenho[],
  ) => void;
}) {
  const carimbo = op.carimbos[0];
  const paradaAtiva = carimbo?.paradas?.[0];
  const desenhos = op.lote.os.artigo.desenhos ?? [];
  const temDesenhosComArquivo = desenhos.some((d) => Boolean(d.arquivoKey));

  return (
    <div
      className={`border rounded-xl p-4 ${
        paradaAtiva
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-amber-500/5 border-amber-500/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <CabecalhoOP op={op} urgente={op.lote.os.prioridade === 'urgente'} />
        {carimbo && (
          <span className="text-xs text-amber-400 shrink-0">
            há {tempoDesde(carimbo.timestampEntrada)}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 mb-2">
        <div
          onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
          className="cursor-pointer group"
          title="Clique para ver desenhos técnicos"
        >
          <div className="text-neutral-100 group-hover:text-forja-400 font-medium text-base transition flex items-center gap-1.5">
            <span>{op.lote.os.artigo.codigo}</span>
            <span className="text-xs text-neutral-500 group-hover:text-forja-400">↗</span>
          </div>
          <div className="text-xs text-neutral-500">
            {op.lote.os.artigo.descricao}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            desenhos.length > 0
              ? temDesenhosComArquivo
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30 shadow-sm'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
              : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400 hover:bg-neutral-750'
          }`}
          title={
            desenhos.length > 0
              ? `${desenhos.length} desenho(s) cadastrado(s)`
              : 'Clique para detalhes dos desenhos'
          }
        >
          <span>📐</span>
          <span>
            {desenhos.length > 0
              ? `Desenho (${desenhos.length})`
              : 'Sem desenho'}
          </span>
        </button>
      </div>



      {carimbo && (
        <div className="text-xs text-neutral-400 mb-3 space-y-0.5">
          {/* Espera e terceirizada não têm máquina nem operador — no lugar
              disso, o que interessa é quando libera ou desde quando saiu. */}
          {op.esperaHoras != null ? (
            <div className="text-indigo-300">
              ⏳ Espera de {op.esperaHoras}h — começou há{' '}
              {tempoDesde(carimbo.timestampEntrada)}
            </div>
          ) : op.terceirizada ? (
            <div className="text-sky-300">
              🚚 Fora da fábrica há {tempoDesde(carimbo.timestampEntrada)}
              {op.fornecedor && ` · ${op.fornecedor}`}
            </div>
          ) : (
            <>
              <div>
                <span className="text-neutral-500">Máquina:</span>{' '}
                {carimbo.maquina?.nome ?? '—'}
              </div>
              <div>
                <span className="text-neutral-500">Operador:</span>{' '}
                {carimbo.operadorResponsavel?.nome ?? '—'}
              </div>
            </>
          )}
          {carimbo.observacoes && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 text-neutral-300">
              <span className="text-neutral-500">Obs:</span> {carimbo.observacoes}
            </div>
          )}
        </div>
      )}

      {paradaAtiva && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="text-xs font-semibold text-red-400">
            ⏸ PARADO — {paradaAtiva.motivoParada.nome}
          </div>
          <div className="text-[11px] text-red-300/80 mt-0.5">
            desde {tempoDesde(paradaAtiva.inicio)}
            {paradaAtiva.motivoParada.planejado ? ' · planejada' : ''}
          </div>
        </div>
      )}

      {carimbo?.maquina && !paradaAtiva && podeOperar && (
        <BotaoMaisUmaPeca
          opLoteId={op.id}
          maquinaId={carimbo.maquina.id}
          teto={op.liberadasPelaAnterior}
        />
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-neutral-800">
        <button
          type="button"
          onClick={() => onAbrirDesenhos(op.lote.os.artigo, desenhos)}
          className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-sm font-medium rounded-lg border border-neutral-700 transition flex items-center gap-1.5"
        >
          <span>📐</span>
          <span>Ver Desenho</span>
        </button>

        <div className="flex items-center gap-2">
          <BotaoInspecionar opLoteId={op.id} />
          {podeOperar && paradaAtiva && (
            <button
              onClick={onRetomar}
              disabled={retomando}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {retomando ? 'Retomando...' : 'Retomar'}
            </button>
          )}
          {podeOperar && !paradaAtiva && (
            <button
              onClick={onPausar}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg transition"
            >
              Pausar
            </button>
          )}
          {podeOperar && (
            <button
              onClick={onEncerrar}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition"
            >
              Encerrar
            </button>
          )}
        </div>
      </div>

    </div>
  );
}



// ============================================================
// Bloco A (Sprint 4) - Botao "+1 peca"
// ============================================================
function BotaoMaisUmaPeca({
  opLoteId,
  maquinaId,
  teto,
}: {
  opLoteId: string;
  maquinaId: string;
  /** Máximo que esta OP pode registrar: o que a operação anterior liberou. */
  teto: number;
}) {
  const { data } = useApontamentosPeca(opLoteId);
  const registrar = useRegistrarPeca();
  const desfazer = useDesfazerPeca();
  const total = data?.data.total ?? 0;
  const ocupado = registrar.isPending || desfazer.isPending;
  const completou = total >= teto;

  return (
    <div className="mt-3 pt-3 border-t border-amber-500/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-500">Peças registradas</span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            completou ? 'text-emerald-400' : 'text-forja-400'
          }`}
        >
          {total} <span className="text-base text-neutral-500">de {teto}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => registrar.mutate({ opLoteId, maquinaId })}
          disabled={ocupado || completou}
          className="flex-1 px-4 py-3 bg-forja-600 hover:bg-forja-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-lg font-bold rounded-lg transition"
          title={
            completou
              ? 'Todas as peças que chegaram nesta operação já foram registradas'
              : undefined
          }
        >
          {completou ? '✓ Tudo registrado' : '+ 1 peça'}
        </button>
        <button
          onClick={() => desfazer.mutate({ opLoteId, maquinaId })}
          disabled={ocupado || total === 0}
          className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 text-neutral-200 text-sm rounded-lg transition"
        >
          Desfazer
        </button>
      </div>
      {completou && (
        <p className="text-[11px] text-emerald-400/80 mt-2">
          Encerre a OP para liberar as {teto} peças para o próximo passo.
        </p>
      )}
    </div>
  );
}



// ============================================================
// Sprint 5 - Botao Inspecionar (visivel so pra quem inspeciona)
// ============================================================
function BotaoInspecionar({ opLoteId }: { opLoteId: string }) {
  const navigate = useNavigate();
  const pessoa = useAuth((s) => s.pessoa);
  const papel = pessoa?.papel as Papel | undefined;
  const abrir = useAbrirInspecao();

  if (!temCapacidade(papel, 'inspecao_realizar')) return null;

  async function handleInspecionar() {
    const res = await abrir.mutateAsync({ opLoteId, tipo: 'amostragem' });
    navigate(`/inspecao/${res.data.id}`);
  }

  return (
    <button
      onClick={handleInspecionar}
      disabled={abrir.isPending}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
    >
      {abrir.isPending ? 'Abrindo...' : 'Inspecionar'}
    </button>
  );
}
