// ============================================================
// Forja - Desenhos para a Biblioteca da Fundição (Business OS)
// ============================================================
// A plataforma guarda uma cópia de TODOS os desenhos com arquivo (decisão do
// proprietário, 21/10/2026). A Forja só diz, para o selo, se o artigo passa pela
// Fundição: prevista no roteiro (OperacaoArtigo) e realizada pelo carimbo de
// entrada de algum lote na etapa Fundição.
// ============================================================

import { prisma } from '../db/prisma.js';

/** "Fundição", "FUNDICAO", " fundição " → "fundicao". */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export const ehEtapaFundicao = (nome: string) => normalizarNome(nome) === 'fundicao';

export async function idsEtapaFundicao(): Promise<string[]> {
  const etapas = await prisma.etapa.findMany({ select: { id: true, nome: true } });
  return etapas.filter((e) => ehEtapaFundicao(e.nome)).map((e) => e.id);
}

export type FundicaoDoArtigo = { prevista: boolean; primeiraEm: Date | null; ultimaEm: Date | null; os: string[] };

/** Situação da Fundição por artigo (só os artigos pedidos). */
export async function fundicaoPorArtigo(artigoIds: string[]): Promise<Map<string, FundicaoDoArtigo>> {
  const mapa = new Map<string, FundicaoDoArtigo>();
  const etapas = await idsEtapaFundicao();
  if (!etapas.length || !artigoIds.length) return mapa;
  const vazio = (): FundicaoDoArtigo => ({ prevista: false, primeiraEm: null, ultimaEm: null, os: [] });

  const previstas = await prisma.operacaoArtigo.findMany({
    where: { etapaId: { in: etapas }, artigoId: { in: artigoIds } },
    select: { artigoId: true },
    distinct: ['artigoId'],
  });
  for (const p of previstas) mapa.set(p.artigoId, { ...vazio(), prevista: true });

  const realizadas = await prisma.$queryRaw<{ artigo_id: string; primeira: Date; ultima: Date; os: string[] }[]>`
    select o.artigo_id, min(c.timestamp_entrada) as primeira, max(c.timestamp_entrada) as ultima,
           array_agg(distinct o.codigo_grv order by o.codigo_grv) as os
    from carimbos c
    join lotes l on l.id = c.lote_id
    join oses o on o.id = l.os_id
    where c.etapa_id = any(${etapas}::text[]) and o.artigo_id = any(${artigoIds}::text[])
    group by o.artigo_id`;
  for (const r of realizadas) {
    const atual = mapa.get(r.artigo_id) ?? vazio();
    mapa.set(r.artigo_id, { ...atual, primeiraEm: r.primeira, ultimaEm: r.ultima, os: r.os });
  }
  return mapa;
}

/** Todos os desenhos com arquivo, com o artigo, o cliente e a situação da Fundição. */
export async function listarDesenhosParaBiblioteca() {
  const desenhos = await prisma.desenho.findMany({
    where: { arquivoKey: { not: null }, arquivoBucket: { not: null } },
    orderBy: [{ atualizadoEm: 'asc' }, { id: 'asc' }],
    select: {
      id: true, tipo: true, codigoDesenho: true, revisao: true, dataRevisao: true, observacoes: true,
      arquivoKey: true, arquivoTipo: true, arquivoTamanho: true, arquivoNomeOriginal: true, atualizadoEm: true,
      artigo: { select: { id: true, codigo: true, descricao: true, tipoProduto: true, ativo: true, cliente: { select: { id: true, nome: true } } } },
    },
  });
  const fundicao = await fundicaoPorArtigo([...new Set(desenhos.map((d) => d.artigo.id))]);
  return desenhos.map((d) => {
    const f = fundicao.get(d.artigo.id);
    return {
      id: d.id,
      tipo: d.tipo,
      codigoDesenho: d.codigoDesenho,
      revisao: d.revisao,
      dataRevisao: d.dataRevisao,
      observacoes: d.observacoes,
      // A chave muda a cada troca de arquivo: é o sinal para a plataforma baixar de novo.
      arquivoKey: d.arquivoKey,
      arquivoTipo: d.arquivoTipo,
      arquivoTamanho: d.arquivoTamanho,
      arquivoNomeOriginal: d.arquivoNomeOriginal,
      atualizadoEm: d.atualizadoEm,
      artigo: { id: d.artigo.id, codigo: d.artigo.codigo, descricao: d.artigo.descricao, tipoProduto: d.artigo.tipoProduto, ativo: d.artigo.ativo },
      cliente: d.artigo.cliente,
      fundicao: { prevista: f?.prevista ?? false, primeiraEm: f?.primeiraEm ?? null, ultimaEm: f?.ultimaEm ?? null, os: f?.os ?? [] },
    };
  });
}
