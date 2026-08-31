// ============================================================
// Forja - Detalhe do aviso da produção
// ============================================================
// O aviso de "entrou no tratamento térmico" só serve se a engenharia
// conseguir agir sem sair da tela. Aqui está tudo que ela precisa pra montar
// o programa: o artigo, o desenho, quantas peças, pra quando, e — o que mais
// importa — QUAIS operações vêm depois desta no roteiro.
// ============================================================

import { useState } from 'react';
import { Modal } from './Modal';
import { VisualizadorDesenhoModal } from './VisualizadorDesenhoModal';
import { tempoRelativo, type Aviso } from '../hooks/useAvisos';

interface Props {
  aviso: Aviso;
  onClose: () => void;
  onMarcarLido: () => void;
}

/** Dias até o prazo, com a mesma leitura de semáforo do painel. */
function prazo(iso: string) {
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const cor = dias < 0 || dias < 3 ? 'text-red-400' : dias < 7 ? 'text-amber-400' : 'text-emerald-400';
  const texto =
    dias < 0 ? `${Math.abs(dias)} dia(s) ATRASADA` : dias === 0 ? 'vence hoje' : `em ${dias} dia(s)`;
  return { cor, texto, data: new Date(iso).toLocaleDateString('pt-BR') };
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-neutral-800 last:border-0">
      <span className="text-xs uppercase tracking-wide text-neutral-500 w-32 shrink-0">
        {rotulo}
      </span>
      <span className="text-sm text-neutral-100 min-w-0">{children}</span>
    </div>
  );
}

