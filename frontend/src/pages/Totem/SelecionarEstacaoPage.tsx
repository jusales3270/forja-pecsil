// ============================================================
// Forja - Tótem: Seleção de Estação
// Programador escolhe em qual etapa/estação vai trabalhar
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useEtapasList } from '../../hooks/useEtapas';
import { useAuth } from '../../lib/auth-store';
import { temCapacidade, type Papel } from '../../lib/permissions';

export function SelecionarEstacaoPage() {
  const navigate = useNavigate();
  const pessoa = useAuth((s) => s.pessoa);
  const logout = useAuth((s) => s.logout);
  const { data, isLoading, isError } = useEtapasList();
  const etapas = data ?? [];

  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtradas = etapas.filter((e) =>
    e.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIndice(0);
  }, [busca]);

  function selecionar(etapaId: string) {
    navigate(`/totem/${etapaId}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[indice]) selecionar(filtradas[indice].id);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {temCapacidade(pessoa?.papel as Papel | undefined, 'backoffice_acessar') && (
          <button
            onClick={() => navigate('/')}
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors mb-3 flex items-center gap-1"
          >
            <span className="text-base leading-none">←</span> Voltar para o início
          </button>
        )}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-forja-50">Tótem</h1>
            <p className="text-neutral-400 mt-2 text-lg">
              Olá, <span className="text-forja-400 font-medium">{pessoa?.nome}</span>.
              Escolha a estação onde você está trabalhando.
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-lg"
          >
            Sair
          </button>
        </div>

        <div className="mb-6">
          <input
            ref={inputRef}
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar estação..."
            className="w-full px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-xl text-xl focus:border-forja-500 focus:outline-none"
          />
          <p className="text-xs text-neutral-500 mt-2">
            Use ↑ ↓ pra navegar, Enter pra selecionar
          </p>
        </div>

        {isLoading && (
          <div className="p-12 text-center text-neutral-400">Carregando estações...</div>
        )}
        {isError && (
          <div className="p-12 text-center text-red-400">
            Erro ao carregar estações.
          </div>
        )}
        {!isLoading && !isError && filtradas.length === 0 && (
          <div className="p-12 text-center text-neutral-400">
            Nenhuma estação encontrada.
          </div>
        )}

        <div className="space-y-2">
          {filtradas.map((etapa, idx) => (
            <button
              key={etapa.id}
              onClick={() => selecionar(etapa.id)}
              onMouseEnter={() => setIndice(idx)}
              className={`w-full text-left px-6 py-4 rounded-xl border transition ${
                idx === indice
                  ? 'bg-forja-500/10 border-forja-500 text-forja-50'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold">{etapa.nome}</div>
                  <div className="text-sm text-neutral-500 mt-1">
                    Ordem {etapa.ordemPadrao} · SLA {etapa.slaHoras}h
                  </div>
                </div>
                <div className="text-2xl text-neutral-600">→</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
