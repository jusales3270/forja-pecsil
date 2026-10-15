// Texto de busca do catálogo de materiais: maiúsculas, sem acento, só letras,
// números e espaço. O código entra também sem traço (2-07-00589 → 20700589).

export function textoDeBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^0-9A-Z]+/g, ' ')
    .trim();
}

export function buscaDoMaterial(codigo: string, descricao: string): string {
  const compacto = codigo.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return `${compacto} ${textoDeBusca(codigo)} ${textoDeBusca(descricao)}`.trim();
}
