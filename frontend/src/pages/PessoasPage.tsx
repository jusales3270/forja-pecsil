// ============================================================
// Forja - Gerenciamento de Usuários e Acessos
// ============================================================

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PAPEL_LABEL, type Papel } from '@forja/shared';
import {
  usePessoasList,
  useCriarPessoa,
  useAtualizarPessoa,
  useExcluirPessoa,
  type Pessoa,
} from '../hooks/usePessoas';
import { useEtapasList } from '../hooks/useEtapas';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useTheme } from '../lib/theme-store';
import { useAuth } from '../lib/auth-store';

const OPCOES_PAPEL: { papel: Papel; label: string; descricao: string; categoria: 'estacao' | 'fabrica' | 'gestao' }[] = [
  { papel: 'estacao', label: '🖥️ Conta de Estação (Posto de Trabalho)', descricao: 'Terminal fixo na máquina. Opera só a própria estação.', categoria: 'estacao' },
  { papel: 'operador', label: '⚙️ Operador', descricao: 'Operador de chão de fábrica para apontamento de peças e turnos.', categoria: 'fabrica' },
  { papel: 'programador', label: '💻 Programador CNC / Preparador', descricao: 'Prepara e inicia ordens de produção nas máquinas.', categoria: 'fabrica' },
  { papel: 'inspetor', label: '🔍 Inspetor de Qualidade', descricao: 'Realiza inspeções dimensionais e de volumetria.', categoria: 'fabrica' },
  { papel: 'embalador', label: '📦 Embalador / Expedição', descricao: 'Conferência e fechamento de embalagem.', categoria: 'fabrica' },
  { papel: 'pcp', label: '📋 PCP (Planejamento e Controle)', descricao: 'Criação de OS, artigos e gerenciamento da linha.', categoria: 'gestao' },
  { papel: 'engenharia', label: '📐 Engenharia', descricao: 'Acesso a desenhos técnicos, rotas e processos.', categoria: 'gestao' },
  { papel: 'chefe', label: '📊 Chefe / Diretoria', descricao: 'Painel gerencial em tempo real e acompanhamento.', categoria: 'gestao' },
  { papel: 'admin', label: '👑 Administrador', descricao: 'Acesso total, incluindo configurações do sistema.', categoria: 'gestao' },
];

/** Papéis em que a vinculação a uma estação específica é aplicável. */
const ACEITA_ESTACAO: Papel[] = ['estacao', 'programador', 'operador'];

const BADGES_PAPEL: Record<Papel, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  chefe: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  pcp: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  engenharia: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  estacao: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  programador: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  operador: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  inspetor: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  embalador: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
};

