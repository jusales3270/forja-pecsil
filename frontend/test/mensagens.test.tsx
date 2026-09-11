import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: { href: '' } } });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { style: { overflow: '' } } } });
const { useAuth } = await import('../src/lib/auth-store');
const { api } = await import('../src/lib/api');
const { PainelAvisos } = await import('../src/components/PainelAvisos');
const { novoIdMensagem } = await import('../src/components/EditorMensagem');
const { useMensagens } = await import('../src/hooks/useMensagens');

const texto = (node: ReactTestInstance): string => node.children.map(c => typeof c === 'string' ? c : texto(c)).join('');
const flush = () => new Promise(resolve => setTimeout(resolve, 20));

test('formulário seleciona destinatário, preserva erro, envia com assinatura e permite resposta', async () => {
  const originalAdapter = api.defaults.adapter;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const posts: any[] = []; const messages: any[] = [];
  let failSend = true;
  const gui = { id: 'gui', nome: 'Guilherme', papel: 'programador' as const, ativo: true, etapaId: 'eng' };
  const pedro = { id: 'pedro', nome: 'Pedro', papel: 'programador' as const, ativo: true, etapaId: 'desb' };
  const entrar = (p: typeof gui, token: string) => {
    storage.set('forja_token', token);
    useAuth.setState({ pessoa: p, token, isAuthenticated: true });
  };
  api.defaults.adapter = async config => {
    const p = config.headers.Authorization === 'Bearer gui-token' ? gui : pedro;
    let data: any;
    if (config.url === '/avisos') data = { data: [] };
    else if (config.url === '/mensagens/contatos') data = { data: {
      conta: { ...p, etapa: { id: p.etapaId, nome: p.etapaId, ativa: true } }, podeEnviar: true,
      estacoes: [{ id: 'eng', nome: 'Engenharia', pessoas: [{ id: 'gui', nome: 'Guilherme', codigoPessoal: 'GUI' }] },
        { id: 'desb', nome: 'Desbaste', pessoas: [{ id: 'pedro', nome: 'Pedro', codigoPessoal: 'PEDRO' }, { id: 'outro', nome: 'Outro', codigoPessoal: 'OUTRO' }] }],
    } };
    else if (config.method === 'get' && config.url === '/mensagens') {
      const caixa = config.params.caixa;
      data = { data: messages.filter(m => caixa === 'enviadas' ? m.remetenteId === p.id : m.destinatarioId === p.id),
        meta: { total: messages.length, naoLidas: messages.filter(m => m.destinatarioId === p.id && !m.lidoEm).length, pagina: 1, paginas: 1 } };
    } else if (config.method === 'post') {
      const body = JSON.parse(config.data); posts.push({ body, url: config.url, token: config.headers.Authorization });
      if (failSend) { failSend = false; throw Object.assign(new Error('falha simulada'), { response: { status: 503, data: { message: 'Falha temporária de teste' } } }); }
      const resposta = config.url?.includes('/responder');
      const m = { id: body.id, corpo: body.corpo, remetenteId: p.id, remetenteNome: p.nome,
        destinatarioId: resposta ? gui.id : body.destinatarioId, destinatarioNome: resposta ? 'Guilherme' : 'Pedro',
        etapaOrigem: { id: p.etapaId, nome: p.etapaId === 'eng' ? 'Engenharia' : 'Desbaste' },
        etapaDestino: { id: resposta ? 'eng' : 'desb', nome: resposta ? 'Engenharia' : 'Desbaste' },
        criadoEm: '2026-09-11T15:30:00Z', lidoEm: null, respostaAId: resposta ? messages[0].id : null };
      messages.push(m); data = { data: m };
    } else if (config.method === 'patch') {
      messages[0].lidoEm = '2026-09-11T15:31:00Z'; data = { data: messages[0] };
    } else throw new Error(`Requisição inesperada: ${config.url}`);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  let ui: ReactTestRenderer | undefined;
  const button = (label: string) => ui!.root.findAllByType('button').find(b => texto(b) === label)!;
  const click = async (label: string) => { assert.ok(button(label), label); await act(async () => { button(label).props.onClick(); await flush(); }); };
  try {
    entrar(gui, 'gui-token');
    await act(async () => { ui = create(<QueryClientProvider client={qc}><PainelAvisos /></QueryClientProvider>); await flush(); });
    await act(async () => { ui!.root.findAllByType('button').find(b => b.props.title === 'Mensagens e avisos')!.props.onClick(); await flush(); });
    await click('Mensagens enviadas'); await click('Criar mensagem');
    await act(async () => { ui!.root.findByType('select').props.onChange({ target: { value: 'desb' } }); await flush(); });
    await act(async () => { ui!.root.findByProps({ placeholder: 'Digite o nome ou login para buscar' }).props.onChange({ target: { value: 'Pedro' } }); await flush(); });
    assert.equal(ui!.root.findAllByProps({ type: 'radio' }).length, 1);
    await act(async () => { ui!.root.findByProps({ type: 'radio' }).props.onChange(); await flush(); });
    await act(async () => { ui!.root.findByType('textarea').props.onChange({ target: { value: 'Prioridade pedida pelo Domingo.' } }); await flush(); });
    assert.equal(button('Enviar mensagem').props.disabled, false);
    const submit = async () => act(async () => { await ui!.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
    await submit();
    assert.match(texto(ui!.root), /Falha temporária de teste/);
    assert.equal(ui!.root.findByType('textarea').props.value, 'Prioridade pedida pelo Domingo.');
    await submit();
    assert.equal(posts[0].body.id, posts[1].body.id, 'Repetir usa o mesmo ID');
    assert.deepEqual(Object.keys(posts[1].body).sort(), ['corpo', 'destinatarioId', 'etapaDestinoId', 'id']);
    assert.equal(posts[1].body.destinatarioId, 'pedro'); assert.equal(posts[1].body.etapaDestinoId, 'desb');
    assert.match(texto(ui!.root), /Mensagem enviada/);
    assert.match(texto(ui!.root), /Guilherme/); assert.match(texto(ui!.root), /11\/09\/2026/);
    await act(async () => { entrar(pedro, 'pedro-token'); await flush(); });
    assert.equal(ui!.root.findAllByProps({ role: 'dialog' }).length, 0, 'Trocar credencial fecha a caixa anterior');
    await act(async () => { ui!.root.findAllByType('button').find(b => b.props.title === 'Mensagens e avisos')!.props.onClick(); await flush(); });
    assert.match(texto(ui!.root), /Prioridade pedida pelo Domingo/);
    await click('Marcar como lida');
    assert.equal(ui!.root.findAllByType('button').some(b => texto(b) === 'Marcar como lida'), false);
    await click('Responder');
    assert.equal(ui!.root.findAllByType('select').length, 0, 'Resposta não permite trocar o destinatário');
    await act(async () => { ui!.root.findByType('textarea').props.onChange({ target: { value: 'Vou priorizar.' } }); await flush(); });
    await submit();
    assert.match(posts[2].url, /\/responder$/);
    assert.equal(posts[2].token, 'Bearer pedro-token');
    assert.deepEqual(Object.keys(posts[2].body).sort(), ['corpo', 'id']);
    assert.match(texto(ui!.root), /Para Guilherme/);
  } finally {
    await act(async () => ui?.unmount()); qc.clear(); api.defaults.adapter = originalAdapter;
    useAuth.setState({ pessoa: null, token: null, isAuthenticated: false });
  }
});

test('cache de recados não atravessa contas nem sessões', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const pessoa = { id: 'gui', nome: 'Guilherme', papel: 'programador' as const, ativo: true, etapaId: 'eng' };
  function Caixa() { const { data } = useMensagens('recebidas', 1, false); return <p>{data?.data.map(m => m.corpo).join(' ') ?? 'sem cache'}</p>; }
  let ui: ReactTestRenderer | undefined;
  try {
    qc.setQueryData(['mensagens', 'gui', 'sessao-1', 'recebidas', 1], { data: [{ corpo: 'SEGREDO GUI' }] });
    useAuth.setState({ pessoa, token: 'sessao-1', isAuthenticated: true });
    await act(async () => { ui = create(<QueryClientProvider client={qc}><Caixa /></QueryClientProvider>); });
    assert.match(texto(ui!.root), /SEGREDO GUI/);
    await act(async () => { useAuth.setState({ pessoa: { ...pessoa, id: 'pedro' }, token: 'sessao-2' }); });
    assert.doesNotMatch(texto(ui!.root), /SEGREDO GUI/);
    await act(async () => { useAuth.setState({ pessoa, token: 'sessao-nova' }); });
    assert.doesNotMatch(texto(ui!.root), /SEGREDO GUI/);
  } finally { await act(async () => ui?.unmount()); qc.clear(); useAuth.setState({ pessoa: null, token: null, isAuthenticated: false }); }
});

test('ID da mensagem funciona sem crypto.randomUUID na intranet HTTP', () => {
  assert.match(novoIdMensagem(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('avisos automáticos fixam a credencial da consulta mesmo se o storage já mudou', async () => {
  const { useAvisos } = await import('../src/hooks/useAvisos');
  const originalAdapter = api.defaults.adapter;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let authorization: unknown; let ui: ReactTestRenderer | undefined;
  api.defaults.adapter = async config => {
    authorization = config.headers.Authorization;
    return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config };
  };
  function Avisos() { useAvisos(); return null; }
  try {
    useAuth.setState({ pessoa: { id: 'gui', nome: 'Gui', papel: 'programador', ativo: true, etapaId: 'eng' }, token: 'sessao-anterior', isAuthenticated: true });
    storage.set('forja_token', 'sessao-nova');
    await act(async () => { ui = create(<QueryClientProvider client={qc}><Avisos /></QueryClientProvider>); await flush(); });
    assert.equal(authorization, 'Bearer sessao-anterior');
  } finally {
    await act(async () => ui?.unmount()); qc.clear(); api.defaults.adapter = originalAdapter; storage.clear();
    useAuth.setState({ pessoa: null, token: null, isAuthenticated: false });
  }
});


test('resposta 401 atrasada e autenticação explícita não atingem a nova sessão', async () => {
  const originalAdapter = api.defaults.adapter;
  storage.set('forja_token', 'sessao-nova');
  window.location.href = '';
  api.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, 'Bearer sessao-antiga');
    throw Object.assign(new Error('Token antigo expirou'), { config, response: { status: 401 } });
  };
  try {
    await assert.rejects(api.get('/mensagens', { headers: { Authorization: 'Bearer sessao-antiga' } }));
    assert.equal(storage.get('forja_token'), 'sessao-nova');
    assert.equal(window.location.href, '');
  } finally { api.defaults.adapter = originalAdapter; storage.clear(); }
});
