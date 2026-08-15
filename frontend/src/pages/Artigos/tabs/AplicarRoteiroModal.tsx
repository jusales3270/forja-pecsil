// ============================================================
// Forja - Modal: aplicar roteiro padrão no Artigo
// Escolha manual do modelo, com prévia antes de aplicar
// ============================================================

import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { useTheme } from '../../../lib/theme-store';
import {
  useRoteirosPadrao,
  useAplicarRoteiro,
  formatarMinutos,
  type RoteiroPadrao,
} from '../../../hooks/useRoteirosPadrao';

interface Props {
  artigoId: string;
  totalOperacoesExistentes: number;
  onClose: () => void;
}

/** Classes por tema — o modo escuro é o original, o claro foi calibrado pra leitura no chão de fábrica. */
function classesTema(claro: boolean) {
  return claro
    ? {
        texto: 'text-slate-600',
        titulo: 'text-slate-900',
        sub: 'text-slate-500',
        cardBorda: 'border-slate-200 hover:border-slate-400 bg-white',
        cardBordaSel: 'border-forja-500 bg-forja-50',
        cardTitulo: 'text-slate-900',
        cardSub: 'text-slate-600',
        cardNumero: 'text-forja-600',
        cardTempo: 'text-slate-500',
        tabelaBorda: 'border border-slate-200 bg-white',
        thead: 'bg-slate-100 text-slate-600',
        divisor: 'divide-slate-200',
        linhaHover: 'hover:bg-slate-50',
        seq: 'text-slate-500',
        cod: 'text-forja-600',
        servico: 'text-slate-800',
        etapa: 'text-slate-500',
        oQueFazer: 'text-slate-900',
        tempo: 'text-slate-700',
        setup: 'text-slate-500',
        aviso: 'bg-red-50 border-red-300 text-red-900',
        badgeConferir: 'bg-amber-100 text-amber-800 border-amber-400',
        badgeFalta: 'bg-red-100 text-red-800 border-red-400',
        badgeInsp: 'bg-purple-100 text-purple-800 border-purple-300',
      }
    : {
        texto: 'text-neutral-400',
        titulo: 'text-neutral-200',
        sub: 'text-neutral-500',
        cardBorda: 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/50',
        cardBordaSel: 'border-forja-500 bg-forja-500/10',
        cardTitulo: 'text-neutral-100',
        cardSub: 'text-neutral-400',
        cardNumero: 'text-forja-400',
        cardTempo: 'text-neutral-500',
        tabelaBorda: 'subcard',
        thead: 'bg-neutral-950 text-neutral-400',
        divisor: 'divide-neutral-800',
        linhaHover: 'hover:bg-neutral-800/30',
        seq: 'text-neutral-500',
        cod: 'text-forja-400',
        servico: 'text-neutral-300',
        etapa: 'text-neutral-500',
        oQueFazer: 'text-neutral-200',
        tempo: 'text-neutral-300',
        setup: 'text-neutral-500',
        aviso: 'bg-red-500/10 border-red-500/30 text-red-200',
        badgeConferir: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        badgeFalta: 'bg-red-500/15 text-red-400 border-red-500/30',
        badgeInsp: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      };
}

