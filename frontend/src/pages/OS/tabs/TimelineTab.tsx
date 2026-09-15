// ============================================================
// Forja - Aba "Timeline" do detalhe da OS
// ============================================================

import { useOSTimeline, type EventoOS, formatarDataSegura } from '../../../hooks/useOS';
import { useTheme } from '../../../lib/theme-store';

interface TimelineTabProps {
  osId: string;
}

const LABELS_TIPO_EVENTO: Record<string, string> = {
  os_criada: 'OS criada',
  os_alterada: 'OS alterada',
  prazo_alterado: 'Prazo alterado',
  prioridade_alterada: 'Prioridade alterada',
  lote_criado: 'Lote criado',
  op_lote_iniciada: 'OP iniciada',
  op_lote_concluida: 'OP concluída',
  inspecao_iniciada: 'Inspeção iniciada',
  inspecao_aprovada: 'Inspeção aprovada',
  inspecao_reprovada: 'Inspeção reprovada',
  controle_volume: 'Controle de volume',
  observacao_livre: 'Observação',
  reprovacao: 'Reprovação',
};

const CORES_TIPO_EVENTO: Record<string, string> = {
  os_criada: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  os_alterada: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  prazo_alterado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  prioridade_alterada: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  lote_criado: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  op_lote_iniciada: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  op_lote_concluida: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inspecao_iniciada: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  inspecao_aprovada: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inspecao_reprovada: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function formatarTimestamp(iso: string | null | undefined): { data: string; hora: string } {
  if (!iso) return { data: '—', hora: '—' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { data: '—', hora: '—' };
  try {
    return {
      data: d.toLocaleDateString('pt-BR'),
      hora: d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  } catch {
    return { data: '—', hora: '—' };
  }
}

export function TimelineTab({ osId }: TimelineTabProps) {
  const { claro } = useTheme();
  const { data, isLoading, isError } = useOSTimeline(osId);
  const eventos = data?.data ?? [];


  if (isLoading) {
    return (
      <div
        className={`${
          claro ? 'bg-white border-slate-200 text-slate-500' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
        } border rounded-xl p-12 text-center`}
      >
        Carregando timeline...
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`${
          claro ? 'bg-white border-slate-200 text-red-500' : 'bg-neutral-900 border-neutral-800 text-red-400'
        } border rounded-xl p-12 text-center`}
      >
        Erro ao carregar timeline.
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div
        className={`${
          claro ? 'bg-white border-slate-200 text-slate-500' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
        } border rounded-xl p-12 text-center`}
      >
        Nenhum evento registrado.
      </div>
    );
  }

  // Ordenar do mais recente pro mais antigo na exibição
  const ordenados = [...eventos].reverse();

  return (
    <div
      className={`${
        claro ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
      } border rounded-xl overflow-hidden`}
    >
      <ul className={`divide-y ${claro ? 'divide-slate-200' : 'divide-neutral-800'}`}>
        {ordenados.map((ev) => (
          <EventoItem key={ev.id} evento={ev} claro={claro} />
        ))}
      </ul>
    </div>
  );
}

function EventoItem({ evento, claro }: { evento: EventoOS; claro: boolean }) {
  const { data, hora } = formatarTimestamp(evento.timestamp);
  const label = LABELS_TIPO_EVENTO[evento.tipo] ?? evento.tipo;
  const cor =
    CORES_TIPO_EVENTO[evento.tipo] ??
    'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';

  return (
    <li className={`p-4 transition ${claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/30'}`}>
      <div className="flex items-start gap-3">
        {/* Timestamp à esquerda */}
        <div className="flex-shrink-0 text-right w-20">
          <div className={`text-sm font-mono ${claro ? 'text-slate-800' : 'text-neutral-300'}`}>{hora}</div>
          <div className={`text-xs ${claro ? 'text-slate-400' : 'text-neutral-500'}`}>{data}</div>
        </div>

        {/* Ponto + linha vertical */}
        <div className="flex-shrink-0 flex flex-col items-center w-3 pt-1">
          <div className="w-3 h-3 rounded-full bg-forja-500" />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${cor}`}
            >
              {label}
            </span>
            {evento.lote && (
              <span className={`text-xs ${claro ? 'text-slate-500' : 'text-neutral-400'}`}>
                Lote {evento.lote.numeroLote}
              </span>
            )}
          </div>
          <div className={`text-sm ${claro ? 'text-slate-600' : 'text-neutral-300'}`}>
            por <span className={claro ? 'text-slate-900 font-medium' : 'text-neutral-100'}>{evento.autor?.nome ?? '—'}</span>
          </div>
          {evento.payload && (
            <PayloadResumo tipo={evento.tipo} payload={evento.payload} claro={claro} />
          )}
        </div>
      </div>
    </li>
  );
}

function PayloadResumo({ tipo, payload, claro }: { tipo: string; payload: any; claro?: boolean }) {
  if (!payload) return null;

  const textMuted = claro ? 'text-slate-500' : 'text-neutral-400';
  const textHighlight = claro ? 'text-slate-800 font-medium' : 'text-neutral-200';

  if (tipo === 'os_criada') {
    return (
      <div className={`mt-2 text-xs space-y-0.5 ${textMuted}`}>
        <div>
          Quantidade total: <span className="font-mono">{payload.quantidadeTotal}</span> peças
        </div>
        <div>
          Lotes:{' '}
          <span className="font-mono">
            {payload.quantidadeLotes} ({(payload.divisaoLotes ?? []).join(' + ')})
          </span>
        </div>
      </div>
    );
  }

  if (tipo === 'lote_criado') {
    return (
      <div className={`mt-2 text-xs ${textMuted}`}>
        {payload.quantidadePecas} peças · {payload.totalOps} operações
      </div>
    );
  }

  if (tipo === 'prazo_alterado') {
    return (
      <div className={`mt-2 text-xs ${textMuted}`}>
        De{' '}
        <span className="font-mono">
          {formatarDataSegura(payload.prazoAnterior)}
        </span>{' '}
        para{' '}
        <span className={`font-mono ${textHighlight}`}>
          {formatarDataSegura(payload.prazoNovo)}
        </span>
      </div>
    );
  }

  if (tipo === 'prioridade_alterada') {
    return (
      <div className={`mt-2 text-xs ${textMuted}`}>
        De <span className={textHighlight}>{payload.prioridadeAnterior}</span> para{' '}
        <span className={textHighlight}>{payload.prioridadeNova}</span>
      </div>
    );
  }


  if (tipo === 'os_alterada' && payload.camposAtualizados) {
    return (
      <div className="mt-2 text-xs text-neutral-400">
        Campos: <span className="font-mono">{payload.camposAtualizados.join(', ')}</span>
      </div>
    );
  }

  if (tipo === 'os_alterada' && payload.acao === 'cancelada') {
    return (
      <div className="mt-2 text-xs text-red-400">
        OS cancelada (status anterior: {payload.statusAnterior})
      </div>
    );
  }

  if (payload.acao === 'metalizacao_envio_externo' || payload.acao === 'metalizacao_recebimento_externo') {
    return <div className="mt-2 text-sm space-y-1">
      <p>{payload.acao === 'metalizacao_envio_externo' ? 'Enviado para metalização externa — aguardando retorno' : 'Recebimento da metalização externa confirmado'}</p>
      <p>OP {payload.codigoOp} · {payload.quantidadeEnviada} peças</p>
      {payload.fornecedor && <p>Fornecedor: {payload.fornecedor}</p>}
      {payload.observacoes && <p>{payload.observacoes}</p>}
    </div>;
  }

  if (tipo === 'op_lote_iniciada') {
    return (
      <div className="mt-2 text-xs text-neutral-400 space-y-0.5">
        <div>
          OP <span className="text-neutral-200 font-mono">{payload.codigoOp}</span>
          {payload.tipoServico && (
            <span className="text-neutral-500"> — {payload.tipoServico}</span>
          )}
        </div>
        {payload.maquinaNome && (
          <div>
            Máquina: <span className="text-neutral-200">{payload.maquinaNome}</span>
          </div>
        )}
        {payload.operadorNome && (
          <div>
            Operador: <span className="text-neutral-200">{payload.operadorNome}</span>
          </div>
        )}
      </div>
    );
  }

  if (tipo === 'op_lote_concluida') {
    return (
      <div className="mt-2 text-xs text-neutral-400 space-y-0.5">
        <div>
          OP <span className="text-neutral-200 font-mono">{payload.codigoOp}</span>
          {payload.tipoServico && (
            <span className="text-neutral-500"> — {payload.tipoServico}</span>
          )}
        </div>
        <div>
          Quantidade:{' '}
          <span className="text-neutral-200 font-mono">
            {payload.quantidadeConcluida}/{payload.quantidadeTotal}
          </span>
          {payload.exigeInspecao && (
            <span className="ml-2 text-purple-400">→ aguardando inspeção</span>
          )}
          {payload.loteConcluido && (
            <span className="ml-2 text-emerald-400">→ lote concluído</span>
          )}
        </div>
        {payload.maquinaNome && (
          <div>
            Máquina: <span className="text-neutral-200">{payload.maquinaNome}</span>
          </div>
        )}
      </div>
    );
  }

  if (tipo === 'observacao_livre' && payload.acao === 'encerramento_parcial') {
    return (
      <div className="mt-2 text-xs text-neutral-400 space-y-0.5">
        <div>
          OP <span className="text-neutral-200 font-mono">{payload.codigoOp}</span>
          {payload.tipoServico && (
            <span className="text-neutral-500"> — {payload.tipoServico}</span>
          )}
        </div>
        <div>
          Encerramento parcial:{' '}
          <span className="text-neutral-200 font-mono">
            {payload.quantidadeConcluida}/{payload.quantidadeTotal}
          </span>
          <span className="ml-2 text-amber-400">→ OP volta pra fila</span>
        </div>
        {payload.maquinaNome && (
          <div>
            Máquina: <span className="text-neutral-200">{payload.maquinaNome}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
