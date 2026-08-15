# Roadmap — Sistema de Controle de Produção Pecsil (Forja)

**Projeto:** Forja — Controle de Produção Pecsil
**Documento complementar ao:** PRD_Pecsil_v3.md (PRD v4/v5 pendente de publicação)
**Versão:** 5.1 — Reconciliação com o código real (pós-verificação)
**Data:** 31 de Julho de 2026
**Autor:** SomaVerso AI Systems — v5.0; verificação e v5.1 por Claude (Sonnet 5)
**Base:** auditoria do repositório no commit `4b48a36` (31/07/2026) + verificação linha a linha contra código/schema/banco (local e produção) nesta mesma data

---

## Changelog

**v5.1 — 31/Julho/2026 (mesmo dia, pós-verificação)**
- **Toda afirmação verificável da v5.0 foi checada contra o código, o schema e o banco** (local e produção). Confirmadas: HomePage com cards de Sprint, README desatualizado, `backup.sh` ausente, zero testes de frontend, crédito do "+1 peça" no usuário logado, `bullmq` sem worker, Evolution API não usada, import legado com 5 `TipoProduto` novos, Sprint 6c 100% não iniciado (zero `MaterialArtigo`/`terceirizada`/`RoteiroPadrao`), `travaMaquina` revertido, `MotivoParada`/`ParadaMaquina` como descrito.
- **H4 marcado como RESOLVIDO.** A v5.0 listava "catálogo de motivos de parada vazio em produção" como débito crítico pendente. Verificação direta no banco de produção confirmou **12 Motivos de Parada e 36 Tipos de Serviço já cadastrados** (população feita em 31/07, entre a auditoria do commit `4b48a36` e a publicação deste documento — por isso não apareceu na v5.0, que auditou só o código).
- **H1 marcado como RESOLVIDO.** Cards "Sprint 2a" / "Próximo — Sprint 2b" removidos de `HomePage.tsx`, junto com o bloco "Atalhos do Sistema" (links `localhost:3001` / `localhost:9101` que não fazem sentido pra um admin acessando produção).
- **Novo achado — CORS de produção aponta pro domínio errado.** `backend/src/index.ts:51` usa `['http://localhost:5173']` como origin em produção, não `forja.somaflow.com.br`. Hoje não quebra nada (frontend/backend atrás do mesmo proxy, same-origin), mas é bomba-relógio se os domínios forem separados. Adicionado ao hardening do Sprint 7.
- **Risco "Artigos importados sem roteiro" requantificado**: não é "alta probabilidade", é **100% confirmado** — 3872 de 3872 artigos importados têm zero `OperacaoArtigo`.

**v5.0 — 31/Julho/2026**
- **Reconciliação com o código.** A v4 (10/jun) apontava o Sprint 4 como próximo; Sprints 4, 5 e 6 foram entregues entre 13/06 e 22/06. Este documento parte do repositório, não da v4.
- **Sprints 4, 5 e 6 marcados como ENTREGUES** — com evidência de rota, migration e página
- **Trilha de julho registrada** — import do catálogo legado, Motivo de Parada / Parada de Máquina, reorganização da Home. Nenhum desses itens estava previsto em qualquer roadmap
- **Risco "cadastro inicial de Artigos atrasa" reclassificado** de Alta/Alto para Baixa/Médio — resolvido por import em massa, com o risco **transferido** para a ausência de roteiro nos artigos importados
- **Novo Sprint 6c — Paridade com o GRV** (lista de materiais, serviço de terceiros, previsão de horas, roteiro em massa). Não existia em nenhum roadmap e é o que sustenta a decisão de substituir o GRV
- **Fase 0 (Higiene) criada** — quatro itens de dias, não de sprint, que hoje distorcem a percepção do sistema
- **Fundição confirmada como etapa única** (decisão de 13/06), removida do escopo do Sprint 4
- **`travaMaquina` registrado como avaliado e descartado** pelo PCP
- Débitos técnicos reconciliados com o que existe de fato no código

**v4.0 — 10/Jun/2026** — 7 pendências respondidas; Sprint 4 redesenhado (peça a peça no MVP); Lotes Fantasmas antecipado; RFID rejeitado
**v3.0 — 23/Mai/2026** — Sprints 2a/2b entregues; Sprint 6 expandido; débitos consolidados
**v2.0 — Mai/2026** — Sprint 2 desdobrado; UX mouse+teclado
**v1.0** — Versão inicial

