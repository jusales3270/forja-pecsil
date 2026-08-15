# Changelog Forja

Histórico de mudanças do sistema.

## [Trilha de julho] - Julho/2026

### Adicionado
- `import-artigos-legado.ts`: import idempotente (por `codigo + clienteId`) de ~3.870 artigos do catálogo legado, a partir de 9 arquivos `.json` em `prisma/data/`, sob o cliente "Pecsil — Catálogo Interno (Moldes)"
- 5 `TipoProduto` novos: `arruela`, `cabeca_sopro`, `forminha`, `puncao`, `funil`
- `MotivoParada` (catálogo: `codigo`, `nome`, `planejado`, `capturaAutomaticaIot`) + `ParadaMaquina` (N por `Carimbo`)
- Botão Pausar/Retomar no tótem, com motivo obrigatório; encerrar OP fecha parada aberta automaticamente
- Painel de produção do chefe: cards "máquinas paradas agora" e "tempo parado hoje por motivo"
- Cadastro `/motivos-parada`; campo `codigo` em Tipos de Serviço, para mapear com o cadastro legado da Pecsil
- Home reorganizada por fluxo real do PCP: bloco "Cadastros" (base) e "Fluxo de PCP" (sequência, começando em Ordens de Serviço)

### Removido
- Cards "Sprint 2a" / "Próximo — Sprint 2b" e atalhos `localhost:3001`/`9101` da Home (resíduo de dev visível em produção)
- `travaMaquina` — implementado como POC (`OperacaoArtigo`/`OPLote` + validação no tótem) e **revertido por completo** por decisão do PCP: schema, migration, backend, frontend

### Corrigido
- 500 em produção nas rotas `/tipos-servico` e `/motivos-parada` por migration pendente (`prisma migrate deploy` não é automático no deploy do Coolify — precisa ser rodado manualmente após cada deploy com migration nova)

## [Sprint 6] - Junho/2026

### Adicionado
- `/api/dashboard`: rota única, polling de 30s, layout TV e mobile
- KPIs clicáveis com lista de OS por status; Kanban por etapa (card por lote, semáforo de prazo, dados do carimbo)
- Busca universal; Lotes Fantasmas v2 embutido no painel; resumo de inspeção
- Tema claro/escuro no painel e backoffice

## [Sprint 5] - Junho/2026

### Adicionado
- Inspeção dimensional cota a cota, com validação de tolerância no servidor (tolerância da cota, fallback por faixa do valor nominal)
- Controle de volume com cálculo de correção
- Tela de tótem de inspeção, uma cota por vez

## [Sprint 4] - Junho/2026

### Adicionado
- `ApontamentoPeca`: registrar, desfazer e listar; botão "+1 peça" no tótem
- Conferência de fim de turno (prévia por máquina, fechamento com ajuste manual)
- Lotes Fantasmas v1 (`/lotes-fantasmas`): OPs paradas, máquinas sem registro, turnos não fechados

### Decidido
- Fundição opera como **etapa única** no tótem (não subetapas) — validado em browser com a OS 211331. Reabre só se validação presencial mostrar estações/pessoas distintas com lote esperando entre elas

## [Sprint 3] - Maio/Junho/2026

### Adicionado
- Tótem do programador: carimbo de entrada/saída por OP, fila por estação
- RBAC completo end-to-end (8 papéis, `permissions.ts`, `RoleRoute`, `HomeRedirect`)
- Propagação de observações entre etapas com autoria; Socket.IO com salas por estação

## [Sprint 2a/2b] - Maio/2026

### Adicionado
- Backoffice de Artigos: roteiro (`OperacaoArtigo`), desenhos (upload MinIO), plano de inspeção (`PlanoInspecao`, `CotaInspecao`)
- Cadastros de Clientes e Tipos de Serviço
- Abertura de OS com divisão em lotes e OPs herdadas do roteiro do Artigo (clonagem/snapshot)
- Timeline de eventos da OS (`EventoOS`)

## [Sprint 1.1 — Parte 1] - Maio/2026

### Adicionado
- **MinIO** ao stack Docker (storage S3 local pra desenhos e fotos)
- **Schema Prisma v2** com 17 entidades alinhadas ao PRD v2:
  - `Artigo`, `Desenho`, `OperacaoArtigo`, `PlanoInspecao`, `CotaInspecao`
  - `OPLote` (operação no lote concreto), `InspecaoOP`, `MedicaoInspecao`
  - `ControleVolume`, `EventoOS` (timeline)
- Enums novos: `TipoDesenho`, `CaracteristicaCota`, `FrequenciaMedicao`, `InstrumentoMedicao`, `TipoInspecao`, `TipoEventoOS`
- Papel `engenharia` adicionado
- Scripts utilitários: `up.sh`, `down.sh`, `reset.sh`
- GitHub Actions com CI (build + lint)
- Tipos compartilhados v2 com labels em português para UI

### Modificado
- `Carimbo` agora vinculado a `OPLote`, não mais a Etapa diretamente
- Bucket de MinIO adicionado ao `.env.example`
- `.gitignore` mais completo
- Seed limpo e simplificado (sem Artigos — virão no Sprint 2a)

### Removido
- `CheckpointQualidade` (substituído por `InspecaoOP` + `MedicaoInspecao`)

### Pendente (Parte 2 desta etapa)
- Refazer tela de login pra mouse+teclado (sem keypad virtual)
- Refazer CSS Tailwind removendo classes touch
- Configurar cliente MinIO no backend

### Pendente (Parte 3 desta etapa)
- Testes mínimos do backend (auth)
- Documentação de implantação para você (não-dev)

---

## [Sprint 1.0] - Maio/2026

### Adicionado
- Monorepo pnpm com `backend`, `frontend`, `shared`
- Backend Fastify + Prisma + Postgres + Redis + Socket.IO
- Frontend React + Vite + Tailwind PWA
- Schema v1 (Pessoa, Cliente, Máquina, Etapa, OS, Lote, Carimbo, ProcessamentoMaquina, ApontamentoTurno, CheckpointQualidade, Alerta)
- Autenticação por código + PIN (JWT)
- Tela de login estilo tótem touch (deprecada na v1.1)
- Seed com cadastros básicos da Pecsil
- Docker Compose com Postgres, Redis, Evolution API

### Decisões iniciais
- Stack: Node.js, Fastify, Prisma, Postgres, Redis, React, Vite, Tailwind
- Tema escuro com cor primária `forja-500` (vermelho fogo)
