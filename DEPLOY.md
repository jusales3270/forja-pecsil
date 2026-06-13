# Manual de Implantação — Forja na Pecsil

Guia passo-a-passo pra colocar o sistema Forja em produção no servidor on-premise da Pecsil.

**Quem usa este manual:** Junior (admin do sistema)
**Quando usar:** quando o MVP estiver pronto pra ir pro chão de fábrica

---

## Visão geral do que vai acontecer

Você vai pegar o sistema que hoje roda no seu Mac (em modo dev) e colocar pra rodar no servidor da Pecsil em modo produção. A diferença é:

- **Dev (seu Mac):** roda com `pnpm dev`, hot-reload, dados de teste
- **Produção (servidor Pecsil):** roda em containers Docker o tempo todo, dados reais, backup automático

A boa notícia: já está tudo containerizado. A implantação é basicamente:

1. Instalar Docker no servidor
2. Copiar o projeto pra lá
3. Mudar senhas pra produção
4. Subir com `docker compose up -d`
5. Aplicar migrations + seed
6. Configurar acesso externo (Cloudflare Tunnel ou Tailscale)
7. Configurar backup automático

---

## Pré-requisitos do servidor

### Hardware mínimo
- 8GB RAM (16GB recomendado)
- 100GB SSD livre
- CPU 4 núcleos
- Rede gigabit

### Sistema operacional
- Ubuntu 22.04 LTS ou superior (recomendado)
- Pode ser Windows com WSL2, mas Linux é mais simples

### Software pré-instalado
- Docker Engine + Docker Compose
- Git (pra clonar do repositório)
- `curl` e `wget`

### Verificar antes de começar
Roda no servidor:
```bash
docker --version
docker compose version
```

Se não tiver Docker: https://docs.docker.com/engine/install/ubuntu/

---

## Passo 1 — Preparar o servidor

### 1.1 Criar usuário dedicado pro Forja

Por segurança, não rode com usuário root.

```bash
sudo adduser forja
sudo usermod -aG docker forja
sudo su - forja
```

A partir daqui, todo comando roda como usuário `forja`.

### 1.2 Criar pastas de trabalho

```bash
mkdir -p ~/forja/backups
cd ~/forja
```

---

## Passo 2 — Copiar o projeto pro servidor

### Opção A — Via Git (recomendado se o código estiver em repositório)

```bash
cd ~
git clone <url-do-repositorio> forja
cd forja
```

### Opção B — Via SCP (transferência direta do seu Mac)

No seu Mac:
```bash
cd ~/forja
zip -r forja.zip . -x "node_modules/*" "*/node_modules/*" ".git/*"
scp forja.zip forja@<ip-do-servidor>:~/
```

No servidor:
```bash
cd ~
unzip forja.zip -d forja
cd forja
```

---

## Passo 3 — Configurar variáveis de ambiente de produção

⚠️ **CRÍTICO:** as senhas do `.env.example` são pra dev. Em produção, troca todas.

### 3.1 Gerar senhas seguras

```bash
# Gera senha aleatória de 32 caracteres
openssl rand -base64 32
```

Roda esse comando 4 vezes pra gerar:
- Senha do Postgres
- JWT_SECRET
- Senha do MinIO (admin)
- Senha do Evolution API

Guarda essas senhas num lugar seguro (gerenciador de senhas).

### 3.2 Criar `.env` de produção

```bash
cp .env.example .env
nano .env
```

Substitui **todas** as senhas. Exemplo:

```env
DATABASE_URL="postgresql://forja:<SENHA_FORTE_POSTGRES>@postgres:5432/forja"
REDIS_URL="redis://redis:6379"
JWT_SECRET="<32_CARACTERES_ALEATORIOS>"
NODE_ENV=production

MINIO_ENDPOINT="minio"
MINIO_PORT=9000
MINIO_ACCESS_KEY="forja_admin"
MINIO_SECRET_KEY="<SENHA_FORTE_MINIO>"
MINIO_BUCKET_DESENHOS="forja-desenhos"
MINIO_BUCKET_FOTOS="forja-fotos"
MINIO_PUBLIC_URL="https://forja-storage.suaempresa.com"

EVOLUTION_API_URL="http://evolution_api:8080"
EVOLUTION_API_KEY="<SENHA_FORTE_EVOLUTION>"
```

⚠️ **Atenção:** note que `MINIO_ENDPOINT` virou `minio` (nome do container) em vez de `localhost`. Isso porque dentro da rede Docker, os containers se enxergam pelos nomes.

### 3.3 Atualizar `docker-compose.yml` com as senhas

