// ============================================================
// Forja - Tipos compartilhados v2.0
// Sincronizado com backend/prisma/schema.prisma v2
// ============================================================

// ===========================
// ENUMS
// ===========================

export type Papel =
  | 'admin'
  | 'chefe'
  | 'pcp'
  | 'engenharia'
  | 'programador'
  | 'operador'
  | 'inspetor'
  | 'embalador'
  /** Conta compartilhada de um posto de trabalho. */
  | 'estacao';

export type TipoProduto =
  | 'forma'
  | 'bloco'
  | 'fundo_forma'
  | 'fundo_bloco'
  | 'molde';

export type TipoMaquina =
  | 'torno'
  | 'vertiflow'
  | 'tres_eixos'
  | 'quinto_eixo'
  | 'fundicao'
  | 'metalizacao'
  | 'solda'
  | 'qualidade'
  | 'embalagem'
  | 'outros';

export type StatusOS =
  | 'aberta'
  | 'em_producao'
  | 'finalizada'
  | 'atrasada'
  | 'cancelada';

export type StatusLote =
  | 'na_fila'
  | 'em_processo'
  | 'aguardando_qualidade'
  | 'bloqueado'
  | 'concluido';

export type StatusOPLote =
  | 'na_fila'
  | 'em_processo'
  | 'aguardando_qualidade'
  | 'concluida'
  | 'bloqueada';

export type StatusProcessamento = 'rodando' | 'finalizado' | 'interrompido';

export type TipoDesenho = 'cliente' | 'forma' | 'acompanhamento_dim';

export type CaracteristicaCota = 'funcional' | 'critica' | 'processo';

export type FrequenciaMedicao =
  | 'todas'
  | 'primeira'
  | 'um_em_3'
  | 'um_em_5'
  | 'um_em_10'
  | 'na_preparacao';

export type InstrumentoMedicao =
  | 'paq_digital'
  | 'comparador'
  | 'altimetro'
  | 'micrometro'
  | 'renishaw'
  | 'visual'
  | 'metrologia'
  | 'outros';

export type ResultadoInspecao = 'aprovado' | 'reprovado' | 'com_observacoes';

export type TipoInspecao = 'primeira_peca' | 'amostragem' | 'final';

export type TipoEventoOS =
  | 'os_criada'
  | 'os_alterada'
  | 'prazo_alterado'
  | 'prioridade_alterada'
  | 'lote_criado'
  | 'op_lote_iniciada'
  | 'op_lote_concluida'
  | 'inspecao_iniciada'
  | 'inspecao_aprovada'
  | 'inspecao_reprovada'
  | 'inspecao_com_observacao'
  | 'volume_registrado'
  | 'observacao_livre'
  | 'alerta_disparado'
  | 'retrabalho_solicitado'
  | 'os_finalizada'
  | 'os_cancelada';

export type TipoAlerta =
  | 'lote_parado'
  | 'qualidade_reprovada'
  | 'cota_fora_tolerancia'
  | 'volume_correcao_alta'
  | 'os_em_risco'
  | 'os_vencida'
  | 'resumo_diario';

export type SeveridadeAlerta = 'info' | 'warning' | 'critico';

export type CanalAlerta = 'whatsapp' | 'dashboard';

// ===========================
// LABELS (para UI)
// ===========================

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: 'Administrador',
  chefe: 'Chefe',
  pcp: 'PCP',
  engenharia: 'Engenharia',
  programador: 'Programador',
  operador: 'Operador',
  inspetor: 'Inspetor de Qualidade',
  embalador: 'Embalador',
  estacao: 'Conta de Estação',
};

export const TIPO_PRODUTO_LABEL: Record<TipoProduto, string> = {
  forma: 'Forma',
  bloco: 'Bloco',
  fundo_forma: 'Fundo de Forma',
  fundo_bloco: 'Fundo de Bloco',
  molde: 'Molde',
};

export const CARACTERISTICA_COTA_LABEL: Record<CaracteristicaCota, string> = {
  funcional: 'Funcional (#F)',
  critica: 'Crítica (#C)',
  processo: 'Processo (#P)',
};

export const FREQUENCIA_MEDICAO_LABEL: Record<FrequenciaMedicao, string> = {
  todas: 'Todas as peças',
  primeira: 'Primeira peça',
  um_em_3: '1 em 3',
  um_em_5: '1 em 5',
  um_em_10: '1 em 10',
  na_preparacao: 'Na preparação',
};

export const INSTRUMENTO_MEDICAO_LABEL: Record<InstrumentoMedicao, string> = {
  paq_digital: 'Paquímetro Digital',
  comparador: 'Comparador',
  altimetro: 'Altímetro',
  micrometro: 'Micrômetro',
  renishaw: 'Renishaw',
  visual: 'Visual',
  metrologia: 'Setor de Metrologia (3D)',
  outros: 'Outros',
};

