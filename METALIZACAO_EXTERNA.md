# Metalização externa por lote

A decisão entre metalização **interna** (na Pecsil) e **externa** (fornecedor) é feita no **Desbaste**, ao iniciar a operação da estação que vem logo antes da Metalização no roteiro do lote. A decisão vale para o lote da OS, sem alterar o roteiro padrão do artigo.

## No Desbaste

- O **Iniciar OP** pergunta "Metalização deste lote": interna ou externa. Sem a resposta, a OP não inicia. Fornecedor é opcional.
- Nos reinícios (lote parcial), a escolha aparece já marcada e ainda pode ser trocada, enquanto a Metalização não tiver começado nem o lote tiver voltado.

## Externa

- A OP de Metalização **não entra na fila da Metalização**.
- Assim que é indicada, aparece **travada** (🔒) na estação seguinte (Encaixe e Arredondamento), na aba **METALIZAÇÃO EXTERNA**:
  - enquanto o Desbaste não fecha o lote inteiro: "Ainda no Desbaste (x de y peças)";
  - quando o Desbaste fecha o lote: o lote sai para o fornecedor (registrado na timeline com a hora real da saída) e o card passa a "No fornecedor desde ... · Aguardando retorno".
- **Confirmar retorno**: só a estação seguinte (o responsável do Encaixe), além de PCP e admin, e só depois que o lote saiu do Desbaste. Exige marcar que todas as peças voltaram. Conclui a Metalização pela quantidade enviada, sem apontamento peça a peça, e libera o Encaixe, que recebe o aviso de chegada.
- A Metalização não recebe aviso de chegada de lote externo.

## Interna

Nada muda: a Metalização recebe o lote e produz normalmente (máquina, operador, contagem). Ela não pergunta de novo.

## Lotes antigos

Lote que passou do Desbaste antes desta regra, sem escolha feita, ainda mostra a escolha interna/externa no Iniciar OP da própria Metalização. O retorno também é confirmado no Encaixe.

## Painel

- O kanban mostra o lote externo na coluna da estação que o recebe de volta, com "lote ainda no desbaste" ou "aguardando retorno".
- O resumo "Envio externo" conta só os lotes que já saíram da fábrica.

## Deploy

Sem migration nova. A migration `20260915180000_metalizacao_envio_externo` (da versão anterior) continua sendo a única necessária.
