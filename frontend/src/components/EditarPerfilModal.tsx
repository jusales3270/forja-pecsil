// ============================================================
// Forja - Modal de Edição de Perfil / Acesso
// Permite ao próprio usuário trocar seu nome, login e senha
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../lib/auth-store';
import { useTheme } from '../lib/theme-store';
import { toast } from './Toast';
import { api } from '../lib/api';

interface EditarPerfilModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditarPerfilModal({ open, onClose }: EditarPerfilModalProps) {
  const { pessoa, updatePerfil } = useAuth();
  const { claro } = useTheme();

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
      if (pin.length < 4) {
        return setErro('Nova senha deve ter ao menos 4 caracteres');
      }
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

  const ajudaClass = claro ? 'text-slate-500' : 'text-neutral-400';

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Minha Conta"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-4 py-2"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="editar-perfil-form"
            disabled={loading}
            className="px-5 py-2 bg-forja-500 hover:bg-forja-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <form id="editar-perfil-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Nome de exibição *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder="Seu nome ou nome da estação"
            required
            autoComplete="name"
          />
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            Como você ou seu posto aparecem no sistema e relatórios.
          </p>
        </div>

        <div>
          <label className="label">Nome de usuário / Login *</label>
          <input
            type="text"
            value={codigoPessoal}
            onChange={(e) => setCodigoPessoal(e.target.value.replace(/\s+/g, '-'))}
            className="input font-mono"
            placeholder="Ex: joao, desbaste, 0020"
            required
            autoComplete="username"
          />
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            Identificador para entrar no sistema. Letras, números, hífen e underline (sem espaços).
          </p>
        </div>

        <div className="pt-2 border-t border-neutral-800">
          <label className="label">Nova Senha / PIN (opcional)</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input"
            placeholder="Deixe em branco para manter a atual"
            autoComplete="new-password"
          />
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            Mínimo de 4 dígitos ou caracteres.
          </p>
        </div>

        {pin.length > 0 && (
          <div>
            <label className="label">Confirmar Nova Senha *</label>
            <input
              type="password"
              value={confirmarPin}
              onChange={(e) => setConfirmarPin(e.target.value)}
              className="input"
              placeholder="Digite a nova senha novamente"
              autoComplete="new-password"
              required
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