---

## Sumário Executivo

| Fase | Status | Entregável |
|---|---|---|
| Sprints 0 a 2b | ✅ ENTREGUE | Fundação, backoffice de Artigos, OS + lotes + OPs + timeline |
| Sprint 3 | ✅ ENTREGUE | Tótem do programador + RBAC |
| Sprint 4 | ✅ ENTREGUE | "+1 peça", conferência de turno, Lotes Fantasmas v1 |
| Sprint 5 | ✅ ENTREGUE | Inspeção dimensional + controle de volume |
| Sprint 6 | ✅ ENTREGUE | Painel de produção do chefe + Fantasmas v2 |
| Trilha de julho | ✅ ENTREGUE | Import legado, Motivo de Parada, reorganização do PCP |
| Fase 0 — H1 (cards de sprint na Home) | ✅ **RESOLVIDO 31/07** | Removidos de `HomePage.tsx` |
| Fase 0 — H2 (README/CHANGELOG) | ✅ **RESOLVIDO 31/07** | README com status real; CHANGELOG com Sprints 2a-6 + trilha de julho |
| Fase 0 — H4 (catálogo de motivos de parada) | ✅ **RESOLVIDO 31/07** | 12 motivos + 36 tipos de serviço em produção |
| Fase 0 — H3 | 🔴 **IMEDIATO** | Backup versionado + restore testado — único item pendente da Fase 0 |
| **Visita à fábrica** | 🔴 **IMEDIATO** | Fecha 4 decisões abertas desde junho |
| **Sprint 6c** ⭐ | ⏳ (2 sem) | **Paridade com o GRV** — materiais, terceiros, horas, roteiro |
| Sprint 6b | ⏳ (2 sem) | Dashboard financeiro do PCP — bloqueado pelo PCP |
| Sprint 7 | ⏳ (2 sem) | Alertas WhatsApp + hardening (inclui fix de CORS) + GO-LIVE |
| Fase 2 | ⏳ | Integração SpindleOps (OEE), desenhos digitalizados, decisão RFID |
| Fase 3 | ⏳ | Camada IA + agente conversacional |

**MVP em produção:** ~7 semanas (Fase 0 + 6c + 6b + 7), condicionado à visita à fábrica
**Caminho crítico real:** não é código. São quatro decisões de negócio paradas desde junho.

---

## Princípios do Roadmap

1. **Vertical slice, não horizontal** — cada sprint entrega fatia ponta-a-ponta funcional
2. **Validação contínua na fábrica** — sprint sem validação presencial acumula risco silencioso
3. **Caderno e planilha coexistem até o go-live**
4. **Roteiro reversível** — descobrir cedo é mais barato
5. **O documento persegue o código, não o contrário** — quando divergirem, o código é a verdade e o roadmap se atualiza no mesmo dia *(é exatamente o que gerou a v5.1)*

---

## ✅ O que está entregue

### Sprints 0 a 3 — Fundação, cadastros, OS e tótem
Autenticação código + PIN com JWT; RBAC end-to-end com 8 papéis (`permissions.ts`, `RoleRoute`, `HomeRedirect`); cadastros de Clientes, Tipos de Serviço, Tolerâncias e Artigos (roteiro, desenhos em MinIO, plano de inspeção); OS com divisão em lotes e OPs herdadas do Artigo; timeline de eventos; tótem com carimbo de entrada e saída; propagação de observações entre etapas com autoria; Socket.IO com salas por estação.

### Sprint 4 — Apontamento do operador ✅
- `ApontamentoPeca` + rotas de registrar, desfazer e listar (migration `20260613143321`)
- Botão "+1 peça" no tótem, alimentando `quantidade_concluida` em tempo real
- Conferência de fim de turno: prévia por máquina, fechamento com ajuste manual
- **Lotes Fantasmas v1** — tela `/lotes-fantasmas` (OPs paradas, máquinas sem registro, turnos não fechados)
- **Bloco C encerrado sem código:** fundição opera como etapa única. Reabrir só se a validação presencial mostrar estações e pessoas distintas com lote esperando entre elas

