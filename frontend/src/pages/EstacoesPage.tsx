// ============================================================
// Forja - Cadastro de Estações e Máquinas (admin)
// ============================================================
// Cada peça segue o roteiro do PCP; a estação é para onde uma operação vai.
// Operação sem estação própria acaba "emprestada" de outra (foi o caso da
// SERRA na Fundição) — aqui se cria a estação certa e suas máquinas.
// ============================================================

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { useTheme } from '../lib/theme-store';
import { useEtapasList, useSalvarEtapa, type Etapa } from '../hooks/useEtapas';
import { useMaquinasList, useSalvarMaquina, TIPOS_MAQUINA, type Maquina } from '../hooks/useMaquinas';

const mensagemErro = (err: any) => err?.response?.data?.message ?? err?.message ?? 'Erro ao salvar. Tente novamente.';

export function EstacoesPage() {
  const { claro } = useTheme();
  const { data: etapas, isLoading, isError } = useEtapasList({ incluirInativas: true });
  const { data: maquinasResp } = useMaquinasList();
  const [editandoEtapa, setEditandoEtapa] = useState<Etapa | 'nova' | null>(null);
  const [editandoMaquina, setEditandoMaquina] = useState<{ maquina: Maquina | null; etapaId: string } | null>(null);

  const maquinasPorEtapa = useMemo(() => {
    const mapa = new Map<string, Maquina[]>();
    for (const m of maquinasResp?.data ?? []) mapa.set(m.etapaId, [...(mapa.get(m.etapaId) ?? []), m]);
    return mapa;
  }, [maquinasResp]);

  const sub = claro ? 'text-slate-500' : 'text-neutral-400';
  const texto = claro ? 'text-slate-900' : 'text-neutral-100';

  return (
    <AppLayout title="Estações e Máquinas" voltarPara="/">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <p className={`text-sm max-w-2xl ${sub}`}>
            A estação recebe as operações que o PCP coloca no roteiro de cada peça, na ordem do roteiro.
            A ordem abaixo só organiza listas e colunas do painel.
          </p>
          <button onClick={() => setEditandoEtapa('nova')} className="btn-primary px-5 py-3 shrink-0">
            + Nova Estação
          </button>
        </div>

        {isLoading && <div className={`card text-center ${sub}`}>Carregando...</div>}
        {isError && <div className="error-message">Não foi possível carregar as estações.</div>}

        <div className="space-y-3">
          {etapas?.map((e) => {
            const maquinas = maquinasPorEtapa.get(e.id) ?? [];
            return (
              <section key={e.id} className={`card ${e.ativa ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${sub}`}>#{e.ordemPadrao}</span>
                      <h2 className={`text-lg font-semibold ${texto}`}>{e.nome}</h2>
                      {!e.ativa && <span className="badge-neutral">Inativa</span>}
                    </div>
                    <p className={`text-xs mt-1 ${sub}`}>
                      SLA {e.slaHoras}h{e.exigeCheckpointQualidade ? ' · exige checkpoint de qualidade' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditandoMaquina({ maquina: null, etapaId: e.id })} className="btn-ghost px-3 py-1.5 text-xs">
                      + Máquina
                    </button>
                    <button onClick={() => setEditandoEtapa(e)} className="btn-ghost px-3 py-1.5 text-xs">
                      Editar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {maquinas.length === 0 && (
                    <p className="text-xs text-amber-400">Sem máquina cadastrada — o tótem desta estação não consegue iniciar OPs.</p>
                  )}
                  {maquinas.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setEditandoMaquina({ maquina: m, etapaId: e.id })}
                      className={`text-left text-xs px-3 py-2 rounded-lg border ${claro ? 'border-slate-200 hover:bg-slate-50' : 'border-neutral-800 hover:bg-neutral-800/50'} ${m.ativa ? '' : 'opacity-50'}`}
                      title="Editar máquina"
                    >
                      <span className={`font-medium ${texto}`}>{m.nome}</span>
                      <span className={`ml-2 font-mono ${sub}`}>{m.codigoInterno}</span>
                      <span className={`ml-2 ${sub}`}>{TIPOS_MAQUINA[m.tipo] ?? m.tipo}</span>
                      {!m.ativa && <span className={`ml-2 ${sub}`}>(inativa)</span>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editandoEtapa && (
        <EtapaModal etapa={editandoEtapa === 'nova' ? null : editandoEtapa} onClose={() => setEditandoEtapa(null)} />
      )}
      {editandoMaquina && etapas && (
        <MaquinaModal
          maquina={editandoMaquina.maquina}
          etapaIdInicial={editandoMaquina.etapaId}
          etapas={etapas}
          onClose={() => setEditandoMaquina(null)}
        />
      )}
    </AppLayout>
  );
}

function EtapaModal({ etapa, onClose }: { etapa: Etapa | null; onClose: () => void }) {
  const salvar = useSalvarEtapa();
  const [nome, setNome] = useState(etapa?.nome ?? '');
  const [ordem, setOrdem] = useState(etapa ? String(etapa.ordemPadrao) : '');
  const [sla, setSla] = useState(String(etapa?.slaHoras ?? 24));
  const [checkpoint, setCheckpoint] = useState(etapa?.exigeCheckpointQualidade ?? false);
  const [ativa, setAtiva] = useState(etapa?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setErro(null), [nome, ordem, sla]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) return setErro('Informe o nome da estação');
    const ordemNum = ordem.trim() ? parseInt(ordem, 10) : undefined;
    if (ordemNum !== undefined && (isNaN(ordemNum) || ordemNum < 1)) return setErro('Ordem deve ser um número inteiro positivo');
    const slaNum = parseInt(sla, 10);
    if (isNaN(slaNum) || slaNum < 0) return setErro('SLA deve ser um número de horas');
    try {
      await salvar.mutateAsync({
        id: etapa?.id,
        input: { nome: nome.trim(), ordemPadrao: ordemNum, slaHoras: slaNum, exigeCheckpointQualidade: checkpoint, ativa },
      });
      onClose();
    } catch (err) {
      setErro(mensagemErro(err));
    }
  };

  return (
    <Modal
      open
      onClose={salvar.isPending ? () => {} : onClose}
      title={etapa ? 'Editar Estação' : 'Nova Estação'}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={salvar.isPending} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" form="etapa-form" disabled={salvar.isPending} className="btn-primary px-4 py-2 text-sm">
            {salvar.isPending ? 'Salvando...' : etapa ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="etapa-form" onSubmit={enviar} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Serra" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ordem nas listas</label>
            <input type="number" min="1" className="input" value={ordem} onChange={(e) => setOrdem(e.target.value)} placeholder={etapa ? '' : 'No fim'} />
          </div>
          <div>
            <label className="label">SLA (horas)</label>
            <input type="number" min="0" className="input" value={sla} onChange={(e) => setSla(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={checkpoint} onChange={(e) => setCheckpoint(e.target.checked)} className="w-4 h-4 accent-forja-500" />
          Exige checkpoint de qualidade
        </label>
        {etapa && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="w-4 h-4 accent-forja-500" />
            Ativa (aparece no tótem e nos cadastros)
          </label>
        )}
      </form>
    </Modal>
  );
}

function MaquinaModal({ maquina, etapaIdInicial, etapas, onClose }: {
  maquina: Maquina | null; etapaIdInicial: string; etapas: Etapa[]; onClose: () => void;
}) {
  const salvar = useSalvarMaquina();
  const [nome, setNome] = useState(maquina?.nome ?? '');
  const [codigo, setCodigo] = useState(maquina?.codigoInterno ?? '');
  const [tipo, setTipo] = useState(maquina?.tipo ?? 'outros');
  const [etapaId, setEtapaId] = useState(maquina?.etapaId ?? etapaIdInicial);
  const [ativa, setAtiva] = useState(maquina?.ativa ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) return setErro('Informe o nome da máquina');
    if (!codigo.trim()) return setErro('Informe o código interno');
    try {
      await salvar.mutateAsync({
        id: maquina?.id,
        input: { nome: nome.trim(), codigoInterno: codigo.trim(), tipo, etapaId, ativa },
      });
      onClose();
    } catch (err) {
      setErro(mensagemErro(err));
    }
  };

  return (
    <Modal
      open
      onClose={salvar.isPending ? () => {} : onClose}
      title={maquina ? 'Editar Máquina' : 'Nova Máquina'}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={salvar.isPending} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" form="maquina-form" disabled={salvar.isPending} className="btn-primary px-4 py-2 text-sm">
            {salvar.isPending ? 'Salvando...' : maquina ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="maquina-form" onSubmit={enviar} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Serra de fita" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Código interno *</label>
            <input className="input font-mono" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: SERRA-01" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_MAQUINA).map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Estação</label>
          <select className="input" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.ativa ? '' : ' (inativa)'}</option>)}
          </select>
        </div>
        {maquina && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="w-4 h-4 accent-forja-500" />
            Ativa
          </label>
        )}
      </form>
    </Modal>
  );
}