export default function PessoasPage() {
  const navigate = useNavigate();
  const { claro } = useTheme();
  const pessoaLogada = useAuth((s) => s.pessoa);
  const ehAdmin = pessoaLogada?.papel === 'admin';

  const { data: resposta, isLoading } = usePessoasList();
  const pessoas = resposta?.data ?? [];
  const atualizar = useAtualizarPessoa();
  const excluir = useExcluirPessoa();

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'estacao' | 'fabrica' | 'gestao'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');

  const [modal, setModal] = useState<{ aberto: boolean; pessoa: Pessoa | null }>({
    aberto: false,
    pessoa: null,
  });

  const [confirmarExclusao, setConfirmarExclusao] = useState<{ aberto: boolean; pessoa: Pessoa | null }>({
    aberto: false,
    pessoa: null,
  });

  const pessoasFiltradas = useMemo(() => {
    return pessoas.filter((p) => {
      // Busca texto
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bateNome = p.nome.toLowerCase().includes(termo);
        const bateLogin = p.codigoPessoal.toLowerCase().includes(termo);
        const bateEstacao = p.etapa?.nome.toLowerCase().includes(termo);
        if (!bateNome && !bateLogin && !bateEstacao) return false;
      }

      // Filtro de status
      if (filtroStatus === 'ativos' && !p.ativo) return false;
      if (filtroStatus === 'inativos' && p.ativo) return false;

      // Filtro de categoria
      if (filtroCategoria !== 'todos') {
        const opcao = OPCOES_PAPEL.find((o) => o.papel === p.papel);
        if (opcao?.categoria !== filtroCategoria) return false;
      }

      return true;
    });
  }, [pessoas, busca, filtroCategoria, filtroStatus]);

  async function handleToggleAtivo(p: Pessoa) {
    try {
      await atualizar.mutateAsync({
        id: p.id,
        input: { ativo: !p.ativo },
      });
      toast.sucesso(`Usuário "${p.nome}" ${p.ativo ? 'desativado' : 'reativado'} com sucesso!`);
    } catch (err: any) {
      toast.erro(err?.response?.data?.message ?? 'Falha ao alterar status do usuário');
    }
  }

  async function handleConfirmarExclusao() {
    if (!confirmarExclusao.pessoa) return;
    const { id, nome } = confirmarExclusao.pessoa;

    try {
      const res = await excluir.mutateAsync({ id, hard: true });
      if (res?.message) {
        toast.aviso(res.message);
      } else {
        toast.sucesso(`Usuário "${nome}" excluído com sucesso!`);
      }
    } catch (err: any) {
      toast.erro(err?.response?.data?.message ?? 'Falha ao excluir usuário');
    } finally {
      setConfirmarExclusao({ aberto: false, pessoa: null });
    }
  }

  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        card: 'bg-white border border-slate-200 shadow-sm',
        head: 'bg-slate-50 text-slate-600 border-b border-slate-200',
        divisor: 'divide-slate-200',
        linha: 'hover:bg-slate-50/80 transition-colors',
        celula: 'text-slate-700',
        forte: 'text-slate-900',
        input: 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
        badgeInativo: 'bg-slate-200 text-slate-600',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-500',
        card: 'bg-neutral-900 border border-neutral-800 shadow-md',
        head: 'bg-neutral-950/70 text-neutral-400 border-b border-neutral-800',
        divisor: 'divide-neutral-800',
        linha: 'hover:bg-neutral-800/40 transition-colors',
        celula: 'text-neutral-300',
        forte: 'text-neutral-100',
        input: 'bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500',
        badgeInativo: 'bg-neutral-800 text-neutral-400',
      };

  return (
    <div className={`min-h-screen p-6 md:p-8 ${T.bg}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Topo / Voltar */}
        <button
          onClick={() => navigate('/')}
          className={`text-sm ${T.sub} hover:opacity-80 flex items-center gap-1.5 transition`}
        >
          <span className="text-base leading-none">←</span> Voltar para o início
        </button>

        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-3xl font-extrabold tracking-tight ${T.texto}`}>
              Usuários e Credenciais
            </h1>
            <p className={`text-sm ${T.sub} mt-1`}>
              Cadastre e gerencie os logins individuais, operadores e postos de trabalho de cada estação.
            </p>
          </div>
          <button
            onClick={() => setModal({ aberto: true, pessoa: null })}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-forja-500 hover:bg-forja-600 text-white rounded-xl font-semibold shadow-lg shadow-forja-500/20 transition active:scale-95 shrink-0"
          >
            <span>+</span>
            <span>Novo Usuário</span>
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className={`p-4 rounded-xl ${T.card} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
          <div className="flex-1 relative">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, login ou estação..."
              className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-forja-500 transition ${T.input}`}
            />
            <span className="absolute left-3 top-2.5 text-neutral-400 text-sm pointer-events-none">
              🔍
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value as any)}
              className={`px-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-forja-500 transition ${T.input}`}
            >
              <option value="todos">Todos os setores</option>
              <option value="estacao">🖥️ Postos de Estação</option>
              <option value="fabrica">⚙️ Chão de Fábrica</option>
              <option value="gestao">📋 Gestão e PCP</option>
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className={`px-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-forja-500 transition ${T.input}`}
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Apenas Ativos</option>
              <option value="inativos">Apenas Inativos</option>
            </select>

            <span className={`text-xs px-2.5 py-1.5 rounded-md border ${claro ? 'border-slate-300 text-slate-500' : 'border-neutral-800 text-neutral-400'}`}>
              {pessoasFiltradas.length} {pessoasFiltradas.length === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
        </div>

        {/* Tabela Unificada */}
        {isLoading ? (
          <div className={`p-12 text-center rounded-xl ${T.card} ${T.sub}`}>
            Carregando usuários...
          </div>
        ) : pessoasFiltradas.length === 0 ? (
          <div className={`p-12 text-center rounded-xl ${T.card} ${T.sub}`}>
            Nenhum usuário encontrado com os filtros atuais.
          </div>
        ) : (
          <div className={`rounded-xl overflow-hidden ${T.card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`text-xs uppercase font-semibold tracking-wider ${T.head}`}>
                  <tr>
                    <th className="text-left px-5 py-3.5">Nome</th>
                    <th className="text-left px-5 py-3.5">Login</th>
                    <th className="text-left px-5 py-3.5">Função / Setor</th>
                    <th className="text-left px-5 py-3.5">Estação Pertencente</th>
                    <th className="text-left px-5 py-3.5">Status</th>
                    <th className="text-right px-5 py-3.5">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${T.divisor}`}>
                  {pessoasFiltradas.map((p) => {
                    const badge = BADGES_PAPEL[p.papel] ?? BADGES_PAPEL.operador;
                    return (
                      <tr key={p.id} className={T.linha}>
                        {/* Nome */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-forja-500/15 border border-forja-500/30 text-forja-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {p.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <span className={`font-semibold ${T.forte}`}>
                              {p.nome}
                            </span>
                          </div>
                        </td>

                        {/* Login */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs px-2.5 py-1 rounded bg-neutral-800/60 border border-neutral-700/60 text-neutral-200">
                            {p.codigoPessoal}
                          </span>
                        </td>

                        {/* Função / Papel */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {PAPEL_LABEL[p.papel]}
                          </span>
                        </td>

                        {/* Estação Pertencente */}
                        <td className={`px-5 py-3.5 ${T.celula}`}>
                          {p.etapa ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                              <span>📍</span>
                              <span>{p.etapa.nome}</span>
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-xs">— Acesso Geral</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {p.ativo ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-medium border border-neutral-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setModal({ aberto: true, pessoa: p })}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-200 hover:bg-neutral-800 transition"
                              title="Editar usuário"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => handleToggleAtivo(p)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                                p.ativo
                                  ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/15'
                                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
                              }`}
                              title={p.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                            >
                              {p.ativo ? 'Desativar' : 'Ativar'}
                            </button>

                            {ehAdmin && (
                              <button
                                onClick={() => setConfirmarExclusao({ aberto: true, pessoa: p })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/40 text-red-400 bg-red-600/15 hover:bg-red-600 hover:text-white transition shadow-sm"
                                title="Excluir usuário permanentemente"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Excluir</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {modal.aberto && (
        <PessoaModal
          pessoa={modal.pessoa}
          onClose={() => setModal({ aberto: false, pessoa: null })}
        />
      )}

      {/* Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        open={confirmarExclusao.aberto}
        title="Excluir Usuário"
        message={`Deseja realmente remover o usuário "${confirmarExclusao.pessoa?.nome}"? Se não houver histórico de produção associado a ele, será excluído permanentemente; caso contrário, será desativado.`}
        confirmLabel="Excluir Usuário"
        cancelLabel="Cancelar"
        variant="danger"
        onCancel={() => setConfirmarExclusao({ aberto: false, pessoa: null })}
        onConfirm={handleConfirmarExclusao}
      />
    </div>
  );
}

// ============================================================
// Modal Unificado e Simplificado de Criação/Edição de Usuário
// ============================================================

function PessoaModal({ pessoa, onClose }: { pessoa: Pessoa | null; onClose: () => void }) {
  const ehEdicao = pessoa !== null;
  const { claro } = useTheme();
  const { data: etapas } = useEtapasList();
  const criar = useCriarPessoa();
  const atualizar = useAtualizarPessoa();

  const [nome, setNome] = useState('');
  const [codigoPessoal, setCodigoPessoal] = useState('');
  const [pin, setPin] = useState('');
  const [papel, setPapel] = useState<Papel>('estacao');
  const [etapaId, setEtapaId] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setNome(pessoa?.nome ?? '');
    setCodigoPessoal(pessoa?.codigoPessoal ?? '');
    setPin('');
    setPapel(pessoa?.papel ?? 'estacao');
    setEtapaId(pessoa?.etapaId ?? '');
    setAtivo(pessoa?.ativo ?? true);
    setErro(null);
  }, [pessoa]);

  const pedeEstacao = ACEITA_ESTACAO.includes(papel);
  const loading = criar.isPending || atualizar.isPending;

  function escolherEtapa(id: string) {
    setEtapaId(id);
    // Se for conta de estação nova e o usuário ainda não tiver customizado o nome e login,
    // preenche automaticamente com o nome da estação limpo
    if (!ehEdicao && papel === 'estacao' && id) {
      const etapa = etapas?.find((e) => e.id === id);
      if (etapa) {
        if (!nome || nome === etapa.nome) {
          setNome(etapa.nome);
        }
        if (!codigoPessoal) {
          setCodigoPessoal(
            etapa.nome
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .split('/')[0]
              .trim()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''),
          );
        }
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const nomeFormatado = nome.trim();
    const loginFormatado = codigoPessoal.trim();
    const pinFormatado = pin.trim();

    if (!nomeFormatado || nomeFormatado.length < 2) {
      return setErro('Nome deve ter ao menos 2 caracteres');
    }

    if (!loginFormatado) {
      return setErro('Login de acesso é obrigatório');
    }

    if (!/^[a-z0-9_-]+$/i.test(loginFormatado)) {
      return setErro('Login deve conter apenas letras, números, hífen (-) ou underline (_) sem espaços');
    }

    if (!ehEdicao && !pinFormatado) {
      return setErro('Senha de acesso é obrigatória');
    }

    if (papel === 'estacao' && !etapaId) {
      return setErro('Conta de estação precisa obrigatoriamente estar vinculada a uma estação');
    }

    try {
      if (ehEdicao && pessoa) {
        await atualizar.mutateAsync({
          id: pessoa.id,
          input: {
            nome: nomeFormatado,
            codigoPessoal: loginFormatado,
            papel,
            etapaId: pedeEstacao ? etapaId || null : null,
            ativo,
            ...(pinFormatado ? { pin: pinFormatado } : {}),
          },
        });
        toast.sucesso('Usuário atualizado com sucesso!');
      } else {
        await criar.mutateAsync({
          nome: nomeFormatado,
          codigoPessoal: loginFormatado,
          pin: pinFormatado,
          papel,
          etapaId: pedeEstacao ? etapaId || null : null,
          ativo,
        });
        toast.sucesso('Novo usuário cadastrado com sucesso!');
      }
      onClose();
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.details?.fieldErrors;
      if (fieldErrors) {
        const primeiroCampo = Object.keys(fieldErrors)[0];
        const mensagens = fieldErrors[primeiroCampo];
        const msg = Array.isArray(mensagens) ? mensagens[0] : mensagens;
        setErro(msg || err?.response?.data?.message || 'Dados inválidos');
      } else {
        setErro(err?.response?.data?.message ?? 'Erro ao salvar. Tente novamente.');
      }
    }
  }

  const ajudaClass = claro ? 'text-slate-500' : 'text-neutral-400';

  return (
    <Modal
      open
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar Usuário e Acesso' : 'Novo Usuário ou Conta de Estação'}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-4 py-2 text-sm"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="pessoa-form"
            disabled={loading}
            className="px-5 py-2.5 bg-forja-500 hover:bg-forja-600 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-forja-500/20 transition active:scale-95"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar Alterações' : 'Criar Usuário'}
          </button>
        </>
      }
    >
      <form id="pessoa-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        {/* Nome */}
        <div>
          <label className="label">Nome do Usuário ou Posto *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder="Ex: Douglas, ou Desbaste, ou Torno CNC"
            required
            autoComplete="name"
          />
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            Nome exibido nas ordens de serviço, apontamentos e telas.
          </p>
        </div>

        {/* Função / Onde Pertence */}
        <div>
          <label className="label">Função / Onde Pertence *</label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            className="input"
          >
            {OPCOES_PAPEL.map((op) => (
              <option key={op.papel} value={op.papel}>
                {op.label}
              </option>
            ))}
          </select>
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            {OPCOES_PAPEL.find((o) => o.papel === papel)?.descricao}
          </p>
        </div>

        {/* Estação Pertencente */}
        {pedeEstacao && (
          <div>
            <label className="label">
              Estação Pertencente {papel === 'estacao' ? '*' : '(Opcional)'}
            </label>
            <select
              value={etapaId}
              onChange={(e) => escolherEtapa(e.target.value)}
              className="input"
              required={papel === 'estacao'}
            >
              <option value="">
                {papel === 'estacao' ? 'Selecione a estação...' : 'Acesso a todas as estações'}
              </option>
              {etapas?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <p className={`text-xs mt-1 ${ajudaClass}`}>
              {papel === 'estacao'
                ? 'Esta conta operará exclusivamente a estação selecionada acima.'
                : 'Selecione se deseja restringir este profissional a uma estação específica.'}
            </p>
          </div>
        )}

        {/* Login de Acesso */}
        <div>
          <label className="label">Login de Acesso *</label>
          <input
            type="text"
            value={codigoPessoal}
            onChange={(e) => setCodigoPessoal(e.target.value.replace(/\s+/g, '-').toLowerCase())}
            className="input font-mono"
            placeholder="Ex: douglas, desbaste, 0020"
            required
            autoComplete="username"
          />
          <p className={`text-xs mt-1 ${ajudaClass}`}>
            Identificador para login. Use apenas letras, números, hífen e underline (espaços são convertidos automaticamente).
          </p>
        </div>

        {/* Senha */}
        <div>
          <label className="label">
            Senha {ehEdicao ? '(Opcional — deixe em branco para manter)' : '*'}
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input"
            placeholder={ehEdicao ? 'Manter senha atual' : 'Digite a senha desejada (letras, números, símbolos)'}
            autoComplete="new-password"
            required={!ehEdicao}
          />
        </div>

        {/* Checkbox Ativo */}
        {ehEdicao && (
          <div className="flex items-center gap-3 pt-2">
            <input
              id="pessoa-ativo-modal"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 accent-forja-500 rounded"
            />
            <label htmlFor="pessoa-ativo-modal" className={`text-sm cursor-pointer ${ajudaClass}`}>
              Conta ativa no sistema
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