### Sprint 5 — Inspeção e volume ✅
Inspeção dimensional cota a cota com validação de tolerância no servidor (tolerância da cota, fallback por faixa do valor nominal); controle de volume com cálculo de correção; tela de tótem uma cota por vez.

### Sprint 6 — Painel de produção do chefe ✅
Rota única `/api/dashboard`, polling de 30s, TV e mobile. KPIs clicáveis com lista de OS; Kanban por etapa com card por lote, semáforo de prazo e carimbo (operador, programador, máquina); busca universal; Lotes Fantasmas v2 embutido; resumo de inspeção; tema claro/escuro.

### Trilha de julho — *(não prevista em nenhum roadmap)*

**Import do catálogo legado (20/07)** — `import-artigos-legado.ts`, idempotente por `codigo + clienteId`, lê todos os `.json` de `prisma/data/`. Nove arquivos, ~3.870 artigos, sob o cliente "Pecsil — Catálogo Interno (Moldes)". Cinco `TipoProduto` novos: `arruela`, `cabeca_sopro`, `forminha`, `puncao`, `funil`.

**Motivo de Parada (21/07)** — `MotivoParada` (`codigo`, `nome`, `planejado`, `capturaAutomaticaIot`) + `ParadaMaquina` (N por `Carimbo`). Botão Pausar/Retomar no tótem; encerrar OP fecha parada aberta automaticamente. Painel do chefe ganhou "máquinas paradas agora" e "tempo parado hoje por motivo". Cadastro em `/motivos-parada`. `travaMaquina` implementado como POC e **revertido por completo** por decisão do PCP.

**Reorganização do PCP (31/07)** — Home por fluxo, código em Tipos de Serviço, tela de cadastro de motivos. **Catálogos populados em produção no mesmo dia** (12 motivos + 36 tipos de serviço). **Cards de Sprint 2a/2b e atalhos localhost removidos da Home.**

---

## 🔴 Fase 0 — Higiene (dias, não sprint)

Quatro itens baratos com retorno desproporcional. Nenhum é feature. **Dois já resolvidos.**

| # | Item | Esforço | Status | Por quê |
|---|---|---|---|---|
| H1 | ~~Remover os cards "Sprint 2a / Sprint 2b" da Home~~ | 15 min | ✅ **RESOLVIDO 31/07** | Removido de `HomePage.tsx`, junto com os atalhos `localhost:3001`/`9101` |
| H2 | ~~Atualizar `README.md` e `CHANGELOG.md`~~ | 1h | ✅ **RESOLVIDO 31/07** | README com status real e link pra este roadmap; CHANGELOG com entradas de Sprint 2a até a trilha de julho |
| H3 | **Versionar `backup.sh` + cron e testar restore real** | ~4h | 🔴 pendente | O procedimento existe no `DEPLOY.md` mas não há script no repositório. Marcado bloqueante desde 10/06. Sem restore testado, backup é hipótese |
| H4 | ~~Popular o catálogo de motivos de parada~~ | 30 min | ✅ **RESOLVIDO 31/07** | 12 motivos + 36 tipos de serviço confirmados em produção via API |

**Também nesta fase, oportunístico:** corrigir ZodError → 500 (não 400) em `/api/lotes-fantasmas`.

---

## 🔴 Visita única à Pecsil

Quatro decisões estão paradas desde junho. Todas cabem numa manhã. **Este é o caminho crítico do projeto — não há código bloqueado por código.**

**Pauta**

1. **Crédito do "+1 peça".** Hoje `apontamento-peca.ts` usa `request.user.pessoaId` — o programador que clica leva o crédito, não o operador da máquina. Para "controle interno de produtividade" isso está provavelmente invertido. Se for o operador, o registro passa a receber `operadorId` explícito vindo do carimbo em andamento.
2. **Ciclo das OPs mais rápidas.** Existe estação em que uma ida ao tótem por peça não faz sentido? Se sim, aquela estação vira exceção com apontamento por turno.
3. **Subetapas da fundição.** Estações e pessoas distintas com lote esperando entre elas, ou um programador tocando o lote do início ao fim no mesmo PC? Decide se `Bloco C` reabre.
4. **Três respostas do PCP** — status fiscais (enum ou livre), anotações CAB/LOC (Artigo ou OS), colunas COMPRA / CAIXA / LISTA. **Bloqueiam o Sprint 6b.**

