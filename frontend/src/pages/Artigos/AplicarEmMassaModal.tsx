// ============================================================
// Forja - Modal: aplicar roteiro padrão em massa (P-01)
// ============================================================
// O PCP escolhe o tipo de peça (e, se quiser, o cliente) e o modelo; vê
// quantos artigos sem roteiro vão receber e confirma. Nunca mexe em artigo
// que já tem roteiro: a exceção se ajusta no próprio artigo.
// ============================================================

import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../lib/theme-store';
import { useClientesList } from '../../hooks/useClientes';
import {
  useArtigosSemRoteiro,
  useAplicarEmMassa,
  useRoteirosPadrao,
  formatarMinutos,
  type AplicarEmMassaResultado,
} from '../../hooks/useRoteirosPadrao';

interface Props {
  rotulosTipo: Record<string, string>;
  onClose: () => void;
}

export function AplicarEmMassaModal({ rotulosTipo, onClose }: Props) {
  const { claro } = useTheme();
  const sub = claro ? 'text-slate-500' : 'text-neutral-400';
  const forte = claro ? 'text-slate-900' : 'text-neutral-100';
  const caixa = claro ? 'border border-slate-200 bg-slate-50' : 'border border-neutral-800 bg-neutral-900/60';

  const { data: porTipo, isLoading: carregandoTipos } = useArtigosSemRoteiro();
  const { data: roteiros } = useRoteirosPadrao();
  const { data: clientes } = useClientesList();
  const aplicar = useAplicarEmMassa();

  const [tipo, setTipo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [roteiroId, setRoteiroId] = useState('');
  const [previa, setPrevia] = useState<AplicarEmMassaResultado | null>(null);
  const [feito, setFeito] = useState<AplicarEmMassaResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const roteiro = roteiros?.find((r) => r.id === roteiroId) ?? null;
  const pronto = Boolean(tipo && roteiroId);
  const mudou = () => { setPrevia(null); setFeito(null); setErro(null); };

  async function rodar(simular: boolean) {
    if (!pronto) return;
    setErro(null);
    try {
      const r = await aplicar.mutateAsync({ roteiroId, tipoProduto: tipo, clienteId: clienteId || null, simular });
      if (simular) setPrevia(r);
      else { setFeito(r); setPrevia(null); }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Não foi possível aplicar o roteiro. Tente novamente.');
    }
  }

  const rotuloBotao = aplicar.isPending
    ? (previa ? 'Aplicando…' : 'Contando…')
    : previa && previa.total > 0
      ? `Aplicar em ${previa.total.toLocaleString('pt-BR')} artigo${previa.total === 1 ? '' : 's'}`
      : 'Ver quantos artigos';

  return (
    <Modal
      open
      onClose={aplicar.isPending ? () => {} : onClose}
      title="Aplicar roteiro em massa"
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={aplicar.isPending} className="btn-ghost px-4 py-2 text-sm">
            {feito ? 'Fechar' : 'Cancelar'}
          </button>
          {!feito && (
            <button
              onClick={() => rodar(!(previa && previa.total > 0))}
              disabled={!pronto || aplicar.isPending || (previa?.total === 0)}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >
              {rotuloBotao}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className={`text-sm ${sub}`}>
          Preenche o roteiro de todos os artigos <strong>sem roteiro</strong> de um tipo de peça com um modelo.
          Artigo que já tem roteiro não muda. Depois, cada um pode ser ajustado no próprio artigo.
        </p>

        <div className={`rounded-lg p-3 ${caixa}`}>
          <div className={`text-xs uppercase tracking-wide mb-2 ${sub}`}>Artigos sem roteiro, por tipo</div>
          {carregandoTipos && <div className={`text-sm ${sub}`}>Carregando…</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {porTipo?.map((t) => (
              <button
                key={t.tipoProduto}
                type="button"
                onClick={() => { setTipo(t.tipoProduto); mudou(); }}
                className={`flex justify-between gap-2 text-left rounded px-1 ${tipo === t.tipoProduto ? 'text-forja-500 font-semibold' : forte}`}
              >
                <span>{rotulosTipo[t.tipoProduto] ?? t.tipoProduto}</span>
                <span className="font-mono whitespace-nowrap">{t.semRoteiro.toLocaleString('pt-BR')}<span className={sub}> / {t.total.toLocaleString('pt-BR')}</span></span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de peça</label>
            <select className="input" value={tipo} onChange={(e) => { setTipo(e.target.value); mudou(); }}>
              <option value="">Escolha…</option>
              {Object.entries(rotulosTipo).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Cliente (opcional)</label>
            <select className="input" value={clienteId} onChange={(e) => { setClienteId(e.target.value); mudou(); }}>
              <option value="">Todos</option>
              {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Modelo de roteiro</label>
          <select className="input" value={roteiroId} onChange={(e) => { setRoteiroId(e.target.value); mudou(); }}>
            <option value="">Escolha…</option>
            {roteiros?.map((r) => (
              <option key={r.id} value={r.id} disabled={r.temPendencia}>
                {r.nome} · {r.totalOperacoes} operações{r.temPendencia ? ' (falta tipo de serviço no catálogo)' : ''}
              </option>
            ))}
          </select>
          {roteiro && (
            <p className={`text-xs mt-1 ${sub}`}>
              {roteiro.operacoes.map((o) => o.tipoServico ?? `#${o.codigoTipoServico}`).join(' → ')} · {formatarMinutos(roteiro.tempoTotalUnitMin)} por peça
              {roteiro.revisaoPendente && ' · modelo marcado para conferir com o PCP'}
            </p>
          )}
        </div>

        {erro && <div className="error-message">{erro}</div>}

        {previa && (
          <div className={`rounded-lg p-3 text-sm ${caixa}`}>
            {previa.total === 0 ? (
              <span className={forte}>Nenhum artigo sem roteiro com esse filtro.</span>
            ) : (
              <>
                <p className={forte}>
                  <strong>{previa.total.toLocaleString('pt-BR')}</strong> artigo{previa.total === 1 ? '' : 's'} sem roteiro vão receber o modelo <strong>{previa.roteiro}</strong>.
                  Clique de novo para confirmar.
                </p>
                <ul className={`mt-2 space-y-0.5 text-xs ${sub}`}>
                  {previa.amostra?.map((a) => <li key={a.codigo}><span className="font-mono">{a.codigo}</span> · {a.descricao}</li>)}
                  {previa.total > (previa.amostra?.length ?? 0) && <li>… e mais {(previa.total - (previa.amostra?.length ?? 0)).toLocaleString('pt-BR')}</li>}
                </ul>
              </>
            )}
          </div>
        )}

        {feito && (
          <div className="rounded-lg p-3 text-sm border border-emerald-500/40 bg-emerald-500/10">
            <span className={forte}>
              Roteiro <strong>{feito.roteiro}</strong> aplicado em <strong>{(feito.aplicados ?? 0).toLocaleString('pt-BR')}</strong> artigo{feito.aplicados === 1 ? '' : 's'} ({feito.operacoesPorArtigo} operações cada).
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
