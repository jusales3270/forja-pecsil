import { useState } from 'react';
import { useContatos, useEnviarMensagem, type Mensagem } from '../hooks/useMensagens';

const botao = 'px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50';
const campo = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100';

// getRandomValues também funciona na intranet HTTP, onde randomUUID pode não existir.
export function novoIdMensagem() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function EditorMensagem({ resposta, onVoltar, onEnviada }: { resposta?: Mensagem; onVoltar: () => void; onEnviada: () => void }) {
  const contatos = useContatos(true);
  const enviar = useEnviarMensagem();
  const [id] = useState(novoIdMensagem);
  const [etapaId, setEtapaId] = useState('');
  const [busca, setBusca] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [corpo, setCorpo] = useState('');
  const [erro, setErro] = useState('');
  const estacao = contatos.data?.estacoes.find(e => e.id === etapaId);
  const pessoas = estacao?.pessoas.filter(p => `${p.nome} ${p.codigoPessoal}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())) ?? [];
  const destinatario = estacao?.pessoas.find(p => p.id === destinatarioId);
  const podeEnviar = !contatos.isError && contatos.data?.podeEnviar && corpo.trim().length > 0 && (!!resposta || !!destinatario);
  return <form className="space-y-4 text-neutral-100" onSubmit={async e => {
    e.preventDefault(); if (!podeEnviar || enviar.isPending) return;
    setErro('');
    try { await enviar.mutateAsync({ id, corpo, ...(resposta ? { respostaAId: resposta.id } : { etapaDestinoId: etapaId, destinatarioId }) }); onEnviada(); }
    catch (err) { setErro((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Não foi possível enviar. Seu texto foi preservado; tente novamente.'); }
  }}>
    <div className="flex items-center gap-3"><button type="button" className={botao} disabled={enviar.isPending} onClick={onVoltar}>Voltar</button><h3 className="font-semibold">{resposta ? 'Responder mensagem' : 'Criar mensagem'}</h3></div>
    {contatos.isPending && <p role="status">Carregando estações e responsáveis…</p>}
    {contatos.isError && <p role="alert">Não foi possível carregar os responsáveis. <button type="button" className={botao} onClick={() => contatos.refetch()}>Tentar novamente</button></p>}
    {contatos.data && !contatos.data.podeEnviar && <p role="alert" className="text-amber-300">Peça ao administrador para vincular sua conta a uma estação ativa antes de enviar mensagens.</p>}
    {resposta ? <div className="border-l-2 border-forja-500 pl-3 text-sm space-y-2">
      <p>Para {resposta.remetenteNome} · {resposta.etapaOrigem.nome}</p>
      <blockquote className="text-neutral-400 whitespace-pre-wrap break-words">{resposta.corpo}</blockquote>
    </div> : <>
      <label className="block text-sm space-y-1"><span>Escolher estação</span>
        <select className={campo} value={etapaId} required disabled={enviar.isPending} onChange={e => { setEtapaId(e.target.value); setDestinatarioId(''); setBusca(''); }}>
          <option value="">Selecione uma estação</option>
          {contatos.data?.estacoes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
      <label className="block text-sm space-y-1"><span>Mencionar responsável</span>
        <input className={campo} value={busca} disabled={!etapaId || enviar.isPending} placeholder="Digite o nome ou login para buscar" onChange={e => { setBusca(e.target.value); setDestinatarioId(''); }} />
      </label>
      {estacao && <div className="max-h-36 overflow-y-auto rounded-lg border border-neutral-700 p-2 space-y-1" role="group" aria-label="Responsáveis da estação">
        {pessoas.length === 0 ? <p className="text-sm text-neutral-400 p-2">Nenhum responsável ativo encontrado nesta estação.</p> : pessoas.map(p => <label key={p.id} className={`flex gap-2 items-center p-2 rounded cursor-pointer text-sm ${destinatarioId === p.id ? 'bg-forja-500/20' : 'hover:bg-neutral-800'}`}>
          <input type="radio" name="responsavel" value={p.id} disabled={enviar.isPending} checked={destinatarioId === p.id} onChange={() => setDestinatarioId(p.id)} />
          <span>{p.nome} <span className="text-neutral-400">({p.codigoPessoal})</span></span>
        </label>)}
      </div>}
      {destinatario && <p className="text-xs text-forja-300">Somente {destinatario.nome}, responsável por {estacao?.nome}, poderá ler e responder este recado. Você terá uma cópia em Enviadas.</p>}
    </>}
    <label className="block text-sm space-y-1"><span>Corpo da mensagem</span>
      <textarea className={`${campo} min-h-32`} required maxLength={4000} disabled={enviar.isPending} value={corpo} onChange={e => setCorpo(e.target.value)} placeholder="Escreva seu recado ou observação…" />
    </label>
    <div className="flex justify-between gap-2 text-xs text-neutral-400"><span>Assinada por {contatos.data?.conta.nome ?? 'sua conta'} · data e hora registradas no envio</span><span>{corpo.length}/4000</span></div>
    {erro && <p role="alert" className="text-red-300 text-sm">{erro}</p>}
    <button type="submit" className={`${botao} bg-forja-600 border-forja-500 w-full`} disabled={!podeEnviar || enviar.isPending}>{enviar.isPending ? 'Enviando…' : resposta ? 'Enviar resposta' : 'Enviar mensagem'}</button>
  </form>;
}
