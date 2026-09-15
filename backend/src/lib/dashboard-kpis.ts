// Prazos de entrega são datas de calendário; uma OS que vence hoje não está atrasada.
const DIA = 86_400_000;
export function diaDaFabrica(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
}
export function diasAtePrazo(prazo: Date, agora: Date): number {
  return Math.round((Date.parse(prazo.toISOString().slice(0, 10)) - Date.parse(diaDaFabrica(agora))) / DIA);
}

interface OrdemIndicador {
  id: string;
  status: string;
  prazoEntrega: Date;
  cliente: { id: string; nome: string };
  artigo: { tipoProduto: string };
  eventos: { timestamp: Date }[];
}

export function montarIndicadores(os: OrdemIndicador[], agora: Date, dias: number) {
  const inicio = new Date(Date.parse(diaDaFabrica(agora)) - (dias - 1) * DIA).toISOString().slice(0, 10);
  const ativas = os.filter(o => !['finalizada', 'cancelada'].includes(o.status));
  const atrasadas = ativas.filter(o => diasAtePrazo(o.prazoEntrega, agora) < 0);
  const fechadas = os.filter(o => o.status === 'finalizada');
  const historico = fechadas.flatMap(o => {
    const data = o.eventos[0]?.timestamp;
    if (!data || diaDaFabrica(data) < inicio || data > agora) return [];
    const diasAtraso = Math.max(0, -diasAtePrazo(o.prazoEntrega, data));
    return [{ ...o, data: diaDaFabrica(data), diasAtraso }];
  });
  const concluidasAtrasadas = historico.filter(o => o.diasAtraso > 0);
  const agrupar = (campo: 'cliente' | 'tipo') => {
    const grupos = new Map<string, { id: string; nome: string; total: number; atrasadas: number; diasAtraso: number; osIds: string[] }>();
    for (const o of historico) {
      const id = campo === 'cliente' ? o.cliente.id : o.artigo.tipoProduto;
      const nome = campo === 'cliente' ? o.cliente.nome : o.artigo.tipoProduto;
      const item = grupos.get(id) ?? { id, nome, total: 0, atrasadas: 0, diasAtraso: 0, osIds: [] };
      item.total++;
      if (o.diasAtraso > 0) { item.atrasadas++; item.diasAtraso += o.diasAtraso; item.osIds.push(o.id); }
      grupos.set(id, item);
    }
    return [...grupos.values()].map(g => ({ ...g, mediaDiasAtraso: g.atrasadas ? Math.round(g.diasAtraso / g.atrasadas * 10) / 10 : 0 }))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.total - a.total || a.nome.localeCompare(b.nome));
  };
  const meses = new Map<string, { mes: string; emDia: number; atrasadas: number }>();
  const cursor = new Date(`${inicio.slice(0, 7)}-01T12:00:00Z`);
  const ultimoMes = diaDaFabrica(agora).slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= ultimoMes) {
    const mes = cursor.toISOString().slice(0, 7);
    meses.set(mes, { mes, emDia: 0, atrasadas: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const o of historico) {
    const mes = meses.get(o.data.slice(0, 7))!;
    if (o.diasAtraso > 0) mes.atrasadas++; else mes.emDia++;
  }
  return {
    carteira: { total: ativas.length, emDia: ativas.length - atrasadas.length, atrasadas: atrasadas.length,
      emDiaIds: ativas.filter(o => diasAtePrazo(o.prazoEntrega, agora) >= 0).map(o => o.id), atrasadasIds: atrasadas.map(o => o.id) },
    historico: { dias, inicio, fim: diaDaFabrica(agora), total: historico.length,
      emDia: historico.length - concluidasAtrasadas.length, atrasadas: concluidasAtrasadas.length,
      pontualidade: historico.length ? Math.round((historico.length - concluidasAtrasadas.length) / historico.length * 100) : null,
      semDataConclusao: fechadas.filter(o => !o.eventos.length).length,
      porCliente: agrupar('cliente'), porTipo: agrupar('tipo'), evolucao: [...meses.values()],
      os: historico.map(o => ({ id: o.id, concluidaEm: o.data, diasAtraso: o.diasAtraso })) },
  };
}
