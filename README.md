# 🔥 Forja — Sistema de Controle de Produção Pecsil

Sistema de rastreamento de produção em tempo real para a fundição/usinagem Pecsil.

**Status atual:** Sprints 0 a 6 + trilha de julho entregues (fundação, cadastros, OS, tótem, apontamento peça a peça, inspeção, painel do chefe, import do catálogo legado, Motivo de Parada). Em produção em `forja.somaflow.com.br`. Próximo: Sprint 6c — Paridade com o GRV. Ver `Roadmap_Pecsil_v5.md`.

---

## 🎯 O que esse projeto faz

Substitui o caderno físico de PCP da Pecsil por um sistema digital que:

- Mantém biblioteca reutilizável de **Artigos** (peças) com desenhos e planos de inspeção
- Rastreia em tempo real cada **Lote** ao longo das **OPs** (operações) do fluxo
- Permite **inspeção dimensional estruturada** (cotas, tolerâncias, frequência)
- Mostra ao chefe o **estado da fábrica em tempo real** (dashboard + WhatsApp)
- Elimina retrabalho do PCP (cadastra Artigo uma vez, reusa em todas as OS)

---

## 🚀 Como rodar (passo a passo)

### Pré-requisitos
1. **Docker Desktop** rodando ([download](https://www.docker.com/products/docker-desktop/))
2. **Node.js 20+** ([download](https://nodejs.org/))
3. **pnpm**: rode `npm install -g pnpm` no terminal

### Subir tudo (primeira vez)

No terminal, dentro da pasta `forja`:

```bash
./up.sh
```

Esse script faz tudo: instala dependências, sobe Postgres + Redis + MinIO, aplica migrations, roda seed. Demora ~3-5 minutos na primeira vez.

### Iniciar backend e frontend em modo dev

Depois que `./up.sh` terminar:

```bash
pnpm dev
```

Backend sobe em `http://localhost:3001` e frontend em `http://localhost:5173`.

### Parar tudo

```bash
./down.sh
```

Para containers mas **mantém os dados** (Postgres + MinIO).

### Resetar tudo (apagar dados)

⚠️ **Destrutivo.** Apaga banco e arquivos do MinIO.

```bash
./reset.sh
```

---

## 🌐 URLs importantes

| O que | URL |
|-------|-----|
| Frontend (PWA) | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Healthcheck do backend | http://localhost:3001/health |
| MinIO Console (storage) | http://localhost:9001 |
| Prisma Studio (banco) | rode `pnpm --filter @forja/backend db:studio` |

**Login do MinIO Console:** usuário `forja_admin`, senha `forja_minio_dev_2026`

---

## 🔑 Usuários de teste (todos com PIN 1234)

| Papel | Nome | Código |
|-------|------|--------|
| Admin | Administrador | `0001` |
| Chefe | Ricardo | `0002` |
| PCP | Rafael | `0003` |
| Programador | Japonês | `0010` |
| Programador | Adriano | `0011` |
| Operador | Douglas | `0020` |
| Operador | Operador 2 | `0021` |
| Inspetor | Nicolas (Volumetria) | `0030` |
| Inspetor | Pedro (Dimensional) | `0031` |
| Embalador | Biriro | `0040` |

---

## 📁 Estrutura do projeto

```
forja/
├── backend/              API Node.js + Fastify
│   ├── prisma/
│   │   ├── schema.prisma Modelo do banco
│   │   └── seed.ts       Cadastros iniciais
│   └── src/
│       ├── db/           Cliente Prisma
│       ├── lib/          Auth, env, MinIO
│       ├── routes/       Endpoints REST
│       └── index.ts      Entry point
│
├── frontend/             React + Vite (PWA)
│   └── src/
│       ├── pages/        Telas
│       ├── lib/          API client, stores
│       └── App.tsx       Roteamento
│
├── shared/               Tipos compartilhados TS
│
├── .github/workflows/    CI (GitHub Actions)
├── docker-compose.yml    Stack de dev (Postgres + Redis + MinIO + Evolution)
├── up.sh                 Sobe tudo
├── down.sh               Para tudo
└── reset.sh              Apaga tudo e recria
```

---

## 🗺️ Roadmap

- ✅ **Sprints 0-1.1** — Fundação técnica, schema v2, MinIO, CI
- ✅ **Sprint 2a/2b** — Backoffice de Artigos + abertura de OS com lotes/OPs herdadas
- ✅ **Sprint 3** — Tótem do programador (mouse+teclado) + RBAC
- ✅ **Sprint 4** — Apontamento peça a peça, conferência de turno, Lotes Fantasmas v1
- ✅ **Sprint 5** — Inspeção dimensional + controle de volume
- ✅ **Sprint 6** — Painel de produção do chefe + Lotes Fantasmas v2
- ✅ **Trilha de julho** — Import do catálogo legado (~3.870 artigos), Motivo de Parada / Parada de Máquina, reorganização da Home
- 🟡 **Fase 0 — Higiene** — limpeza de resíduos de dev (Home ✅, catálogo de paradas ✅; README/CHANGELOG ✅; falta backup versionado)
- ⬜ **Sprint 6c** — Paridade com o GRV (materiais, terceiros, horas, roteiro em massa)
- ⬜ **Sprint 6b** — Dashboard financeiro do PCP (bloqueado por respostas do PCP)
- ⬜ **Sprint 7** — Alertas WhatsApp + hardening + go-live

Detalhe completo, débitos técnicos e decisões registradas: `Roadmap_Pecsil_v5.md` e `DECISOES_SPRINT4.md`.

---

## 🧪 Testando manualmente

### Backend
```bash
# Healthcheck
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"codigo_pessoal": "0001", "pin": "1234"}'

# Me (substitua TOKEN_AQUI pelo retorno do login)
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer TOKEN_AQUI"
```

### Banco (Prisma Studio)
```bash
pnpm --filter @forja/backend db:studio
```
Abre interface web em `http://localhost:5555` pra explorar dados.

### MinIO
Acesse http://localhost:9001, login `forja_admin` / `forja_minio_dev_2026`. Veja os buckets `forja-desenhos` e `forja-fotos`.

---

## 🔧 Scripts úteis

```bash
# Dev
pnpm dev                                       # Backend + frontend
pnpm --filter @forja/backend dev               # Só backend
pnpm --filter @forja/frontend dev              # Só frontend

# Banco
pnpm --filter @forja/backend db:migrate        # Aplica migrations
pnpm --filter @forja/backend db:seed           # Roda seed
pnpm --filter @forja/backend db:studio         # Prisma Studio
pnpm --filter @forja/backend db:reset          # ⚠️ Reset total

# Build
pnpm build                                     # Build de produção
```

---

## 📞 Quando algo der errado

### "Cannot connect to Docker daemon"
Abra o Docker Desktop. Não está rodando.

### "Port 5432 already in use"
Tem outro Postgres rodando. Pare ele ou mude a porta no `docker-compose.yml`.

### "Cannot find module..."
Rode `pnpm install` na raiz.

### Banco bagunçado
Rode `./reset.sh` (apaga tudo e recria).

### MinIO com erro de bucket
Rode `docker compose up minio_setup` pra recriar buckets.

---

## 📞 Contato

**SomaVerso AI Systems**

Documentação relacionada:
- `Roadmap_Pecsil_v5.md` — plano de entrega, débitos técnicos e decisões registradas (na raiz do repo)
- `DECISOES_SPRINT4.md` — decisões pontuais de modelagem (fundição, Motivo de Parada, `travaMaquina`)
- `CHANGELOG.md` — histórico de mudanças do código
- `PRD_Pecsil_v2.md` — especificação de produto (na pasta de outputs; v4/v5 pendente de publicação)
