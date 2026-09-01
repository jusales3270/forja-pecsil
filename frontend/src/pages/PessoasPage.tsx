// ============================================================
// Forja - Usuários e contas de estação
// ============================================================
// Uma CONTA DE ESTAÇÃO é o login do posto de trabalho (fundicao, desbaste...):
// compartilhada por quem estiver ali, opera a própria estação e enxerga as
// demais sem poder alterar nada. Quem executou de fato continua sendo o
// operador escolhido na hora de iniciar a OP.
// ============================================================

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PAPEL_LABEL, type Papel } from '@forja/shared';
import {
  usePessoasList,
  useCriarPessoa,
  useAtualizarPessoa,
  useDesativarPessoa,
  type Pessoa,
} from '../hooks/usePessoas';
import { useEtapasList } from '../hooks/useEtapas';
import { Modal } from '../components/Modal';
import { useTheme } from '../lib/theme-store';

const PAPEIS: Papel[] = [
  'estacao',
  'admin',
  'chefe',
  'pcp',
  'engenharia',
  'programador',
  'operador',
  'inspetor',
  'embalador',
];

/** Papéis em que faz sentido prender a conta a uma estação. */
const ACEITA_ESTACAO: Papel[] = ['estacao', 'programador'];

export default function PessoasPage() {
  const navigate = useNavigate();
  const { claro } = useTheme();
  const { data: resposta, isLoading } = usePessoasList();
  const pessoas = resposta?.data;
  const desativar = useDesativarPessoa();

  const [modal, setModal] = useState<{ aberto: boolean; pessoa: Pessoa | null }>({
    aberto: false,
    pessoa: null,
  });

  const contas = pessoas?.filter((p) => p.papel === 'estacao') ?? [];
  const gente = pessoas?.filter((p) => p.papel !== 'estacao') ?? [];

  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        head: 'bg-slate-50 text-slate-500',
        divisor: 'divide-slate-200',
        linha: 'hover:bg-slate-50',
        celula: 'text-slate-700',
        forte: 'text-slate-900',
        btn: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-500',
        head: 'bg-neutral-950 text-neutral-400',
        divisor: 'divide-neutral-800',
        linha: 'hover:bg-neutral-800/30',
        celula: 'text-neutral-300',
        forte: 'text-neutral-100',
        btn: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200',
      };

  function Tabela({ titulo, itens, ajuda }: { titulo: string; itens: Pessoa[]; ajuda?: string }) {
    return (
      <section className="mb-8">
        <h2 className={`text-lg font-semibold ${T.texto}`}>{titulo}</h2>
        {ajuda && <p className={`text-sm ${T.sub} mt-1 mb-3`}>{ajuda}</p>}
        {itens.length === 0 ? (
          <div className={`card text-center ${T.sub}`}>Nenhum registro.</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className={`text-xs uppercase tracking-wide ${T.head}`}>
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Login</th>
                  <th className="text-left px-4 py-3">Papel</th>
                  <th className="text-left px-4 py-3">Estação</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${T.divisor}`}>
                {itens.map((p) => (
                  <tr key={p.id} className={T.linha}>
                    <td className={`px-4 py-3 font-medium ${T.forte}`}>{p.nome}</td>
                    <td className={`px-4 py-3 font-mono ${T.celula}`}>{p.codigoPessoal}</td>
                    <td className={`px-4 py-3 ${T.celula}`}>{PAPEL_LABEL[p.papel]}</td>
                    <td className={`px-4 py-3 ${T.celula}`}>{p.etapa?.nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.ativo ? (
                        <span className="badge-forja">Ativo</span>
                      ) : (
                        <span className="badge-neutral">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setModal({ aberto: true, pessoa: p })}
                        className={`btn px-3 py-1.5 text-xs ${T.btn}`}
                      >
                        Editar
                      </button>
                      {p.ativo && (
                        <button
                          onClick={() => {
                            if (confirm(`Desativar "${p.nome}"? O histórico é preservado.`))
                              desativar.mutate(p.id);
                          }}
                          className="btn px-3 py-1.5 text-xs ml-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30"
                        >
                          Desativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${T.bg}`}>
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className={`text-sm ${T.sub} hover:opacity-70 mb-3 flex items-center gap-1`}
        >
          <span className="text-base leading-none">←</span> Voltar para o início
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className={`text-3xl font-bold ${T.texto}`}>Usuários e estações</h1>
            <p className={`text-sm ${T.sub} mt-1`}>
              Cada processo tem o seu login. Quem entra com a conta de uma estação
              opera aquela estação e só acompanha as demais.
            </p>
          </div>
          <button
            onClick={() => setModal({ aberto: true, pessoa: null })}
            className="px-5 py-2 bg-forja-500 hover:bg-forja-600 text-white rounded-lg font-medium transition"
          >
            Novo
          </button>
        </div>

        {isLoading ? (
          <div className={`card text-center ${T.sub}`}>Carregando...</div>
        ) : (
          <>
            <Tabela
              titulo="Contas de estação"
              itens={contas}
              ajuda="Login do posto de trabalho, compartilhado por quem estiver ali."
            />
            <Tabela
              titulo="Pessoas"
              itens={gente}
              ajuda="Contas individuais. O operador escolhido ao iniciar a OP vem desta lista."
            />
          </>
        )}
      </div>

      {modal.aberto && (
        <PessoaModal
          pessoa={modal.pessoa}
          onClose={() => setModal({ aberto: false, pessoa: null })}
        />
      )}
    </div>
  );
}

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

  // Ao escolher a estação numa conta nova, o nome e o login saem prontos —
  // são sempre os mesmos e digitar à mão só gera divergência.
  function escolherEtapa(id: string) {
    setEtapaId(id);
    if (!ehEdicao && papel === 'estacao' && id) {
      const etapa = etapas?.find((e) => e.id === id);
      if (etapa) {
        setNome(etapa.nome);
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

    if (!nome.trim()) return setErro('Nome é obrigatório');
    if (!codigoPessoal.trim()) return setErro('Login é obrigatório');
    if (!ehEdicao && pin.trim().length < 4) return setErro('Senha precisa de ao menos 4 caracteres');
    if (pedeEstacao && papel === 'estacao' && !etapaId)
      return setErro('Conta de estação precisa de uma estação');

    try {
      if (ehEdicao && pessoa) {
        await atualizar.mutateAsync({
          id: pessoa.id,
          input: {
            nome: nome.trim(),
            codigoPessoal: codigoPessoal.trim(),
            papel,
            etapaId: pedeEstacao ? etapaId || null : null,
            ativo,
            ...(pin.trim() ? { pin: pin.trim() } : {}),
          },
        });
      } else {
        await criar.mutateAsync({
          nome: nome.trim(),
          codigoPessoal: codigoPessoal.trim(),
          pin: pin.trim(),
          papel,
          etapaId: pedeEstacao ? etapaId || null : null,
        });
      }
      onClose();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao salvar. Tente novamente.');
    }
  }

  const ajuda = claro ? 'text-slate-500' : 'text-neutral-500';

  return (
    <Modal
      open
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar usuário' : 'Novo usuário ou conta de estação'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost px-4 py-2" disabled={loading}>
            Cancelar
          </button>
          <button
            type="submit"
            form="pessoa-form"
            disabled={loading}
            className="px-5 py-2 bg-forja-500 hover:bg-forja-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="pessoa-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Papel *</label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            className="input"
          >
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {PAPEL_LABEL[p]}
              </option>
            ))}
          </select>
          {papel === 'estacao' && (
            <p className={`text-xs mt-1 ${ajuda}`}>
              Login do posto de trabalho. Opera só a estação escolhida abaixo e
              acompanha as demais sem poder alterar nada.
            </p>
          )}
        </div>

        {pedeEstacao && (
          <div>
            <label className="label">
              Estação {papel === 'estacao' ? '*' : '(opcional)'}
            </label>
            <select
              value={etapaId}
              onChange={(e) => escolherEtapa(e.target.value)}
              className="input"
            >
              <option value="">
                {papel === 'estacao' ? 'Selecione...' : 'Sem vínculo — opera todas'}
              </option>
              {etapas?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            {papel === 'programador' && (
              <p className={`text-xs mt-1 ${ajuda}`}>
                Sem vínculo, o programador opera qualquer estação — como era antes.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="label">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder="Ex: Fundição, ou o nome da pessoa"
          />
        </div>

        <div>
          <label className="label">Login *</label>
          <input
            type="text"
            value={codigoPessoal}
            onChange={(e) => setCodigoPessoal(e.target.value)}
            className="input font-mono"
            placeholder="Ex: fundicao, ou 0020"
          />
          <p className={`text-xs mt-1 ${ajuda}`}>
            É o que se digita na tela de login. Letras, números, hífen e underline.
          </p>
        </div>

        <div>
          <label className="label">
            Senha {ehEdicao ? '(deixe vazio para manter)' : '*'}
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input"
            placeholder={ehEdicao ? 'Não alterar' : 'Ao menos 4 caracteres'}
            autoComplete="new-password"
          />
        </div>

        {ehEdicao && (
          <div className="flex items-center gap-3">
            <input
              id="pessoa-ativo"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 accent-forja-500"
            />
            <label htmlFor="pessoa-ativo" className={`text-sm ${ajuda}`}>
              Conta ativa
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