```bash
nano docker-compose.yml
```

Substitui também:
- `POSTGRES_PASSWORD: forja_dev_2026` → senha forte do Postgres
- `MINIO_ROOT_PASSWORD: forja_minio_dev_2026` → senha forte do MinIO
- `AUTHENTICATION_API_KEY: forja_evolution_dev_key_change_in_prod` → senha forte do Evolution

**Importante:** as senhas no `docker-compose.yml` e no `.env` devem **bater exatamente**.

---

## Passo 4 — Subir o sistema

### 4.1 Subir containers de infraestrutura

```bash
docker compose up -d postgres redis minio minio_setup
```

Aguarda ~30 segundos pros containers ficarem saudáveis:

```bash
docker compose ps
```

Todos devem estar `healthy` ou `running`.

### 4.2 Instalar dependências e fazer build

⚠️ Em produção, **não usa `pnpm dev`**. Faz build de produção:

```bash
# Instalar pnpm se não estiver instalado
npm install -g pnpm@9

# Instalar dependências
pnpm install --frozen-lockfile

# Build do shared
pnpm --filter @forja/shared build

# Build do backend
pnpm --filter @forja/backend build

# Build do frontend
pnpm --filter @forja/frontend build
```

### 4.3 Aplicar migrations

```bash
cd backend
pnpm prisma migrate deploy
```

Isso aplica todas as migrations no banco de produção.

### 4.4 Rodar seed inicial

```bash
pnpm db:seed
cd ..
```

Isso cria os usuários básicos (Junior, Ricardo, Rafael, etc).

⚠️ **CRÍTICO:** depois do seed, **muda os PINs de todos os usuários** que vão acessar o sistema. Os PINs padrão (`1234`) são pra dev.

Você muda os PINs via Prisma Studio ou criando um script de mudança.

---

## Passo 5 — Subir backend e frontend em modo produção

### 5.1 Criar serviço systemd para o backend

```bash
sudo nano /etc/systemd/system/forja-backend.service
```

Cola:

