// ============================================================
// Forja - Aba "Materiais" do detalhe da OS
// ============================================================
// Cópia da lista de materiais do Artigo feita na liberação/abertura da OS,
// com o total (por peça × quantidade). Mudar o Artigo depois não muda a OS.
// ============================================================

import { useNavigate } from 'react-router-dom';
import type { OS } from '../../../hooks/useOS';
import { formatarQuantidade } from '../../../hooks/useMateriais';
import { useTheme } from '../../../lib/theme-store';

export function MateriaisOSTab({ os }: { os: OS }) {
  const { claro } = useTheme();
  const navigate = useNavigate();
  const lista = os.materiais ?? [];
  const sub = claro ? 'text-slate-500' : 'text-neutral-400';

  if (os.status === 'rascunho') {
    return (
      <div className="card">
        <p className={claro ? 'text-slate-700' : 'text-neutral-200'}>A lista de materiais é do artigo e é copiada para a OS na liberação.</p>
        {os.artigo?.id && <button type="button" className="btn-secondary mt-3 px-4 py-2 text-sm" onClick={() => navigate(`/artigos/${os.artigo!.id}`)}>Abrir os materiais do artigo</button>}
      </div>
    );
  }
  if (!lista.length) {
    return <div className={`card text-center ${sub}`}>Esta OS foi aberta sem lista de materiais.</div>;
  }
  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-100 text-slate-500' : 'bg-neutral-950 text-neutral-400'}`}>
          <tr>
            <th className="text-left px-3 py-3">Código</th>
            <th className="text-left px-3 py-3">Material</th>
            <th className="text-right px-3 py-3">Por peça</th>
            <th className="text-right px-3 py-3">Total da OS</th>
            <th className="text-left px-3 py-3">Un.</th>
          </tr>
        </thead>
        <tbody className={claro ? 'divide-y divide-slate-200' : 'divide-y divide-neutral-800'}>
          {lista.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-3 font-mono whitespace-nowrap">{m.materialCodigo ?? '—'}</td>
              <td className="px-3 py-3">{m.descricao}{m.observacoes && <span className={`block text-xs ${sub}`}>{m.observacoes}</span>}</td>
              <td className="px-3 py-3 text-right font-mono">{formatarQuantidade(m.quantidadePorPeca)}</td>
              <td className="px-3 py-3 text-right font-mono font-semibold">{formatarQuantidade(m.quantidadeTotal)}</td>
              <td className="px-3 py-3">{m.unidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
