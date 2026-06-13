# Changelog Forja

Histórico de mudanças do sistema.

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
