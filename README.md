# 🔥 Forja — Sistema de Controle de Produção Pecsil

Sistema de rastreamento de produção em tempo real para a fundição/usinagem Pecsil.

**Status atual:** Sprint 1.1 — Parte 1 entregue (refatoração v2 da fundação técnica)

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
| Admin | Junior | `0001` |
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

- ✅ **Sprint 0** — Pré-MVP (levantamento + setup)
- ✅ **Sprint 1** — Fundação técnica (v1.0)
- 🟡 **Sprint 1.1** — Refatoração v2 (em andamento — Parte 1 entregue)
  - ✅ Parte 1: Schema v2, tipos, seed, MinIO, scripts, CI
  - ⬜ Parte 2: Tela de login refeita (mouse+teclado), CSS limpo
  - ⬜ Parte 3: Testes mínimos + documentação de implantação
- ⬜ **Sprint 2a** — Backoffice de Artigos
- ⬜ **Sprint 2b** — Abertura de OS + geração de lotes/OPs
- ⬜ **Sprint 3** — Tótem do programador (mouse+teclado)
- ⬜ **Sprint 4** — Apontamento operador + fundição
- ⬜ **Sprint 5** — Inspeção dimensional + controle volume + log eventos
- ⬜ **Sprint 6** — Dashboard do chefe + métricas
- ⬜ **Sprint 7** — Alertas WhatsApp + go-live

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

**Antigravity** — Junior
Boituva, SP

Documentação relacionada (na pasta de outputs):
- `PRD_Pecsil_v2.md` — especificação completa do produto
- `Roadmap_Pecsil_v2.md` — plano de entrega por sprint
- `CHANGELOG.md` — histórico de mudanças do código
