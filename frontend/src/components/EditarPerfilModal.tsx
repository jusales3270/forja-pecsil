// ============================================================
// Forja - Modal de Edição de Perfil / Acesso
// Permite ao próprio usuário trocar seu nome, login e senha
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../lib/auth-store';
import { PAPEL_LABEL } from '@forja/shared';
import { toast } from './Toast';
import { api } from '../lib/api';

interface EditarPerfilModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditarPerfilModal({ open, onClose }: EditarPerfilModalProps) {
  const { pessoa, updatePerfil } = useAuth();

  const [nome, setNome] = useState('');
  const [codigoPessoal, setCodigoPessoal] = useState('');
  const [pin, setPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicializa com os dados do usuário atual e busca dados mais recentes se necessário
  useEffect(() => {
    if (!open) return;
    setNome(pessoa?.nome ?? '');
    setCodigoPessoal(pessoa?.codigoPessoal ?? '');
    setPin('');
    setConfirmarPin('');
    setErro(null);

    // Se codigoPessoal ainda não estiver no store, busca via /auth/me
    if (!pessoa?.codigoPessoal) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data?.data) {
            const u = res.data.data;
            if (u.nome) setNome(u.nome);
            if (u.codigoPessoal) setCodigoPessoal(u.codigoPessoal);
          }
        })
        .catch(() => {});
    }
  }, [open, pessoa]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const nomeFormatado = nome.trim();
    const loginFormatado = codigoPessoal.trim();

    if (!nomeFormatado || nomeFormatado.length < 2) {
      return setErro('Nome deve ter ao menos 2 caracteres');
    }

    if (!loginFormatado) {
      return setErro('Nome de usuário / Login é obrigatório');
    }

    if (!/^[a-z0-9_-]+$/i.test(loginFormatado)) {
      return setErro('Login deve conter apenas letras, números, hífen (-) ou underline (_) sem espaços');
    }

    if (pin) {
      if (pin !== confirmarPin) {
        return setErro('A confirmação de senha não confere');
      }
    }

    setLoading(true);

    try {
      await updatePerfil({
        nome: nomeFormatado,
        codigoPessoal: loginFormatado,
        ...(pin ? { pin: pin.trim() } : {}),
      });

      toast.sucesso('Perfil atualizado com sucesso!');
      onClose();
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.details?.fieldErrors;
      if (fieldErrors) {
        const primeiroCampo = Object.keys(fieldErrors)[0];
        const mensagens = fieldErrors[primeiroCampo];
        const msg = Array.isArray(mensagens) ? mensagens[0] : mensagens;
        setErro(msg || err?.response?.data?.message || 'Dados inválidos');
      } else {
        setErro(err?.response?.data?.message ?? 'Falha ao atualizar dados. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = PAPEL_LABEL[pessoa?.papel ?? 'estacao'] || 'Usuário';

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Minha Conta"
      size="md"
      forcarEscuro
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors font-medium"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="editar-perfil-form"
            disabled={loading}
            className="px-5 py-2 text-sm bg-forja-500 hover:bg-forja-600 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg shadow-forja-500/20 transition-all active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="editar-perfil-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Banner do usuário atual */}
        <div className="flex items-center gap-3 p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-forja-500/15 border border-forja-500/30 text-forja-400 font-bold flex items-center justify-center text-sm shrink-0">
            {(nome || pessoa?.nome || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-100 truncate">
                {nome || pessoa?.nome || 'Usuário'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium">
                {roleLabel}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Login: @{codigoPessoal || pessoa?.codigoPessoal || '—'}
            </p>
          </div>
        </div>

        {erro && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-800/60 rounded-lg px-3.5 py-2.5 flex items-start gap-2">
            <span className="text-red-400 font-bold">⚠</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Nome de Exibição */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
            Nome de exibição <span className="text-forja-400">*</span>
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:border-forja-500 focus:ring-1 focus:ring-forja-500 text-sm transition-colors"
            placeholder="Seu nome ou nome da estação"
            required
            autoComplete="name"
          />
          <p className="text-xs mt-1.5 text-neutral-400">
            Como você ou seu posto aparecem no sistema e relatórios.
          </p>
        </div>

        {/* Nome de Usuário / Login */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
            Nome de usuário / Login <span className="text-forja-400">*</span>
          </label>
          <input
            type="text"
            value={codigoPessoal}
            onChange={(e) => setCodigoPessoal(e.target.value.replace(/\s+/g, '-'))}
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:border-forja-500 focus:ring-1 focus:ring-forja-500 text-sm font-mono transition-colors"
            placeholder="Ex: joao, desbaste, 0020"
            required
            autoComplete="username"
          />
          <p className="text-xs mt-1.5 text-neutral-400">
            Identificador para entrar no sistema. Letras, números, hífen e underline (sem espaços).
          </p>
        </div>

        {/* Divisão Nova Senha */}
        <div className="pt-3 border-t border-neutral-800 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
              Nova Senha <span className="text-neutral-500 font-normal lowercase">(opcional)</span>
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:border-forja-500 focus:ring-1 focus:ring-forja-500 text-sm transition-colors"
              placeholder="Deixe em branco para manter a atual"
              autoComplete="new-password"
            />
            <p className="text-xs mt-1.5 text-neutral-400">
              Aceita letras, números e caracteres especiais sem limite de tamanho.
            </p>
          </div>

          {pin.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
                Confirmar Nova Senha <span className="text-forja-400">*</span>
              </label>
              <input
                type="password"
                value={confirmarPin}
                onChange={(e) => setConfirmarPin(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:border-forja-500 focus:ring-1 focus:ring-forja-500 text-sm transition-colors"
                placeholder="Digite a nova senha novamente"
                autoComplete="new-password"
                required
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
