// ============================================================
// Forja - Seletor de cliente com cadastro e exclusão rápidos
// ============================================================
// Usado na Nova OS: o PCP escolhe o cliente, cadastra um novo sem sair da
// tela ou exclui um que não usa mais. Tudo inline — um segundo popup por
// cima da OS fecharia junto no ESC e perderia o que já foi digitado.
// ============================================================

import { useState, type KeyboardEvent } from 'react';
import { useCriarCliente, useExcluirCliente, type Cliente } from '../hooks/useClientes';
import { toast } from './Toast';

interface Props {
  clientes: Cliente[];
  value: string;
  onChange: (clienteId: string) => void;
}

const erroApi = (err: unknown, padrao: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? padrao;

export function SeletorCliente({ clientes, value, onChange }: Props) {
  const criar = useCriarCliente();
  const excluir = useExcluirCliente();
  const [modo, setModo] = useState<'lista' | 'novo' | 'excluir'>('lista');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const selecionado = clientes.find((c) => c.id === value);

  const voltar = () => {
    setModo('lista');
    setNome('');
    setErro(null);
  };

  async function salvarNovo() {
    const limpo = nome.trim();
    if (limpo.length < 2) return setErro('Digite o nome do cliente (mínimo 2 letras).');
    try {
      const { data, meta } = await criar.mutateAsync({ nome: limpo });
      onChange(data.id);
      toast.sucesso(meta.reativado ? `Cliente "${data.nome}" reativado.` : `Cliente "${data.nome}" cadastrado.`);
      voltar();
    } catch (err) {
      setErro(erroApi(err, 'Não foi possível cadastrar o cliente.'));
    }
  }

  async function confirmarExclusao() {
    if (!selecionado) return;
    try {
      const r = await excluir.mutateAsync(selecionado.id);
      onChange('');
      toast.sucesso(r.message, 6000);
      voltar();
    } catch (err) {
      setErro(erroApi(err, 'Não foi possível excluir o cliente.'));
    }
  }

  // Enter no campo do nome salva o cliente, não envia a OS
  const noEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      salvarNovo();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      voltar();
    }
  };

  return (
    <div>
      <label className="label-compact">Cliente *</label>

      {modo === 'novo' ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErro(null); }}
            onKeyDown={noEnter}
            placeholder="Nome do novo cliente"
            className="input py-2 text-sm flex-1 min-w-0"
            disabled={criar.isPending}
          />
          <button type="button" onClick={salvarNovo} disabled={criar.isPending} className="px-3 py-2 text-xs font-semibold rounded-lg bg-forja-500 hover:bg-forja-600 text-white disabled:opacity-50">
            {criar.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={voltar} disabled={criar.isPending} className="px-3 py-2 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
            Cancelar
          </button>
        </div>
      ) : (
        <select value={value} onChange={(e) => { onChange(e.target.value); voltar(); }} className="input py-2 text-sm">
          <option value="">Selecione...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      )}

      {modo === 'excluir' && selecionado ? (
        <div className="mt-2 p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-200">
          <p>
            Excluir <strong>{selecionado.nome}</strong>? Se já tiver OS, artigos ou tolerâncias, ele só sai da lista e o histórico é mantido.
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={confirmarExclusao} disabled={excluir.isPending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">
              {excluir.isPending ? 'Excluindo…' : 'Sim, excluir'}
            </button>
            <button type="button" onClick={voltar} disabled={excluir.isPending} className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        modo === 'lista' && (
          <div className="flex gap-3 mt-1.5 text-xs">
            <button type="button" onClick={() => { setModo('novo'); setErro(null); }} className="text-forja-400 hover:text-forja-300 hover:underline">
              + Novo cliente
            </button>
            <button
              type="button"
              onClick={() => { setModo('excluir'); setErro(null); }}
              disabled={!selecionado}
              className="text-neutral-400 hover:text-red-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:hover:text-neutral-400"
              title={selecionado ? `Excluir ${selecionado.nome}` : 'Selecione um cliente para excluir'}
            >
              Excluir selecionado
            </button>
          </div>
        )
      )}

      {erro && <p role="alert" className="text-xs text-red-400 mt-1.5">{erro}</p>}
    </div>
  );
}
