# Chat interno entre estações

O sino fica visível em qualquer estação observada. A caixa é da conta autenticada:
em **Mensagens recebidas**, aparecem seus recados e os avisos automáticos da sua
estação; em **Mensagens enviadas**, aparecem seus envios e o horário de leitura.
As caixas atualizam os recados a cada cinco segundos enquanto a página está ativa.

**Criar mensagem** permite escolher a estação, buscar o responsável pelo nome ou
login, selecionar sua conta e escrever até 4.000 caracteres. O servidor registra
o nome do remetente autenticado e a data/hora. **Responder** envia um novo recado
ao autor original, mantendo o vínculo com a mensagem anterior. A leitura é uma
ação explícita e preserva o horário da primeira confirmação.

Somente o remetente e o destinatário têm acesso ao recado. Para recebê-lo, marcar
como lido ou responder, o destinatário precisa continuar ativo e ter vínculo com
a estação de destino ou o papel atual de administrador. Esse papel permite
atuar em todas as estações ativas, mas nunca acessar recados de terceiros.
A API consulta o vínculo e papel atuais, mesmo com JWT antigo. O histórico de
envios continua pertencendo ao remetente. Se um autor comum mudou de estação,
a resposta é recusada; crie uma nova mensagem escolhendo seu destino atual.

Cada pessoa precisa entrar com sua própria conta. Uma credencial de estação
compartilhada representa um único destinatário para o sistema. Contas comuns
sem vínculo mantêm o sino, mas precisam de uma estação ativa para enviar e
receber recados. Administradores podem enviar sem estação fixa e aparecem como
destinatários em todas as estações ativas. Quando não têm estação ativa vinculada,
a estação escolhida no envio registra o contexto da mensagem, sem alterar o
cadastro. Respostas voltam à conta do administrador e continuam privadas.
Essa correção de permissões não exige migration adicional.
Os avisos automáticos continuam compartilhados apenas com as contas da estação.

## Ativar no Coolify local

Esta versão inclui a migration `20260911150000_mensagens_internas`, que cria uma
tabela e seus índices/chaves. Ela não altera os cadastros, OSs ou artigos existentes.

1. Preserve um backup atualizado e publique a versão revisada desta alteração.
2. Mantenha `DATABASE_URL` apontando para a base recuperada já em uso,
   `forja_recuperado_20260911`. Mantenha volumes, `POSTGRES_DB` e domínio.
3. Após o deploy, no terminal do **novo container backend**, execute:

   ```sh
   cd /app/backend
   pnpm exec prisma migrate deploy
   ```

   Confira que a saída identifica o banco recuperado esperado. O histórico dessa
   base já é gerenciado por migrations. Se houver erro de baseline ou migrations
   antigas pendentes inesperadamente, interrompa a ativação e investigue; não use
   reset, seed ou `db push`. A aplicação não executa migrations automaticamente.
4. Confira `pnpm exec prisma migrate status`. Saia e entre novamente. Envie um
   recado entre duas contas de homologação, responda e confira a leitura. Uma
   terceira conta da mesma estação destinatária deve continuar sem acesso.

Até a migration ser aplicada, o painel informa falha ao carregar recados;
isso não significa que a caixa está vazia. Não é necessário restaurar o banco
novamente para ativar o chat. Reverter apenas o código preserva a tabela e o histórico.

## Backups anteriores ao chat

Backups novos devem incluir `mensagens_internas`, suas assinaturas, leituras e
respostas. O recuperador continua recusando tabelas ausentes por padrão.
Ao recuperar uma cópia comprovadamente anterior ao chat em **outro banco**, use
`--allow-missing-messages` tanto em `--inspect` quanto em `--database` no comando
`node ops/recover-database.mjs`. Essa opção permite somente a ausência da tabela
de mensagens, criada vazia, e registra um aviso no relatório. As demais tabelas
continuam obrigatórias. Não use essa opção para backups feitos após ativar o chat.

## Validação

O workflow Database recovery testa envio, leitura, resposta, destinatário
incorreto, outro usuário da mesma estação, administrador, mudança de vínculo,
inativação, JWT antigo, repetição de envio e preservação do histórico no restore.
Os testes React verificam o sino, as caixas, o formulário, a resposta, erro de
envio com preservação do texto e isolamento de cache entre credenciais.
