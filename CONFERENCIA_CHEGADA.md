# Conferência de chegada no Desbaste

Serve para pegar a diferença entre o que a Fundição deu como entregue e o que chegou de fato no Desbaste. Exemplo: a OS tem 70 peças e chegaram 65.

## Contagem

- Na primeira vez que alguém inicia a OP do Desbaste daquele lote, o **Iniciar OP** pergunta "Quantas peças chegaram?", já preenchido com o que o sistema esperava. Sem confirmar, a OP não inicia.
- Aceita de 1 até o esperado.
- A OP de chegada é a primeira operação de estação **Desbaste** no roteiro do lote que vem depois de outra operação.
- OP que já estava em andamento antes desta versão não pede contagem.

## Quando falta peça

- O lote **continua valendo o total** (70). O Desbaste só tem disponíveis as peças que chegaram (65) e não consegue encerrar mais que isso.
- As 65 seguem normalmente para as próximas operações como parcial, mas o lote não fecha.
- Avisos:
  - cada conta PCP ativa recebe um aviso pessoal no sino;
  - a estação de onde as peças vieram (a Fundição) recebe um aviso no sino e uma **faixa vermelha fixa no topo do tótem**: "⚠ FALTA DE PEÇAS NO LOTE · OS 12950 · Lote 1: chegaram 65 de 70 peças no Desbaste — faltam 5". A faixa fica até as peças chegarem ou o PCP aceitar a falta;
  - os avisos dizem OS, artigo, lote, esperado, contado, quantas faltam e quem conferiu.
- O card do lote continua na fila do Desbaste com "⚠ Faltam X peças da chegada", mesmo depois de trabalhar tudo o que chegou.

## Como resolver

- **Chegaram peças**, botão do operador do Desbaste: informa quantas das que faltavam apareceram, e elas ficam disponíveis no Desbaste. Quando não falta mais nenhuma, o lote fecha normalmente.
- **Aceitar falta**, botão só do PCP ou admin, com confirmação: o lote passa a valer o que chegou (65). As operações que já fizeram as 65 fecham na hora. A próxima estação é avisada, a metalização externa registra a saída para o fornecedor se for o caso, e o lote e a OS são concluídos se for o fim do roteiro.
- A falta aceita não gera reposição automática. Se precisar repor, o PCP abre outra OS ou lote.

## Onde aparece

- **Timeline da OS:** a conferência, as peças que chegaram depois e a falta aceita, com autor e hora.
- **Painel de Produção:**
  - quadro "Faltas na chegada", com a lista de lotes com falta pendente;
  - selo "⚠ Faltam X da chegada" no card do kanban;
  - na trilha da OS, o Desbaste aparece como etapa atual.

## Deploy

Sem migration. A contagem fica registrada na timeline da OS (eventos `conferencia_chegada`, `conferencia_complemento` e `falta_aceita`), e os avisos usam o tipo `os_em_risco`.