export function AvisoDetalheModal({ aviso, onClose, onMarcarLido }: Props) {
  const [verDesenhos, setVerDesenhos] = useState(false);
  const op = aviso.opLote;

  if (!op) {
    return (
      <Modal open onClose={onClose} title="Aviso da produção" size="md">
        <p className="text-sm text-neutral-300">{aviso.mensagem}</p>
      </Modal>
    );
  }

  const os = op.lote.os;
  const artigo = os.artigo;
  const p = prazo(os.prazoEntrega);
  const desenhos = artigo.desenhos ?? [];
  const comArquivo = desenhos.filter((d) => d.arquivoKey);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${os.codigoGrv} — o que programar`}
        size="lg"
        footer={
          <>
            <button onClick={onClose} className="btn-ghost px-4 py-2">
              Fechar
            </button>
            <button
              onClick={() => {
                onMarcarLido();
                onClose();
              }}
              className="px-5 py-2 bg-forja-500 hover:bg-forja-600 text-white rounded-lg font-medium transition"
            >
              Marcar como lido
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* O que aconteceu */}
          <div className="p-3 rounded-lg border border-forja-500/30 bg-forja-500/5">
            <div className="text-[10px] uppercase tracking-wide text-forja-400 font-semibold mb-1">
              {op.etapaAvisada ? `Para ${op.etapaAvisada.nome}` : 'Produção'} ·{' '}
              {tempoRelativo(aviso.criadoEm)}
            </div>
            <p className="text-sm text-neutral-100 leading-snug">{aviso.mensagem}</p>
            {op.iniciadaEm && (
              <p className="text-xs text-neutral-400 mt-1.5">
                {op.tipoServico} começou {tempoRelativo(op.iniciadaEm)}
                {op.esperaHoras != null && ` · ciclo de ${op.esperaHoras}h`}
              </p>
            )}
          </div>

          {/* A peça */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              A peça
            </h3>
            <div className="subcard p-3">
              <Linha rotulo="Artigo">
                <span className="font-mono font-semibold text-forja-400">
                  {artigo.codigo}
                </span>
              </Linha>
              <Linha rotulo="Descrição">{artigo.descricao}</Linha>
              <Linha rotulo="Tipo">{artigo.tipoProduto}</Linha>
              {artigo.material && <Linha rotulo="Material">{artigo.material}</Linha>}
              <Linha rotulo="Cliente">{os.cliente.nome}</Linha>
            </div>
          </section>

          {/* Quanto e para quando */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Quanto e para quando
            </h3>
            <div className="subcard p-3">
              <Linha rotulo="Chegando">
                <span className="font-semibold text-forja-400">
                  {op.pecasNaOperacao} peça(s)
                </span>
                {op.pecasNaOperacao !== op.lote.quantidadePecas && (
                  <span className="text-neutral-400">
                    {' '}
                    de um lote de {op.lote.quantidadePecas} — o resto vem depois
                  </span>
                )}
              </Linha>
              <Linha rotulo="Lote">
                {op.lote.numeroLote} · OS total de {os.quantidadeTotal} peça(s)
              </Linha>
              <Linha rotulo="Prazo da OS">
                <span className={p.cor}>
                  {p.data} ({p.texto})
                </span>
              </Linha>
              {os.prioridade === 'urgente' && (
                <Linha rotulo="Prioridade">
                  <span className="text-red-400 font-semibold uppercase">urgente</span>
                </Linha>
              )}
            </div>
          </section>

          {/* O programa a fazer */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              O que vem depois — o programa a montar
            </h3>
            {op.proximasOperacoes.length === 0 ? (
              <div className="subcard p-3 text-sm text-neutral-400">
                Esta é a última operação do roteiro deste lote.
              </div>
            ) : (
              <div className="subcard p-3 space-y-1.5">
                {op.proximasOperacoes.map((prox, i) => (
                  <div
                    key={prox.id}
                    className="flex items-start gap-3 py-1.5 border-b border-neutral-800 last:border-0"
                  >
                    <span className="text-xs text-neutral-600 font-mono w-6 shrink-0 pt-0.5">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-neutral-100 font-medium">
                          {prox.tipoServico}
                        </span>
                        <span className="text-[10px] uppercase text-neutral-500">
                          {prox.etapa.nome}
                        </span>
                        {prox.terceirizada && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            🚚 fora
                          </span>
                        )}
                        {prox.esperaHoras != null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            ⏳ {prox.esperaHoras}h
                          </span>
                        )}
                      </div>
                      {prox.observacoes && (
                        <p className="text-xs text-neutral-400 mt-0.5 whitespace-pre-line">
                          {prox.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Desenho */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Desenho técnico
            </h3>
            {desenhos.length === 0 ? (
              <div className="subcard p-3 text-sm text-amber-400">
                ⚠ Nenhum desenho cadastrado para este artigo.
              </div>
            ) : (
              <button
                onClick={() => setVerDesenhos(true)}
                className="w-full subcard p-3 text-left hover:border-forja-600 transition flex items-center justify-between gap-3"
              >
                <span className="text-sm text-neutral-200">
                  📐 {desenhos.length} desenho(s)
                  {comArquivo.length > 0
                    ? ` · ${comArquivo.length} com arquivo`
                    : ' · nenhum arquivo anexado'}
                </span>
                <span className="text-xs text-forja-400 shrink-0">abrir ↗</span>
              </button>
            )}
          </section>

          {/* Observações herdadas */}
          {(os.observacoes ||
            artigo.observacoes ||
            op.lote.observacoes ||
            op.observacoes) && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                Observações
              </h3>
              <div className="subcard p-3 space-y-2">
                {[
                  { r: 'OS', t: os.observacoes },
                  { r: 'Artigo', t: artigo.observacoes },
                  { r: 'Lote', t: op.lote.observacoes },
                  { r: 'Operação', t: op.observacoes },
                ]
                  .filter((x) => x.t && x.t.trim())
                  .map((x) => (
                    <div key={x.r}>
                      <div className="text-[10px] uppercase text-neutral-500">{x.r}</div>
                      <p className="text-xs text-neutral-200 whitespace-pre-line">{x.t}</p>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </Modal>

      {verDesenhos && (
        <VisualizadorDesenhoModal
          open
          artigo={{ id: artigo.id, codigo: artigo.codigo, descricao: artigo.descricao }}
          desenhos={desenhos}
          onClose={() => setVerDesenhos(false)}
        />
      )}
    </>
  );
}
