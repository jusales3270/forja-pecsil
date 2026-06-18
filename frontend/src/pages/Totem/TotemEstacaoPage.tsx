// ============================================================
// Forja - Tótem: Tela da Estação
// Lista OPs pendentes + em andamento, permite buscar e operar
// ============================================================

import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useOPsPendentes,
  useOPsEmAndamento,
  type OPLotePendente,
  type OPLoteEmAndamento,
  tempoDesde,
  corPrazoOS,
} from '../../hooks/useOPLote';
import { useEtapasList } from '../../hooks/useEtapas';
import { useApontamentosPeca, useRegistrarPeca, useDesfazerPeca } from '../../hooks/useApontamentoPeca';
import { useAbrirInspecao } from '../../hooks/useInspecao';
import { temCapacidade, type Papel } from '../../lib/permissions';
import { useAuth } from '../../lib/auth-store';
import { getSocket, joinEstacao, leaveEstacao } from '../../lib/socket';
import { useQueryClient } from '@tanstack/react-query';
import { IniciarOPModal } from './IniciarOPModal';
import { EncerrarOPModal } from './EncerrarOPModal';

export function TotemEstacaoPage() {
  const navigate = useNavigate();
  const { etapaId } = useParams<{ etapaId: string }>();
  const pessoa = useAuth((s) => s.pessoa);
  const logout = useAuth((s) => s.logout);
  const qc = useQueryClient();

  const { data: etapas } = useEtapasList();
  const etapa = etapas?.find((e) => e.id === etapaId);

  const [busca, setBusca] = useState('');
  const [opIniciar, setOpIniciar] = useState<OPLotePendente | null>(null);
  const [opEncerrar, setOpEncerrar] = useState<OPLoteEmAndamento | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: pendentesData, isLoading: loadingPend } = useOPsPendentes(
    etapaId ? { etapaId, busca: busca || undefined } : null,
  );
  const { data: andamentoData, isLoading: loadingAnd } = useOPsEmAndamento(
    etapaId ? { etapaId } : null,
  );

  const pendentes = pendentesData?.data ?? [];
  const emAndamento = andamentoData?.data ?? [];

  // Socket.IO: entra na sala da estação e revalida queries em eventos
  useEffect(() => {
    if (!etapaId) return;
    const socket = getSocket();
    joinEstacao(etapaId);

    const refetch = () => {
      qc.invalidateQueries({ queryKey: ['op-lote-pendentes'] });
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
    };

    socket.on('op:iniciada', refetch);
    socket.on('op:encerrada', refetch);
    socket.on('op:nova-na-fila', refetch);

    return () => {
      socket.off('op:iniciada', refetch);
      socket.off('op:encerrada', refetch);
      socket.off('op:nova-na-fila', refetch);
      leaveEstacao(etapaId);
    };
  }, [etapaId, qc]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const podeOperar = useMemo(() => {
    const p = pessoa?.papel;
    return p === 'programador' || p === 'pcp' || p === 'admin';
  }, [pessoa]);

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
              Programador: <span className="text-forja-400">{pessoa?.nome}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                  Nenhuma OP em andamento
                </div>
              )}
              {emAndamento.map((op) => (
                <CardEmAndamento
                  key={op.id}
                  op={op}
                  podeOperar={podeOperar}
                  onEncerrar={() => setOpEncerrar(op)}
                />
              ))}
            </div>
          </section>

          {/* Pendentes */}
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
                  Nenhuma OP pendente
                </div>
              )}
              {pendentes.map((op) => (
                <CardPendente
                  key={op.id}
                  op={op}
                  podeOperar={podeOperar}
                  onIniciar={() => setOpIniciar(op)}
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
}: {
  op: OPLotePendente;
  podeOperar: boolean;
  onIniciar: () => void;
}) {
  const urgente = op.lote.os.prioridade === 'urgente';
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-forja-600 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {urgente && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 text-xs font-bold">
              !
            </span>
          )}
          <span className="font-mono text-forja-400 font-semibold">
            {op.lote.os.codigoGrv}
          </span>
          <span className="text-xs text-neutral-500">·</span>
          <span className="text-xs text-neutral-400">
            Lote {op.lote.numeroLote}/{op.lote.quantidadePecas}pç
          </span>
        </div>
        <span className={`text-xs ${corPrazoOS(op.lote.os.prazoEntrega)}`}>
          {new Date(op.lote.os.prazoEntrega).toLocaleDateString('pt-BR')}
        </span>
      </div>

      <div className="text-neutral-100 font-medium">{op.lote.os.artigo.codigo}</div>
      <div className="text-xs text-neutral-500 mb-3">
        {op.lote.os.artigo.descricao}
      </div>

      <div className="text-sm text-neutral-300 mb-3">
        <span className="text-neutral-500">OP {op.codigoOp}:</span> {op.tipoServico}
        {op.exigeInspecao && (
          <span className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded">
            inspeção
          </span>
        )}
      </div>

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

      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-500">{op.lote.os.cliente.nome}</div>
        {podeOperar && (
          <button
            onClick={onIniciar}
            className="px-4 py-2 bg-forja-500 hover:bg-forja-600 text-white text-sm font-medium rounded-lg transition"
          >
            Iniciar
          </button>
        )}
      </div>
    </div>
  );
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
}: {
  op: OPLoteEmAndamento;
  podeOperar: boolean;
  onEncerrar: () => void;
}) {
  const carimbo = op.carimbos[0];
  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-forja-400 font-semibold">
            {op.lote.os.codigoGrv}
          </span>
          <span className="text-xs text-neutral-500">·</span>
          <span className="text-xs text-neutral-400">
            Lote {op.lote.numeroLote}/{op.lote.quantidadePecas}pç
          </span>
        </div>
        {carimbo && (
          <span className="text-xs text-amber-400">
            há {tempoDesde(carimbo.timestampEntrada)}
          </span>
        )}
      </div>

      <div className="text-neutral-100 font-medium">{op.lote.os.artigo.codigo}</div>
      <div className="text-sm text-neutral-300 mb-2">
        <span className="text-neutral-500">OP {op.codigoOp}:</span> {op.tipoServico}
      </div>

      {carimbo && (
        <div className="text-xs text-neutral-400 mb-3 space-y-0.5">
          <div>
            <span className="text-neutral-500">Máquina:</span> {carimbo.maquina.nome}
          </div>
          <div>
            <span className="text-neutral-500">Operador:</span>{' '}
            {carimbo.operadorResponsavel.nome}
          </div>
          {carimbo.observacoes && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 text-neutral-300">
              <span className="text-neutral-500">Obs:</span> {carimbo.observacoes}
            </div>
          )}
        </div>
      )}

      {carimbo && podeOperar && (
        <BotaoMaisUmaPeca opLoteId={op.id} maquinaId={carimbo.maquina.id} />
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <BotaoInspecionar opLoteId={op.id} />
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
  );
}


// ============================================================
// Bloco A (Sprint 4) - Botao "+1 peca"
// ============================================================
function BotaoMaisUmaPeca({
  opLoteId,
  maquinaId,
}: {
  opLoteId: string;
  maquinaId: string;
}) {
  const { data } = useApontamentosPeca(opLoteId);
  const registrar = useRegistrarPeca();
  const desfazer = useDesfazerPeca();
  const total = data?.data.total ?? 0;
  const ocupado = registrar.isPending || desfazer.isPending;

  return (
    <div className="mt-3 pt-3 border-t border-amber-500/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-500">Peças registradas</span>
        <span className="text-2xl font-bold text-forja-400 tabular-nums">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => registrar.mutate({ opLoteId, maquinaId })}
          disabled={ocupado}
          className="flex-1 px-4 py-3 bg-forja-600 hover:bg-forja-700 disabled:opacity-50 text-white text-lg font-bold rounded-lg transition"
        >
          + 1 peça
        </button>
        <button
          onClick={() => desfazer.mutate({ opLoteId, maquinaId })}
          disabled={ocupado || total === 0}
          className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-30 text-neutral-200 text-sm rounded-lg transition"
        >
          Desfazer
        </button>
      </div>
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
