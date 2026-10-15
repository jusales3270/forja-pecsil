// ============================================================
// Forja - Rascunho de OS vindo do orçamento ganho (Business OS)
// ============================================================
// O orçamento ganho chega aqui sem lotes nem OPs (fora do Tótem e do Painel).
// O PCP completa o Artigo (roteiro, desenhos, materiais), informa o número da
// OS e libera: nessa hora nascem os lotes e as OPs.
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLiberarOS, formatarDataSegura, type DivisaoLotes, type LiberarOSInput, type OS } from '../../hooks/useOS';
import { useAuth } from '../../lib/auth-store';
import { temCapacidade } from '../../lib/permissions';
import { useTheme } from '../../lib/theme-store';

const paraDataInput = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
};
const dataInputParaIso = (s: string) => new Date(`${s}T17:00:00`).toISOString();

export function RascunhoPainel({ os }: { os: OS }) {
  const { claro } = useTheme();
  const navigate = useNavigate();
  const pessoa = useAuth((s) => s.pessoa);
  const podeLiberar = temCapacidade(pessoa, 'os_editar');
  const liberar = useLiberarOS(os.id);

  const [codigoGrv, setCodigoGrv] = useState('');
  const [quantidade, setQuantidade] = useState(String(os.quantidadeTotal));
  const [prazo, setPrazo] = useState(paraDataInput(os.prazoEntrega));
  const [tipoDivisao, setTipoDivisao] = useState<'unico' | 'quantidade_lotes' | 'tamanho_lote'>('unico');
  const [numeroDivisao, setNumeroDivisao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ mensagem: string; semDesenho: boolean; semMateriais: boolean } | null>(null);

  const treino = os.origem === 'business_os_treino';
  const cont = os.artigo?._count ?? { operacoes: 0, desenhos: 0, materiais: 0 };
  const temRoteiro = cont.operacoes > 0;
  const itens = [
    { ok: temRoteiro, obrigatorio: true, titulo: 'Roteiro (operações)', texto: temRoteiro ? `${cont.operacoes} operação(ões)` : 'Obrigatório: aplique o roteiro-padrão ou cadastre as operações' },
    { ok: cont.desenhos > 0, obrigatorio: false, titulo: 'Desenhos', texto: cont.desenhos > 0 ? `${cont.desenhos} desenho(s)` : os.desenhoInformado ? `Informado no orçamento: ${os.desenhoInformado}` : 'Recomendado' },
    { ok: cont.materiais > 0, obrigatorio: false, titulo: 'Lista de materiais', texto: cont.materiais > 0 ? `${cont.materiais} material(is) por peça` : 'Recomendado: escolha no catálogo do Almoxarifado' },
  ];

  const C = claro
    ? { caixa: 'border-violet-300 bg-violet-50', titulo: 'text-violet-900', texto: 'text-slate-700', sub: 'text-slate-500', item: 'bg-white border-slate-200' }
    : { caixa: 'border-violet-500/30 bg-violet-500/10', titulo: 'text-violet-200', texto: 'text-neutral-200', sub: 'text-neutral-400', item: 'bg-neutral-900/60 border-neutral-800' };

  const divisao = (): DivisaoLotes => {
    const n = Number(numeroDivisao);
    if (tipoDivisao === 'quantidade_lotes' && n >= 1) return { tipoDivisao, quantidadeLotes: n };
    if (tipoDivisao === 'tamanho_lote' && n >= 1) return { tipoDivisao, tamanhoLote: n };
    return { tipoDivisao: 'unico' };
  };

  const enviar = async (extra: Pick<LiberarOSInput, 'semDesenho' | 'semMateriais'> = {}) => {
    setErro(null);
    const qtd = Number(quantidade);
    if (!codigoGrv.trim()) { setErro('Informe o número da OS.'); return; }
    if (!Number.isInteger(qtd) || qtd < 1) { setErro('Quantidade inválida.'); return; }
    if (!prazo) { setErro('Informe o prazo de entrega.'); return; }
    try {
      await liberar.mutateAsync({ codigoGrv: codigoGrv.trim(), quantidadeTotal: qtd, prazoEntrega: dataInputParaIso(prazo), divisao: divisao(), ...extra });
      setConfirmar(null);
    } catch (err: any) {
      const r = err?.response?.data;
      if (r?.error === 'confirmar_pendencias') {
        setConfirmar({ mensagem: r.message, semDesenho: Boolean(r.details?.semDesenho) || Boolean(extra.semDesenho), semMateriais: Boolean(r.details?.semMateriais) || Boolean(extra.semMateriais) });
        return;
      }
      setConfirmar(null);
      setErro(r?.message ?? 'Erro ao liberar a OS.');
    }
  };

  return (
    <section className={`mb-6 rounded-xl border p-5 ${C.caixa}`} aria-labelledby="rascunho-titulo">
      <h2 id="rascunho-titulo" className={`text-lg font-semibold ${C.titulo}`}>{treino ? 'TREINO — rascunho do orçamento de treino' : 'Rascunho vindo do orçamento ganho'}</h2>
      <p className={`text-sm mt-1 ${C.texto}`}>
        {treino
          ? 'Para praticar: complete o artigo (roteiro, desenhos, materiais) como se fosse de verdade. Este rascunho não pode ser liberado e nunca vai para o Tótem; some quando o treino for apagado.'
          : 'Ainda não está no chão de fábrica: sem lotes nem OPs, fora do Tótem e do Painel. Complete o artigo, informe o número da OS e libere.'}
      </p>
      <p className={`text-xs mt-1 ${C.sub}`}>
        {[os.pedidoClienteItem, os.poCliente && !os.pedidoClienteItem ? `Pedido ${os.poCliente}` : null, `prazo pedido ${formatarDataSegura(os.prazoEntrega)}`].filter(Boolean).join(' · ')}
      </p>

      <ul className="grid gap-2 sm:grid-cols-3 mt-4">
        {itens.map((i) => (
          <li key={i.titulo} className={`rounded-lg border px-3 py-2 ${C.item}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className={i.ok ? 'text-emerald-500' : i.obrigatorio ? 'text-red-500' : 'text-amber-500'}>{i.ok ? '✔' : i.obrigatorio ? '✖' : '!'}</span>
              <span className={C.texto}>{i.titulo}</span>
            </div>
            <p className={`text-xs mt-0.5 ${C.sub}`}>{i.texto}</p>
          </li>
        ))}
      </ul>
      {os.artigo?.id && (
        <button type="button" onClick={() => navigate(`/artigos/${os.artigo!.id}`)} className="btn-secondary mt-3 px-4 py-2 text-sm">
          Completar o artigo {os.artigo.codigo} (roteiro, desenhos, materiais)
        </button>
      )}

      {podeLiberar && !treino && (
        <form className="mt-5 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <div>
            <label className="label-compact" htmlFor="lib-codigo">Nº da OS (GRV)</label>
            <input id="lib-codigo" className="input py-2 text-sm" value={codigoGrv} onChange={(e) => setCodigoGrv(e.target.value)} placeholder="1-11638/001" maxLength={50} />
            <p className={`text-xs mt-1 ${C.sub}`}>Provisório: {os.codigoGrv}</p>
          </div>
          <div>
            <label className="label-compact" htmlFor="lib-qtd">Quantidade</label>
            <input id="lib-qtd" className="input py-2 text-sm" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="label-compact" htmlFor="lib-prazo">Prazo de entrega</label>
            <input id="lib-prazo" type="date" className="input py-2 text-sm" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div>
            <label className="label-compact" htmlFor="lib-divisao">Lotes</label>
            <div className="flex gap-2">
              <select id="lib-divisao" className="input py-2 text-sm" value={tipoDivisao} onChange={(e) => setTipoDivisao(e.target.value as typeof tipoDivisao)}>
                <option value="unico">Lote único</option>
                <option value="quantidade_lotes">Em N lotes</option>
                <option value="tamanho_lote">Peças por lote</option>
              </select>
              {tipoDivisao !== 'unico' && (
                <input aria-label={tipoDivisao === 'quantidade_lotes' ? 'Quantidade de lotes' : 'Peças por lote'} className="input py-2 text-sm w-20" inputMode="numeric" value={numeroDivisao} onChange={(e) => setNumeroDivisao(e.target.value.replace(/\D/g, ''))} />
              )}
            </div>
          </div>
          {erro && <div className="error-message sm:col-span-4">{erro}</div>}
          <div className="sm:col-span-4 flex justify-end">
            <button type="submit" className="btn-primary px-5 py-2.5" disabled={!temRoteiro || liberar.isPending} title={temRoteiro ? undefined : 'Complete o roteiro do artigo antes'}>
              {liberar.isPending ? 'Liberando…' : 'Liberar para produção'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title="Liberar mesmo assim?"
        message={confirmar ? `${confirmar.mensagem.charAt(0).toUpperCase()}${confirmar.mensagem.slice(1)}` : ''}
        confirmLabel="Liberar assim mesmo"
        cancelLabel="Voltar e completar"
        loading={liberar.isPending}
        onConfirm={() => void enviar({ semDesenho: confirmar?.semDesenho, semMateriais: confirmar?.semMateriais })}
        onCancel={() => setConfirmar(null)}
      />
    </section>
  );
}