export const TIPO_DESENHO_LABEL: Record<TipoDesenho, string> = {
  cliente: 'Desenho do Cliente',
  forma: 'Desenho da Forma',
  acompanhamento_dim: 'Acompanhamento Dimensional',
};

// ===========================
// AUTH
// ===========================

export interface LoginRequest {
  codigo_pessoal: string;
  pin: string;
}

export interface LoginResponse {
  token: string;
  pessoa: PessoaPublica;
}

export interface PessoaPublica {
  id: string;
  nome: string;
  codigoPessoal?: string;
  papel: Papel;
  ativo: boolean;
  /** Estação vinculada à conta. Nulo = sem vínculo com estação. */
  etapaId?: string | null;
  etapa?: { id: string; nome: string } | null;
}

// ===========================
// API GENÉRICO
// ===========================

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
}

// ===========================
// DOMÍNIO: CLIENTES
// ===========================

export interface Cliente {
  id: string;
  nome: string;
  observacoes?: string | null;
  ativo: boolean;
}

// ===========================
// DOMÍNIO: ETAPAS / MÁQUINAS
// ===========================

export interface Etapa {
  id: string;
  nome: string;
  ordemPadrao: number;
  slaHoras: number;
  aplicaParaTipos: TipoProduto[];
  exigeCheckpointQualidade: boolean;
  ativa: boolean;
}

export interface Maquina {
  id: string;
  nome: string;
  codigoInterno: string;
  tipo: TipoMaquina;
  etapaId: string;
  ativa: boolean;
}

// ===========================
// DOMÍNIO: ARTIGO
// ===========================

export interface Artigo {
  id: string;
  codigo: string;
  descricao: string;
  tipoProduto: TipoProduto;
  clientePadraoId?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ArtigoCompleto extends Artigo {
  clientePadrao?: Cliente | null;
  desenhos: Desenho[];
  operacoes: OperacaoArtigoCompleta[];
}

export interface CriarArtigoRequest {
  codigo: string;
  descricao: string;
  tipoProduto: TipoProduto;
  clientePadraoId?: string;
  observacoes?: string;
}

// ===========================
// DOMÍNIO: DESENHO
// ===========================

export interface Desenho {
  id: string;
  artigoId: string;
  tipo: TipoDesenho;
  codigoDesenho: string;
  revisao: string;
  dataRevisao?: string | null;
  arquivoBucket: string;
  arquivoKey: string;
  arquivoTipo: string;
  arquivoTamanho: number;
  arquivoUrl?: string; // gerado pelo backend na resposta
  observacoes?: string | null;
}

// ===========================
// DOMÍNIO: OPERACAO ARTIGO
// ===========================

export interface OperacaoArtigo {
  id: string;
  artigoId: string;
  etapaId: string;
  codigoOp: string;
  ordem: number;
  tipoServico: string;
  tempoUnitMin: number;
  tempoSetupMin: number;
  exigeInspecao: boolean;
  observacoes?: string | null;
}

export interface OperacaoArtigoCompleta extends OperacaoArtigo {
  etapa?: Etapa;
  planoInspecao?: PlanoInspecaoCompleto | null;
}

// ===========================
// DOMÍNIO: PLANO INSPECAO
// ===========================

export interface PlanoInspecao {
  id: string;
  operacaoArtigoId: string;
  observacoesGerais?: string | null;
}

export interface PlanoInspecaoCompleto extends PlanoInspecao {
  cotas: CotaInspecao[];
}

export interface CotaInspecao {
  id: string;
  planoInspecaoId: string;
  codigoCota: string;
  valorNominal: number;
  toleranciaMais: number;
  toleranciaMenos: number;
  caracteristica: CaracteristicaCota;
  frequencia: FrequenciaMedicao;
  instrumento: InstrumentoMedicao;
  ordem: number;
  observacoes?: string | null;
}

// ===========================
// DOMÍNIO: OS / LOTE / OP_LOTE
// ===========================

export interface OS {
  id: string;
  codigoGrv: string;
  clienteId: string;
  artigoId: string;
  quantidadeTotal: number;
  prazoEntrega: string;
  dataAbertura: string;
  prioridade: 'normal' | 'urgente';
  status: StatusOS;
  observacoes?: string | null;
  criadoPorId: string;
}

export interface Lote {
  id: string;
  osId: string;
  numeroLote: number;
  quantidadePecas: number;
  status: StatusLote;
  observacoes?: string | null;
}

export interface OPLote {
  id: string;
  loteId: string;
  operacaoArtigoId: string;
  etapaId: string;
  codigoGrvOp?: string | null;
  ordem: number;
  status: StatusOPLote;
  quantidadeConcluida: number;
  tempoUnitPlanejado: number;
  tempoTotalPlanejado: number;
}

/** Estação que permite decidir a execução interna ou externa por lote. */
export function isMetalizacao(nome: string): boolean {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'metalizacao';
}