export function AplicarRoteiroModal({
  artigoId,
  totalOperacoesExistentes,
  onClose,
}: Props) {
  const { claro } = useTheme();
  const T = classesTema(claro);

  const { data: roteiros, isLoading } = useRoteirosPadrao();
  const aplicar = useAplicarRoteiro(artigoId);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false);

  const selecionado = roteiros?.find((r) => r.id === selecionadoId) ?? null;

  async function handleAplicar(substituir = false) {
    if (!selecionado) return;
    setErro(null);
    try {
      await aplicar.mutateAsync({ roteiroId: selecionado.id, substituir });
      onClose();
    } catch (e: any) {
      const codigo = e?.response?.data?.error;
      if (codigo === 'artigo_ja_tem_operacoes') {
        setPrecisaConfirmar(true);
        return;
      }
      setErro(
        e?.response?.data?.message ?? 'Erro ao aplicar o roteiro. Tente novamente.',
      );
    }
  }

  return (
    <Modal
      open
      onClose={aplicar.isPending ? () => {} : onClose}
      title="Aplicar roteiro padrão"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={aplicar.isPending}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleAplicar(precisaConfirmar)}
            disabled={!selecionado || aplicar.isPending}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition disabled:opacity-40 ${
              precisaConfirmar
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-primary'
            }`}
          >
            {aplicar.isPending
              ? 'Aplicando...'
              : precisaConfirmar
                ? `Substituir ${totalOperacoesExistentes} e aplicar ${selecionado?.totalOperacoes ?? 0}`
                : selecionado
                  ? `Aplicar ${selecionado.totalOperacoes} operações`
                  : 'Selecione um roteiro'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className={`text-sm ${T.texto}`}>
          Escolha um modelo de processo. As operações entram já na sequência
          correta, com tempos e instruções — e podem ser editadas depois, uma a uma.
        </p>

        {precisaConfirmar && (
          <div className={`px-3 py-2 rounded-lg border text-sm ${T.aviso}`}>
            Este artigo já tem <strong>{totalOperacoesExistentes} operação(ões)</strong>.
            Aplicar o roteiro vai <strong>apagar todas</strong> e recriar a partir do
            modelo. Clique de novo no botão vermelho para confirmar.
          </div>
        )}

        {erro && <div className="error-message">{erro}</div>}

        {isLoading && (
          <div className={`text-center py-6 ${T.sub}`}>Carregando roteiros...</div>
        )}

        {/* Lista de roteiros */}
        {roteiros && (
          <div className="space-y-2">
            {roteiros.map((r) => (
              <CardRoteiro
                key={r.id}
                roteiro={r}
                T={T}
                selecionado={r.id === selecionadoId}
                onSelecionar={() => {
                  setSelecionadoId(r.id);
                  setPrecisaConfirmar(false);
                  setErro(null);
                }}
              />
            ))}
          </div>
        )}

        {/* Prévia do roteiro selecionado */}
        {selecionado && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-sm font-semibold ${T.titulo}`}>
                Sequência do processo
              </h4>
              <span className={`text-xs ${T.sub}`}>
                {selecionado.totalOperacoes} operações ·{' '}
                {formatarMinutos(selecionado.tempoTotalUnitMin)} por peça
              </span>
            </div>

            <div className={`rounded-lg overflow-hidden max-h-72 overflow-y-auto ${T.tabelaBorda}`}>
              <table className="w-full text-xs">
                <thead
                  className={`uppercase tracking-wide sticky top-0 ${T.thead}`}
                >
                  <tr>
                    <th className="text-left px-3 py-2 w-12">Seq</th>
                    <th className="text-left px-3 py-2 w-12">Cód</th>
                    <th className="text-left px-3 py-2">Serviço</th>
                    <th className="text-left px-3 py-2">O que fazer</th>
                    <th className="text-right px-3 py-2 w-16">Tempo</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${T.divisor}`}>
                  {selecionado.operacoes.map((op) => (
                    <tr key={op.ordem} className={T.linhaHover}>
                      <td className={`px-3 py-2 font-mono ${T.seq}`}>
                        {op.codigoOp}
                      </td>
                      <td className={`px-3 py-2 font-mono font-semibold ${T.cod}`}>
                        {op.codigoTipoServico}
                      </td>
                      <td className={`px-3 py-2 ${T.servico}`}>
                        {op.naoEncontrado ? (
                          <span className="text-red-500 font-medium">
                            ⚠ código não cadastrado
                          </span>
                        ) : (
                          <>
                            <div>{op.tipoServico}</div>
                            <div className={`text-[10px] ${T.etapa}`}>{op.etapa}</div>
                          </>
                        )}
                      </td>
                      <td className={`px-3 py-2 whitespace-pre-line ${T.oQueFazer}`}>
                        {op.observacoes}
                        {op.exigeInspecao && (
                          <span
                            className={`ml-2 inline-block px-1.5 py-0.5 text-[9px] uppercase border rounded ${T.badgeInsp}`}
                          >
                            inspeção
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${T.tempo}`}>
                        {formatarMinutos(op.tempoUnitMin)}
                        {op.tempoSetupMin > 0 && (
                          <div className={`text-[10px] ${T.setup}`}>
                            +{op.tempoSetupMin}min setup
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className={`text-[11px] mt-2 ${T.sub}`}>Origem: {selecionado.origem}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================

function CardRoteiro({
  roteiro,
  selecionado,
  onSelecionar,
  T,
}: {
  roteiro: RoteiroPadrao;
  selecionado: boolean;
  onSelecionar: () => void;
  T: ReturnType<typeof classesTema>;
}) {
  return (
    <button
      onClick={onSelecionar}
      className={`w-full text-left p-3 rounded-lg border transition ${
        selecionado ? T.cardBordaSel : T.cardBorda
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${T.cardTitulo}`}>{roteiro.nome}</span>
            {roteiro.revisaoPendente && (
              <span
                className={`px-1.5 py-0.5 text-[9px] uppercase border rounded ${T.badgeConferir}`}
                title="Observações extraídas de fonte parcialmente legível — conferir com o PCP"
              >
                conferir
              </span>
            )}
            {roteiro.temPendencia && (
              <span
                className={`px-1.5 py-0.5 text-[9px] uppercase border rounded ${T.badgeFalta}`}
              >
                falta cadastro
              </span>
            )}
          </div>
          <div className={`text-xs mt-0.5 ${T.cardSub}`}>{roteiro.descricao}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-mono font-semibold ${T.cardNumero}`}>
            {roteiro.totalOperacoes} ops
          </div>
          <div className={`text-[10px] ${T.cardTempo}`}>
            {formatarMinutos(roteiro.tempoTotalUnitMin)}/peça
          </div>
        </div>
      </div>
    </button>
  );
}