**Também na visita:** cronometrar abertura de OP no hardware real (alvo <30s), testar foco de teclado e legibilidade à distância, validar este roadmap por escrito com o chefe, definir datas do 6c.

---

## ⭐ Sprint 6c — Paridade com o GRV (2 semanas)

### Objetivo
Fazer o Artigo carregar tudo que o PCP hoje precisa do GRV, para que abrir uma OS no Forja seja estritamente melhor do que abrir no GRV. **É o sprint que sustenta a decisão de aposentar o sistema legado.**

### Justificativa
O import de julho resolveu metade do problema: existem ~3.870 artigos pesquisáveis por código e descrição. Mas cada linha traz apenas `codigo`, `descricao` e `tipoProduto` — **sem roteiro, sem plano de inspeção, sem desenho**. A herança automática de processo, que é a tese central do modelo Artigo-first, não acontece nesses artigos. Confirmado por query direta: **3872 de 3872 artigos importados têm zero `OperacaoArtigo`** — não é risco, é fato consumado. E três blocos do GRV nunca foram modelados.

Enquanto isso durar, o PCP abre OS no Forja com **menos** informação do que o GRV entrega. Nenhuma demonstração de dashboard compensa isso.

### Bloco A — Lista de materiais (~4 dias)
- `MaterialArtigo`: `artigoId`, `descricao`, `quantidade`, `unidade`, `observacoes`, `ordem`
- Herança para a OS na criação (snapshot, mesmo padrão de `OperacaoArtigo` → `OPLote`)
- Aba de materiais no cadastro de Artigo; bloco de materiais na tela de OS
- Migração do campo `Artigo.material String?` (texto livre) para a nova entidade, preservando o conteúdo atual como primeira linha

### Bloco B — Serviço de terceiros por operação (~3 dias)
- Campos em `OperacaoArtigo` / `OPLote`: `terceirizada Boolean`, `fornecedor String?`, `prazoPrevistoDias Int?`, `custoPrevisto Decimal?`
- No tótem: OP terceirizada não abre carimbo de máquina — registra envio e retorno
- No Kanban do chefe: OP terceirizada com marcação visual distinta (hoje some da visão de chão)
- **Não confundir** com o motivo de parada "Serviço de Terceiros", que é outra coisa

### Bloco C — Previsão de horas (~2 dias)
- `OperacaoArtigo.horasPrevistas Decimal?`
- Rollup na OS: soma das horas previstas de todas as OPs de todos os lotes
- Comparativo previsto × realizado na timeline (o realizado já existe via carimbos)

### Bloco D — Roteiro em massa nos artigos importados (~3 dias)
O gargalo real: ~3.870 artigos sem roteiro, cadastro manual é inviável.
- **Roteiro padrão por `TipoProduto`** — 10 templates cobrem o catálogo inteiro
- Entidade `RoteiroPadrao` ou reaproveitamento de um Artigo-modelo por tipo
- Ação "aplicar roteiro padrão" em massa por tipo de produto, com override individual
- O PCP ajusta a exceção, não cadastra a regra

### Entregáveis
- PCP abre OS e recebe processo, materiais, terceiros e horas previstas herdados automaticamente
- Comparação lado a lado Forja × GRV na tela de abertura de OS, favorável ao Forja em todos os blocos
- Artigos importados deixam de ser casca de catálogo

### Validação
Sessão com o PCP abrindo 5 OS reais no Forja e no GRV em paralelo, cronometrando as duas.

---

## Sprint 6b — Dashboard financeiro do PCP (2 semanas)

**⚠️ BLOQUEADO** pelas três respostas do PCP (status fiscais, CAB/LOC, COMPRA/CAIXA/LISTA).

Os campos já existem na OS: `precoUnitario`, `valorTotal`, `numeroFiscal`, `poCliente`, `statusFiscal`, `valorRecebido`, `dataNf`, `dataPagamento`. Falta a tela agregada que substitui a planilha mensal.

