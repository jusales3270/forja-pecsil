import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { useAuth } = await import('../src/lib/auth-store');
const { PainelAvisos } = await import('../src/components/PainelAvisos');
const { useAvisos } = await import('../src/hooks/useAvisos');

test('sino privado acompanha a credencial, não a estação observada', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const render = (etapaId: string) => {
    // Fornece ao snapshot de SSR a credencial já hidratada de cada cenário.
    Object.assign(useAuth.getInitialState(), useAuth.getState());
    return renderToStaticMarkup(
      <QueryClientProvider client={qc}><PainelAvisos etapaId={etapaId} /></QueryClientProvider>,
    );
  };
  useAuth.setState({ isAuthenticated: true, token: 'sessao-desbaste', pessoa: {
    id: 'desbaste-user', nome: 'Desbaste', papel: 'estacao', ativo: true, etapaId: 'desbaste',
  } });
  assert.equal(render('engenharia'), '', 'Observar engenharia não deve montar sino, mensagens ou ações.');
  assert.match(render('desbaste'), /Avisos da produção/);

  useAuth.setState({ token: 'sessao-engenharia', pessoa: {
    id: 'engenharia-user', nome: 'Engenharia', papel: 'estacao', ativo: true, etapaId: 'engenharia',
  } });
  assert.match(render('engenharia'), /Avisos da produção/);
  assert.equal(render('desbaste'), '');

  for (const papel of ['admin', 'pcp', 'programador'] as const) {
    useAuth.setState({ pessoa: { id: papel, nome: papel, papel, ativo: true, etapaId: null } });
    assert.equal(render('engenharia'), '', 'Papéis sem vínculo não recebem exceção.');
  }
  useAuth.setState({ isAuthenticated: false, pessoa: null, token: null });
  assert.equal(render('engenharia'), '');
  qc.clear();
});

test('trocar a credencial não reutiliza o cache de mensagens pessoais da sessão anterior', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Conteudo() {
    const { data } = useAvisos('engenharia');
    return <span>{data?.map(a => a.mensagem).join(',') ?? 'sem cache'}</span>;
  }
  const render = () => {
    Object.assign(useAuth.getInitialState(), useAuth.getState());
    return renderToStaticMarkup(<QueryClientProvider client={qc}><Conteudo /></QueryClientProvider>);
  };
  const pessoa = { id: 'eng-1', nome: 'Engenharia 1', papel: 'estacao' as const, ativo: true, etapaId: 'engenharia' };
  useAuth.setState({ isAuthenticated: true, pessoa, token: 'sessao-1' });
  qc.setQueryData(['avisos', pessoa.id, pessoa.etapaId, 'sessao-1', 'engenharia'], [{ mensagem: 'PRIVADO ENG-1' }]);
  assert.match(render(), /PRIVADO ENG-1/);
  useAuth.setState({ pessoa: { ...pessoa, id: 'eng-2' }, token: 'sessao-2' });
  assert.doesNotMatch(render(), /PRIVADO ENG-1/);
  useAuth.setState({ pessoa, token: 'nova-sessao-1' });
  assert.doesNotMatch(render(), /PRIVADO ENG-1/);
  qc.clear();
  useAuth.setState({ isAuthenticated: false, pessoa: null, token: null });
});
