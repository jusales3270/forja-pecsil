import { useState } from 'react';
import { useAuth } from '../lib/auth-store';
import { Modal } from './Modal';
import { AvisoDetalheModal } from './AvisoDetalheModal';
import { useAvisos, useMarcarAvisoLido, useMarcarTodosLidos, type Aviso } from '../hooks/useAvisos';
import { useMensagens, useContatos, useLerMensagem, type Mensagem } from '../hooks/useMensagens';
import { EditorMensagem } from './EditorMensagem';

export const dataHora = (data: string) => new Date(data).toLocaleString('pt-BR');
export const erroTexto = (err: unknown) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  || 'Não foi possível concluir. Tente novamente.';
export const botaoMensagem = 'px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50';
const botao = botaoMensagem;

/** O sino acompanha a conta em qualquer estação observada. A API decide o acesso. */
export function PainelAvisos() {
  const { pessoa, token, isAuthenticated } = useAuth();
  if (!isAuthenticated || !pessoa) return null;
  return <PainelDaConta key={`${pessoa.id}:${pessoa.etapaId}:${token}`} />;
}

function PainelDaConta() {
  const [aberto, setAberto] = useState(false);
  const [caixa, setCaixa] = useState<'recebidas' | 'enviadas'>('recebidas');
  const [pagina, setPagina] = useState(1);
  const [editor, setEditor] = useState<{ resposta?: Mensagem } | null>(null);
  const [detalhe, setDetalhe] = useState<Aviso | null>(null);
  const [feedback, setFeedback] = useState('');
  const recebidas = useMensagens('recebidas', caixa === 'recebidas' ? pagina : 1);
  const enviadas = useMensagens('enviadas', pagina, aberto && caixa === 'enviadas');
  const consulta = caixa === 'recebidas' ? recebidas : enviadas;
  const contatos = useContatos(aberto);
  const avisos = useAvisos();
  const marcarAviso = useMarcarAvisoLido();
  const marcarTodosAvisos = useMarcarTodosLidos();
  const ler = useLerMensagem();
  const mensagens = consulta.isError ? undefined : consulta.data;
  const alertas = avisos.isError ? [] : avisos.data ?? [];
  const total = (recebidas.isError ? 0 : recebidas.data?.meta.naoLidas ?? 0) + alertas.length;
  const erroLeitura = ler.error || marcarAviso.error || marcarTodosAvisos.error;
  const trocarCaixa = (valor: typeof caixa) => { setCaixa(valor); setPagina(1); setFeedback(''); };
  return <>
    <button type="button" title="Mensagens e avisos" aria-label={`Mensagens e avisos${total ? `, ${total} não lidos` : ''}`}
      onClick={() => { setAberto(true); setFeedback(''); }}
      className={`relative px-3 py-2 rounded-lg border text-lg ${total ? 'border-forja-500 bg-forja-500/10 text-forja-300' : 'border-neutral-700 text-neutral-300'}`}>
      <span aria-hidden="true">🔔</span>
      {total > 0 && <span className="absolute -top-2 -right-2 rounded-full bg-forja-500 text-white text-xs px-1.5">{total}</span>}
      {(recebidas.isError || avisos.isError) && <span className="absolute -top-2 -right-2 rounded-full bg-amber-600 text-xs px-1.5" title="Falha ao atualizar mensagens">!</span>}
    </button>
    <Modal open={aberto} onClose={() => { setAberto(false); setEditor(null); }} title="Mensagens e avisos" size="lg" forcarEscuro>
      {editor ? <EditorMensagem resposta={editor.resposta} onVoltar={() => setEditor(null)} onEnviada={() => {
        setEditor(null); setCaixa('enviadas'); setPagina(1); setFeedback('Mensagem enviada.');
      }} /> : <div className="space-y-4 text-neutral-100">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Caixas de mensagens">
          <button className={`${botao} ${caixa === 'recebidas' ? 'bg-neutral-800 border-forja-500' : ''}`} aria-pressed={caixa === 'recebidas'} onClick={() => trocarCaixa('recebidas')}>Mensagens recebidas</button>
          <button className={`${botao} ${caixa === 'enviadas' ? 'bg-neutral-800 border-forja-500' : ''}`} aria-pressed={caixa === 'enviadas'} onClick={() => trocarCaixa('enviadas')}>Mensagens enviadas</button>
          <button className={`${botao} bg-forja-600 border-forja-500`} onClick={() => setEditor({})}>Criar mensagem</button>
        </div>
        <p className="text-xs text-neutral-400">Seus recados são pessoais. Os avisos automáticos pertencem à estação da sua conta.</p>
        {contatos.data && !contatos.data.podeEnviar && <p className="text-sm text-amber-300">Sua conta precisa estar vinculada a uma estação ativa para enviar e receber recados.</p>}
        {feedback && <p role="status" className="text-sm text-emerald-300">{feedback}</p>}
        {erroLeitura && <p role="alert" className="text-sm text-red-300">{erroTexto(erroLeitura)}</p>}
        {consulta.isError ? <div role="alert">Não foi possível carregar as mensagens. <button className={botao} onClick={() => consulta.refetch()}>Tentar novamente</button></div>
          : consulta.isPending ? <p role="status">Carregando mensagens…</p>
          : <>
            {mensagens?.data.length === 0 && <p className="py-5 text-center text-neutral-400">{caixa === 'recebidas' ? 'Nenhuma mensagem recebida.' : 'Nenhuma mensagem enviada.'}</p>}
            {mensagens?.data.map(m => <article key={m.id} className="rounded-xl border border-neutral-700 bg-neutral-950/50 p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-neutral-400">
                <span>{caixa === 'recebidas' ? `De ${m.remetenteNome} · ${m.etapaOrigem.nome}` : `Para ${m.destinatarioNome} · ${m.etapaDestino.nome}`}</span>
                <span>{m.lidoEm ? `Lida em ${dataHora(m.lidoEm)}` : 'Não lida'}</span>
              </div>
              {m.respostaAId && <p className="text-xs text-forja-300">Resposta a um recado</p>}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.corpo}</p>
              <p className="text-xs text-neutral-400">{m.remetenteNome} · {dataHora(m.criadoEm)}</p>
              {caixa === 'recebidas' && <div className="flex gap-2">
                {!m.lidoEm && <button className={botao} disabled={ler.isPending} onClick={() => ler.mutate(m.id)}>Marcar como lida</button>}
                <button className={botao} onClick={() => setEditor({ resposta: m })}>Responder</button>
              </div>}
            </article>)}
            {(mensagens?.meta.paginas ?? 1) > 1 && <div className="flex justify-between items-center gap-2 text-sm">
              <button className={botao} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <span>Página {pagina} de {mensagens?.meta.paginas}</span>
              <button className={botao} disabled={pagina >= (mensagens?.meta.paginas ?? 1)} onClick={() => setPagina(p => p + 1)}>Próxima</button>
            </div>}
          </>}
        {caixa === 'recebidas' && <section className="border-t border-neutral-700 pt-4 space-y-3" aria-label="Avisos automáticos da estação">
          <h3 className="font-semibold">Avisos automáticos da estação</h3>
          {alertas.length > 0 && <button className={botao} disabled={marcarTodosAvisos.isPending} onClick={() => marcarTodosAvisos.mutate(undefined)}>Marcar avisos da estação como lidos</button>}
          {avisos.isError ? <p role="alert">Não foi possível carregar os avisos.</p> : avisos.isPending ? <p>Carregando avisos…</p> : alertas.length === 0 ? <p className="text-sm text-neutral-400">Nenhum aviso novo.</p> : alertas.map(a => <article key={a.id} className="border border-neutral-700 rounded-xl p-4 space-y-2">
            <p className="text-sm whitespace-pre-wrap break-words">{a.mensagem}</p>
            <p className="text-xs text-neutral-400">Sistema · {dataHora(a.criadoEm)}</p>
            <div className="flex gap-2">
              {a.opLote && <button className={botao} onClick={() => { setDetalhe(a); setAberto(false); }}>Ver detalhes da operação</button>}
              <button className={botao} disabled={marcarAviso.isPending} onClick={() => marcarAviso.mutate(a.id)}>Marcar como lido</button>
            </div>
          </article>)}
        </section>}
      </div>}
    </Modal>
    {detalhe && !avisos.isError && <AvisoDetalheModal aviso={detalhe} onClose={() => { setDetalhe(null); setAberto(true); }} onMarcarLido={() => marcarAviso.mutate(detalhe.id)} />}
  </>;
}