- Tela separada com capacidade própria `dashboard_financeiro`
- Visão mensal por cliente e por status fiscal, com totalizadores
- Modelagem de `statusFiscal` conforme a resposta: **hoje é `String?` e o débito já se materializou** — vira enum se a lista for finita
- Anotações CAB/LOC modeladas no lugar certo (Artigo ou OS) conforme a resposta

---

## Sprint 7 — Alertas + Hardening + Go-Live (2 semanas)

**Alertas — Lotes Fantasmas v3**
`bullmq` já está no `package.json` e as variáveis `EVOLUTION_API_URL / _KEY / _INSTANCE_NAME` já existem em `env.ts`, mas **não há worker, fila nem cliente**. Nada sai do sistema hoje.
- Workers BullMQ varrendo SLAs a cada 10 min
- Envio via Evolution API com retry e log
- Templates por tipo de alerta; resumo diário às 18h
- Tela de configuração de alertas e de SLA por etapa; histórico para auditoria

**Hardening**
- `@fastify/rate-limit` + `helmet` + CORS estrito em produção (hoje `origin: true` em dev)
- **Corrigir origin de CORS em produção** *(achado 31/07)* — `backend/src/index.ts:51` está hardcoded como `['http://localhost:5173']` em vez do domínio real `forja.somaflow.com.br`. Não quebra hoje (frontend/backend same-origin atrás do mesmo proxy), mas é bug latente se os domínios forem separados
- Logs em arquivo com rotação
- Testes de frontend (hoje: **zero** arquivos; backend tem 8)
- PUT vs PATCH padronizado; JWT consolidado em uma chave
- Cloudflare Tunnel definitivo

**Go-live progressivo**
- Semana 1: paralelo com caderno e planilha
- Semana 2: validação do chefe
- Decisão oficial no fim do sprint

### Critérios de liberação
- Critérios de aceite do PRD verificados
- 1 OS percorreu o fluxo completo, incluindo apontamento peça a peça
- Chefe usou o painel por 1 semana sem reclamação bloqueante
- PCP usou o dashboard financeiro por 1 semana sem reclamação bloqueante
- Apontamentos sistema × caderno batem por 3 dias consecutivos
- **Taxa de registro peça a peça ≥ 90% vs caderno por 3 dias consecutivos**
- Faturamento sistema × planilha bate no fechamento do mês
- Backup com restore testado + hardening aplicado
- **Nenhuma referência a sprint, "próximo" ou status de desenvolvimento visível para o cliente** *(cumprido na Home em 31/07 — falta README/CHANGELOG, que são internos mas valem arrumar)*

---

## 🔴 Débitos Técnicos — estado v5.1