```ini
[Unit]
Description=Forja Backend
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=forja
WorkingDirectory=/home/forja/forja/backend
Environment="NODE_ENV=production"
EnvironmentFile=/home/forja/forja/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Salva (Ctrl+X, Y, Enter).

### 5.2 Habilitar e iniciar o serviço

```bash
sudo systemctl daemon-reload
sudo systemctl enable forja-backend
sudo systemctl start forja-backend
sudo systemctl status forja-backend
```

Deve mostrar `active (running)`.

### 5.3 Servir o frontend (nginx)

O frontend é build estático. Pode servir com nginx.

```bash
sudo apt install nginx -y
sudo cp -r ~/forja/frontend/dist/* /var/www/html/
sudo nano /etc/nginx/sites-available/forja
```

Cola:

```nginx
server {
    listen 80;
    server_name forja.pecsil.local;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/forja /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Agora os tótens da fábrica podem acessar `http://<ip-do-servidor>` ou `http://forja.pecsil.local`.

---

## Passo 6 — Configurar acesso remoto (pra você admin)

Você precisa acessar o servidor de fora da Pecsil pra dar suporte. **Duas opções recomendadas:**

### Opção A — Cloudflare Tunnel (recomendado)

Não precisa abrir porta no roteador da Pecsil. Mais seguro.

```bash
# Instalar cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Configurar (vai abrir navegador pra autenticar)
cloudflared tunnel login
cloudflared tunnel create forja-pecsil
cloudflared tunnel route dns forja-pecsil forja-pecsil.suaempresa.com
```

Cria arquivo de config:

```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: <tunnel-id-gerado>
credentials-file: /home/forja/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: forja-pecsil.suaempresa.com
    service: http://localhost:80
  - service: http_status:404
```

Roda como serviço:

```bash
sudo cloudflared service install
```

Agora acessa de qualquer lugar via `https://forja-pecsil.suaempresa.com`.

### Opção B — Tailscale

Mais simples se você já usa Tailscale.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

O servidor aparece na sua rede Tailscale com IP `100.x.x.x`. Acessa por ali.

---

## Passo 7 — Configurar backup automático

⚠️ **CRÍTICO.** Sem backup, um disco corrompido = perda total dos dados.

### 7.1 Script de backup

```bash
nano ~/forja/backup.sh
```

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR=~/forja/backups
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/forja_$DATE.sql.gz"

# Backup do Postgres
docker exec forja_postgres pg_dump -U forja forja | gzip > "$BACKUP_FILE"

# Mantém só os últimos 30 dias
find $BACKUP_DIR -name "forja_*.sql.gz" -mtime +30 -delete

echo "Backup concluído: $BACKUP_FILE"
```

```bash
chmod +x ~/forja/backup.sh
```

### 7.2 Agendar via cron

```bash
crontab -e
```

Adiciona:

```cron
# Backup diário às 2h da manhã
0 2 * * * /home/forja/forja/backup.sh >> /home/forja/forja/backups/backup.log 2>&1
```

### 7.3 Sincronizar backups pra storage externo

⚠️ Backup local **não é backup de verdade**. Servidor pode pegar fogo, ser roubado, etc.

Configurar sync pra **Backblaze B2** (barato) ou **AWS S3**:

```bash
# Instalar rclone
sudo apt install rclone -y
rclone config  # configura B2 ou S3

# Adiciona ao backup.sh:
rclone copy ~/forja/backups remote:forja-backups
```

---

## Passo 8 — Testar tudo

### Checklist pós-implantação

- [ ] `http://<ip-servidor>` abre o login
- [ ] Login com Junior (0001/PIN) funciona
- [ ] Backend health (`/health`) retorna ok
- [ ] MinIO Console acessível (via VPN/Tunnel, nunca exposto à internet)
- [ ] Backup automático rodou (verifica em `~/forja/backups/`)
- [ ] Acesso remoto via Cloudflare/Tailscale funciona
- [ ] Sistema sobrevive a reinicialização (`sudo reboot` e tudo volta)

---

## Operação do dia a dia

### Ver logs do backend

```bash
sudo journalctl -u forja-backend -f
```

### Ver logs dos containers

```bash
docker logs forja_postgres -f
docker logs forja_minio -f
```

### Reiniciar backend

```bash
sudo systemctl restart forja-backend
```

### Restaurar de backup

```bash
gunzip < ~/forja/backups/forja_<DATA>.sql.gz | docker exec -i forja_postgres psql -U forja forja
```

### Aplicar atualização do código

```bash
cd ~/forja
git pull  # ou copia novo zip
pnpm install --frozen-lockfile
pnpm --filter @forja/backend build
pnpm --filter @forja/frontend build
sudo cp -r frontend/dist/* /var/www/html/
sudo systemctl restart forja-backend

# Se tiver migration nova
cd backend
pnpm prisma migrate deploy
```

---

## Troubleshooting

### "Containers não sobem"
```bash
docker compose logs <nome_servico>
```

### "502 Bad Gateway no navegador"
Backend caiu. Verifica:
```bash
sudo systemctl status forja-backend
sudo journalctl -u forja-backend -n 100
```

### "Banco corrompido"
Restaura do backup mais recente (instrução acima).

### "Sem espaço em disco"
```bash
df -h
docker system prune -a  # remove imagens não usadas
```

### "Tótem não consegue acessar"
Verifica:
1. Tótem está na mesma rede do servidor?
2. Firewall do servidor permite porta 80? `sudo ufw status`
3. nginx está rodando? `sudo systemctl status nginx`

---

## Segurança

### Checklist mínimo

- [ ] Todas as senhas trocadas (sem nada de `dev_2026`)
- [ ] PINs dos usuários iniciais trocados após go-live
- [ ] Firewall liberando só portas necessárias (80, 443, SSH)
- [ ] SSH com chave (não senha)
- [ ] Backup automático funcionando + sync externo
- [ ] Acesso remoto via Cloudflare Tunnel ou Tailscale (não exposto direto)
- [ ] MinIO **nunca** exposto à internet pública

### Senhas a guardar com cuidado

Em gerenciador de senhas (Bitwarden, 1Password, etc.):

1. Senha root do servidor
2. Senha do usuário `forja` no servidor
3. Senha do Postgres
4. JWT_SECRET
5. Senha do MinIO
6. Senha do Evolution API
7. Token do Cloudflare Tunnel

---

## Quando algo dá errado de madrugada

Ordem de troubleshooting:

1. **Backend caiu** → `sudo systemctl restart forja-backend`
2. **Container caiu** → `docker compose restart <servico>`
3. **Disco cheio** → `docker system prune -a`
4. **Banco bagunçou** → restaurar backup (CTRL+F "Restaurar de backup")
5. **Servidor não responde** → reiniciar fisicamente

Se nada disso resolver, fala comigo (Junior) ou com a Antigravity.

---

## Contatos de emergência

- **Junior (Antigravity):** [seu telefone]
- **Provedor de hosting de backup:** [se aplicável]
- **Provedor de domínio:** [se aplicável]

---

**Fim do manual.**
