# Recuperação do Forja na intranet

Recuperação em **outro banco, no mesmo PostgreSQL**, sem apagar, mesclar ou
substituir o banco usado hoje. O endereço `forja.pecsil` permanece.

## Antes do redeploy

O container antigo contém `prisma/backup_data.sql`. Extraia essa cópia antes de
trocar a imagem: esta branch retira o dump do Git atual e das novas imagens.
O histórico do Git ainda contém o arquivo; esta mudança não remove a exposição
histórica. Restrinja o repositório e trate as credenciais publicadas separadamente.

No **Terminal do servidor local** no Coolify (ou SSH já existente):

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

Identifique o backend do Forja. Não use o Postgres ou o frontend nesse comando.
Obtenha a branch em uma pasta administrativa separada:

```bash
git clone --branch fix/recovery-intranet https://github.com/jusales3270/forja-pecsil.git forja-recovery
cd forja-recovery
bash ops/recover-coolify.sh NOME_EXATO_DO_BACKEND inspect
```

O script extrai o SQL para `recovery-data/` no servidor, com permissão restrita,
e instala somente a ferramenta administrativa no container. Não reinicia o
backend nem altera dados. Usa Node, Prisma e psql existentes na imagem atual.
Para usar um dump mais recente, SQL texto com dados de todas as tabelas:

```bash
SOURCE_BACKUP=/caminho/backup-mais-recente.sql bash ops/recover-coolify.sh NOME_EXATO_DO_BACKEND inspect
```

## Conteúdo confirmado da cópia de 10/09/2026

| Conteúdo | Quantidade |
|---|---:|
| Artigos | 3.876 |
| Pessoas / contas vinculadas a estações | 27 / 14 |
| Clientes | 8 |
| Etapas / máquinas | 12 / 17 |
| Tipos de serviço | 40 |
| Operações de artigos / de lotes | 52 / 52 |
| OSs / lotes | 4 / 4 |
| Apontamentos de peças | 35 |
| Operações de tratamento térmico com aviso à Engenharia | 4 |
| Avisos históricos | 1 |

SHA-256: `a135e2e56576575647a9922f3af9d48edcae8a5070973c2cecdb6eedb26aaa2c`.

Essa cópia não contém desenhos, tolerâncias gerais de clientes ou planos de
inspeção. Não contém gatilhos por quantidade configurados nas operações de
artigos/lotes; os roteiros no código continuam oferecendo essa função.
Se esses cadastros existiam em outra instalação, obtenha a cópia correta dela.
O SQL não inclui arquivos físicos do MinIO.

## Criar a base recuperada

Depois de conferir origem e relatório, use um nome **novo**:

```bash
bash ops/recover-coolify.sh NOME_EXATO_DO_BACKEND recover forja_recuperado_20260910
```

Se escolheu `SOURCE_BACKUP`, mantenha a mesma variável neste comando.

A ferramenta confere tabelas, colunas e referências antes de conectar; cria
outro banco (recusando destinos existentes); aplica migrations somente nele;
importa na ordem das relações, em uma transação com FKs habilitadas; confere
contagens antes de confirmar. SQL executável, comandos psql e histórico de
migrations do dump são ignorados. IDs, hashes e marcas de avisos são preservados.

Não altere `DATABASE_URL` se falhar. Erro de importação reverte todos os dados
da tentativa; o banco novo vazio fica para inspeção. Outra tentativa exige
outro nome. O usuário Postgres precisa ter permissão para criar banco.
A ferramenta não muda automaticamente a conexão da aplicação.

## Apontar somente o serviço local para a base verificada

Após sucesso e conferência:

1. Pause novos lançamentos durante a troca. Dados posteriores ao backup não
   estão automaticamente na base recuperada.
2. No projeto **local** do Coolify, guarde a `DATABASE_URL` anterior.
3. Selecione a branch `fix/recovery-intranet` (ou o commit revisado).
4. Em `DATABASE_URL`, mantenha usuário, senha, host e porta. Troque **somente o
   nome do banco**. Exemplo sem credenciais reais:
   `postgresql://USUARIO:SENHA@postgres:5432/forja_recuperado_20260910`.
5. Salve e faça o deploy local. Não altere `POSTGRES_DB`, volumes ou o projeto
   da nuvem. A inicialização corrigida não executa `db push`, seed ou restore.

Confira login, artigos, OSs, etapas das operações, contas de estação e avisos.
Teste alertas numa OS de homologação; não avance OSs reais para testar.
O aviso histórico mantém sua marca de envio, sem duplicação ao reiniciar a OP.

Para desfazer a troca, restaure a `DATABASE_URL` anterior usando o código corrigido.
Isso não incorpora no banco anterior lançamentos feitos na base recuperada.

## Validação automatizada

O workflow `Database recovery` usa PostgreSQL 16 descartável e dados sintéticos.
Verifica cópia integral, preservação da origem, rejeição de destino existente,
rollback em erro SQL, login, aviso no início, aviso por quantidade e ausência de
duplicação ao reiniciar a operação. Não usa dados reais da Pecsil.
