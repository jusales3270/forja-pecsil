# Decisões — Sprint 4

## Bloco C — Fundição: ETAPA ÚNICA (decidido 13/06/2026)

O roadmap v4 previa subetapas internas da fundição (modelo, fundição,
rebarbação, tratamento, jateamento) como checkpoints. Decisão: NÃO modelar
subetapas agora. A fundição opera como etapa única no tótem, igual às demais
estações (validado em browser: OS 211331 passou por iniciar/encerrar/+1 peça).

Motivo: nenhuma validação presencial foi feita ainda. Modelar 5 subetapas sem
ver a operação real da fundição no chão é aposta cega com custo de retrabalho de
schema. Barato adiar, caro errar.

Interface desktop da fundição: já coberta — o tótem é a mesma PWA, layout
desktop, funcionou no PC no teste.

Consequência: Bloco C fechado sem código novo. Reabrir só se a validação
presencial mostrar que as subetapas têm estações/pessoas distintas e que lotes
esperam entre elas (onde gargalo e lote fantasma se escondem).

## Pergunta adicionada à pauta da validação presencial na fábrica

A fundição tem subetapas em estações/pessoas separadas, com lotes esperando
entre elas? Ou é um programador tocando o lote do início ao fim no mesmo PC?
(Decide se subetapas viram modelo ou seguem como etapa única.)

## Pendências técnicas registradas (não-bloqueantes)

- Validação Zod falhando retorna HTTP 500 em vez de 400 (visto em
  /api/lotes-fantasmas?horas=0). Padronizar tratamento de erro de input.
- Bug de `.data` duplicado: corrigido em NovaOSModal.tsx; provável que persista
  em OSListPage.tsx (mesmo erro de tipo apontado pelo tsc).