### Resolvidos
| Débito | Resolvido em |
|---|---|
| Testes automatizados de `os.ts` (#8) | Sprint 3 |
| 5 débitos de UX (toasts, timeline legível, propagação de observações, voltar condicional, observação no card) | Sprint 3 |
| RBAC frontend completo | Sprint 3 (antecipado) |
| Error handler global ZodError → 400 | Sprint 4 |
| `.data` duplicado em `NovaOSModal` / `OSListPage` | Sprint 4 |
| Cadastro manual de artigos como gargalo | Import legado, 20/07 |
| **Cards de sprint visíveis na Home** | **31/07 (H1)** |
| **Catálogo de motivos de parada vazio em produção** | **31/07 (H4)** |

### Críticos pendentes
| # | Débito | Quando |
|---|---|---|
| — | README / CHANGELOG desatualizados em 5 sprints | **Fase 0 — H2** |
| 6 | Backup automático não versionado | **Fase 0 — H3** |
| — | CORS de produção com origin hardcoded pra `localhost:5173` | Sprint 7 |
| 11 | Rate limiting + helmet + CORS estrito | Sprint 7 |
| 12 | Logs em arquivo com rotação | Sprint 7 |
| — | Cloudflare Tunnel definitivo | Sprint 7 |

### Materializados
| Débito | Estado |
|---|---|
| `statusFiscal` como texto livre | **Confirmado.** `OS.statusFiscal String?`. A v4 previu; aconteceu. Vira migration no 6b se a resposta do PCP indicar lista finita |
| Crédito do "+1 peça" no usuário logado | **Confirmado** em `apontamento-peca.ts:28,79`. Decisão de negócio, não bug |

### Qualidade de código
| # | Débito | Quando |
|---|---|---|
| 9 | **Testes de frontend — zero arquivos** | Sprint 7 |
| — | ZodError → 500 em `/api/lotes-fantasmas` | Oportunístico |
| 1 | Padronizar retorno dos hooks | Quando tocar nos hooks |
| 2 | PUT vs PATCH | Sprint 7 |
| 3 | JWT consolidado em 1 chave | Sprint 7 |
| 4/5/7/10 | Pequenos (modal, enum, `any`) | Oportunístico |

### Débitos de produto (não-MVP)
- Sprint X — Comentários polimórficos com `@menções`
- Kanban em tempo real via WebSocket (hoje polling de 30s)
- Tema claro/escuro global (hoje só no painel e backoffice)
- Mapa visual da planta física da fábrica
- Subetapas da fundição (reabre só se a visita justificar)

---

## Decisões registradas

**Fundição como etapa única (13/06/2026).** O roadmap v4 previa cinco subetapas como checkpoints. Não modeladas — modelar sem ver a operação real é aposta cega com custo de retrabalho de schema. Validado em browser com a OS 211331. Reabre só se a visita mostrar estações e pessoas distintas com lote esperando entre elas.

**`travaMaquina` avaliado e descartado (21/07/2026).** Implementado como POC (campo em `OperacaoArtigo` / `OPLote` + validação no `POST /op-lote/:id/iniciar`) para prender operação parcial à mesma máquina entre carimbos. O PCP decidiu que não é necessário. Revertido por completo — schema, migration, backend, frontend.

**Motivo de Parada, opção 2 (21/07/2026).** Catálogo dedicado + entidade de parada vinculada ao `Carimbo`, em vez de reaproveitar Tipos de Serviço com campo `categoria` ou de um `motivoParadaId` nullable no `Carimbo`. Suporta múltiplas paradas dentro do mesmo carimbo — necessário para OEE.

**RFID rejeitado como solução primária (jun/2026).** ~R$ 36-41k para 6 portais. Diagnóstico da causa raiz: esquecimento e preguiça, comportamental, não falta de tecnologia de captura. Peças metálicas são o pior ambiente para RFID e as tags reintroduziriam dependência humana por outro caminho. Reavaliação na Fase 2 **apenas se** a taxa de registro peça a peça ficar consistentemente abaixo de 90% com o loop de lotes fantasmas completo. Se entrar, será camada de auditoria, não substituto.

---

## Riscos Transversais — atualizados v5.1

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| **Artigos importados sem roteiro** — herança de processo não acontece; abrir OS no Forja entrega menos que no GRV | **Confirmado 100%** (3872/3872) | **Alto** | Sprint 6c Bloco D: roteiro padrão por `TipoProduto`, aplicação em massa, override individual |
| **Decisões de junho continuam abertas** — 4 decisões paradas há 7 semanas | **Alta** | **Alto** | Visita única com pauta fechada e respostas por escrito. É o caminho crítico |
| ~~Percepção do sistema distorcida pela própria interface~~ — Home anunciava Sprint 2a/2b | ~~Alta~~ **Resolvido** | ~~Alto~~ — | **Resolvido 31/07 (H1)** |
| Backup nunca auditado em produção | Média | **Crítico** | Fase 0 H3: script versionado + restore real testado antes de mais dados reais |
| PCP sobrecarregado (persona única para Artigos, OS e planilha) | Alta | Alto | Import de julho aliviou o cadastro; 6c Bloco D alivia o roteiro; 6b elimina a planilha |
| Adoção do "+1 peça" falha por fricção física | Média | Alto | Confirmar ciclos na visita; exceção por estação se necessário; taxa de registro decide próximos passos |
| Respostas do PCP não chegam | Média | Médio | Perguntas por escrito com prazo na visita; 6b não começa sem elas |
| Zero testes de frontend | Média | Médio | Sprint 7; priorizar hooks de tótem e dashboard |
| Operadores resistem ao tótem | Alta | Médio | Champion + lotes fantasmas + caderno paralelo |
| Chefe muda escopo | Média | Alto | Este documento validado por escrito na visita |
| CORS de produção mal configurado | Baixa (hoje mascarado por same-origin) | Médio se domínios separarem | Fix no Sprint 7 |

---

## Métricas de Acompanhamento

**Adoção**
% OS abertas no sistema vs caderno · % OS com financeiro preenchido vs planilha · % artigos do catálogo efetivamente usados em OS · logins únicos/dia

**Operacional**
Abertura de OS — alvo <5min *(atingido: <2min)* · cadastro de Artigo novo — alvo <30min · abertura de OP no tótem — alvo <30s *(medir na visita)* · registro de 1 peça — alvo <5s · fechamento de turno — alvo <1min · inspeção dimensional — não pode aumentar vs papel

**Comportamental**
**Taxa de registro peça a peça** (sistema ÷ caderno) — alvo ≥90%, é a métrica que decide o RFID · gaps detectados pelo painel de fantasmas por semana, deve cair · turnos não fechados por semana, alvo zero após 4 semanas

**Disponibilidade** *(habilitada pelo Motivo de Parada)*
Tempo parado por motivo por semana · razão parada planejada × não planejada · top 3 motivos por máquina

**Negócio**
Detecção de lote parado — alvo <4h · % OS entregues no prazo · taxa de retrabalho por reprovação · tempo do PCP em caderno e planilha — alvo zero

**Sistema**
Uptime — alvo >99% · resposta do painel — alvo <500ms · alertas/dia

---

## Cronograma

```
Etapa                        | Status        | Quando
-----------------------------|---------------|---------------------------
Sprints 0-6 + trilha julho   | ✅ feito      | já aconteceu
Fase 0 — H1, H2, H4          | ✅ feito      | 31/07
Fase 0 — H3                  | 🔴 IMEDIATO   | esta semana (~4h)
Visita à Pecsil               | 🔴 IMEDIATO   | 1 manhã — caminho crítico
Sprint 6c — Paridade GRV ⭐  | ⏳            | semanas 1-2
Sprint 6b — Financeiro PCP   | ⏳            | semanas 3-4 (se respostas chegarem)
Sprint 7 — Alertas + go-live | ⏳            | semanas 5-6
GO-LIVE                      | 🎯            | fim da semana ~7
Fase 2 — SpindleOps / OEE    | ⏳            | após go-live
```

---

## Fase 2 — Integração e digitalização

**Integração SpindleOps (OEE).** O `MotivoParada.capturaAutomaticaIot` já está no schema como gancho. A fronteira acordada: SpindleOps expõe apenas estado bruto de máquina; o OEE é calculado no Forja, que detém dados de qualidade e tempo de ciclo esperado por Artigo. Paradas classificadas automaticamente por telemetria, com fallback para o registro manual do tótem.

**Desenhos digitalizados.** Storage já existe (MinIO, buckets `forja-desenhos` e `forja-fotos`) e o upload já funciona no cadastro de Artigo. Falta o visualizador embutido e a migração da pasta física.

**Alertas do SpindleOps via Forja.** Roteados pela integração Evolution API do Sprint 7, em vez de canal próprio.

**Decisão RFID.** Condicionada à taxa de registro peça a peça.

---

## Fase 3 — Inteligência

Previsão de prazo e detecção de gargalo crônico · agente conversacional no WhatsApp ("como está a OS 1247?") · sugestão de priorização de fila, detecção de anomalias, dashboard executivo mensal.

---

## Próximos Passos Imediatos (ordem de execução)

1. ~~Fase 0 — H1: remover cards de sprint da Home~~ ✅ feito 31/07
2. ~~Fase 0 — H2: atualizar README e CHANGELOG~~ ✅ feito 31/07
3. ~~Fase 0 — H4: popular catálogo de motivos de parada~~ ✅ feito 31/07
4. 🔴 **Fase 0 — H3**: versionar `backup.sh` + cron, testar restore (~4h) — único item restante da Fase 0
5. 🔴 **Agendar a visita única à Pecsil** com a pauta fechada das 4 decisões
6. 🔴 **Publicar o PRD v5** registrando: peça a peça no MVP, fundição como etapa única, import do catálogo legado, motivo de parada, `travaMaquina` descartado, RFID condicionado
7. 🔴 **Abrir o Sprint 6c** com o backlog dos blocos A-D
8. 🔴 **Cobrar as 3 respostas do PCP por escrito**, com prazo ancorado no início do 6b

---

**Fim do documento Roadmap v5.1.**
