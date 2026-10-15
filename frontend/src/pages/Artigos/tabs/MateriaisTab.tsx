// ============================================================
// Forja - Aba "Materiais" do Artigo (Sprint 6c, Bloco A)
// ============================================================
// Lista de materiais POR PEÇA, escolhida no catálogo do Almoxarifado (código
// do GRV: parafusos 2-01, pó 2-08, caixa 3-02…). A OS copia a lista na
// liberação, já com o total (por peça × quantidade da OS).
// ============================================================

import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../lib/auth-store';
import { temCapacidade } from '../../../lib/permissions';
import { useTheme } from '../../../lib/theme-store';
import {
  formatarQuantidade,
  lerQuantidade,
  useAlterarMaterial,
  useBuscaCatalogo,
  useIncluirMaterial,
  useMateriaisArtigo,
  useRetirarMaterial,
  type MaterialArtigo,
  type MaterialCatalogo,
} from '../../../hooks/useMateriais';

export function MateriaisTab({ artigoId }: { artigoId: string }) {
  const pessoa = useAuth((s) => s.pessoa);
  const { claro } = useTheme();
  const podeEditar = temCapacidade(pessoa, 'cadastros_artigos');
  const { data: lista, isLoading, isError } = useMateriaisArtigo(artigoId);
  const incluir = useIncluirMaterial(artigoId);
  const alterar = useAlterarMaterial(artigoId);
  const retirar = useRetirarMaterial(artigoId);

  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [escolhido, setEscolhido] = useState<MaterialCatalogo | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [retirando, setRetirando] = useState<MaterialArtigo | null>(null);
  const fechar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const { data: achados, isFetching } = useBuscaCatalogo(escolhido ? '' : busca);
  const opcoes = achados ?? [];

  const escolher = (m: MaterialCatalogo) => {
    setEscolhido(m);
    setBusca(`${m.codigo} — ${m.descricao}`);
    setUnidade(m.unidade);
    setAberta(false);
    setTimeout(() => qtdRef.current?.focus(), 0);
  };
  const limpar = () => { setEscolhido(null); setBusca(''); setQuantidade(''); setUnidade(''); setObservacoes(''); };

  const handleIncluir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!escolhido) { setErro('Escolha o material na lista do catálogo.'); return; }
    const q = lerQuantidade(quantidade);
    if (!(q > 0)) { setErro('Informe a quantidade por peça (maior que zero).'); return; }
    try {
      await incluir.mutateAsync({ materialCodigo: escolhido.codigo, descricao: escolhido.descricao, quantidade: q, unidade: unidade || escolhido.unidade, observacoes: observacoes || null });
      limpar();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao incluir o material');
    }
  };

  const mudarQuantidade = async (m: MaterialArtigo, texto: string) => {
    const q = lerQuantidade(texto);
    if (!(q > 0) || q === Number(m.quantidade)) return;
    setErro(null);
    try { await alterar.mutateAsync({ id: m.id, quantidade: q }); } catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao alterar'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-lg font-semibold ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>Lista de materiais</h3>
        <p className={`text-sm ${claro ? 'text-slate-600' : 'text-neutral-400'}`}>
          Quantidade <b>por peça</b>. Os materiais vêm do catálogo do Almoxarifado (mesmo código do GRV). Ao liberar a OS, a lista é copiada com o total.
        </p>
      </div>

      {podeEditar && (
        <form onSubmit={handleIncluir} className="card space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_100px]">
            <div className="relative">
              <label className="label" htmlFor="busca-material">Material</label>
              <input
                id="busca-material"
                className="input w-full"
                role="combobox"
                aria-expanded={aberta && opcoes.length > 0}
                aria-controls="lista-materiais-catalogo"
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Código ou nome: 2-01, 20100513, parafuso m12…"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setEscolhido(null); setAberta(true); setAtivo(0); }}
                onFocus={() => setAberta(true)}
                onBlur={() => { fechar.current = setTimeout(() => setAberta(false), 150); }}
                onKeyDown={(e) => {
                  if (!aberta || !opcoes.length) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => (i + 1) % opcoes.length); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => (i - 1 + opcoes.length) % opcoes.length); }
                  else if (e.key === 'Enter') { e.preventDefault(); escolher(opcoes[Math.min(ativo, opcoes.length - 1)]); }
                  else if (e.key === 'Escape') setAberta(false);
                }}
              />
              {aberta && !escolhido && busca.trim().length >= 2 && (
                <ul id="lista-materiais-catalogo" role="listbox" className={`absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border shadow-xl ${claro ? 'border-slate-200 bg-white' : 'border-neutral-700 bg-neutral-900'}`}>
                  {isFetching && !opcoes.length && <li className="px-3 py-2 text-sm text-neutral-400">Buscando…</li>}
                  {!isFetching && !opcoes.length && <li className="px-3 py-2 text-sm text-neutral-400">Nenhum material com “{busca.trim()}” no catálogo.</li>}
                  {opcoes.map((m, k) => (
                    <li
                      key={m.codigo}
                      role="option"
                      aria-selected={k === ativo}
                      onMouseDown={(e) => { e.preventDefault(); if (fechar.current) clearTimeout(fechar.current); escolher(m); }}
                      onMouseEnter={() => setAtivo(k)}
                      className={`px-3 py-2 cursor-pointer text-sm ${k === ativo ? 'bg-forja-500/20' : ''}`}
                    >
                      <span className={`font-mono ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>{m.codigo}</span>{' '}
                      <span className={claro ? 'text-slate-800' : 'text-neutral-200'}>{m.descricao}</span>
                      <span className="block text-xs text-neutral-500">{[m.grupo, m.unidade].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="label" htmlFor="qtd-material">Qtd. por peça</label>
              <input id="qtd-material" ref={qtdRef} className="input w-full" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="4" />
            </div>
            <div>
              <label className="label" htmlFor="un-material">Unidade</label>
              <input id="un-material" className="input w-full" maxLength={8} value={unidade} onChange={(e) => setUnidade(e.target.value.toUpperCase())} placeholder="PÇ" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="obs-material">Observação (opcional)</label>
            <input id="obs-material" className="input w-full" maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: só na fundição" />
          </div>
          <div className="flex justify-end gap-2">
            {(busca || quantidade) && <button type="button" className="btn-ghost px-4 py-2" onClick={limpar}>Limpar</button>}
            <button type="submit" className="btn-primary px-4 py-2" disabled={incluir.isPending}>{incluir.isPending ? 'Incluindo…' : 'Incluir material'}</button>
          </div>
        </form>
      )}

      {erro && <div className="error-message">{erro}</div>}
      {isLoading && <div className="card text-center text-neutral-400">Carregando...</div>}
      {isError && <div className="error-message">Não foi possível carregar a lista de materiais.</div>}
      {lista && lista.length === 0 && (
        <div className="card text-center text-neutral-400">
          <p className="text-neutral-300 mb-1">Nenhum material neste Artigo.</p>
          <p className="text-sm">Inclua parafusos, chavetas, pó de metalização, a caixa da embalagem… A OS leva a lista na liberação.</p>
        </div>
      )}
      {lista && lista.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3">Código</th>
                <th className="text-left px-3 py-3">Material</th>
                <th className="text-right px-3 py-3">Por peça</th>
                <th className="text-left px-3 py-3">Un.</th>
                <th className="text-right px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {lista.map((m) => (
                <tr key={m.id} className="hover:bg-neutral-800/30">
                  <td className="px-3 py-3 font-mono text-neutral-100 whitespace-nowrap">{m.materialCodigo ?? '—'}</td>
                  <td className="px-3 py-3 text-neutral-200">{m.descricao}{m.observacoes && <span className="block text-xs text-neutral-500">{m.observacoes}</span>}</td>
                  <td className="px-3 py-3 text-right">
                    {podeEditar ? (
                      <input
                        aria-label={`Quantidade por peça de ${m.descricao}`}
                        className="input w-24 text-right"
                        inputMode="decimal"
                        defaultValue={formatarQuantidade(m.quantidade)}
                        onBlur={(e) => void mudarQuantidade(m, e.target.value)}
                      />
                    ) : (
                      <span className="font-mono text-neutral-100">{formatarQuantidade(m.quantidade)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-neutral-300">{m.unidade}</td>
                  <td className="px-3 py-3 text-right">
                    {podeEditar && <button type="button" className="text-red-400 hover:text-red-300 text-xs font-medium" onClick={() => setRetirando(m)}>Retirar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!retirando}
        title="Retirar material"
        message={retirando ? `Retirar ${retirando.descricao} da lista deste Artigo? As OS já liberadas mantêm a cópia delas.` : ''}
        confirmLabel="Retirar"
        variant="danger"
        loading={retirar.isPending}
        onConfirm={async () => {
          if (!retirando) return;
          try { await retirar.mutateAsync(retirando.id); setRetirando(null); } catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao retirar'); setRetirando(null); }
        }}
        onCancel={() => setRetirando(null)}
      />
    </div>
  );
}
