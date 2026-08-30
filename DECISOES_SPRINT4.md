# Decisões — Sprint 4

## Bloco C — Fundição: ETAPA ÚNICA (decidido 13/06/2026)

O roadmap v4 previa subetapas internas da fundição (modelo, fundição,
rebarbação, tratamento, jateamento) como checkpoints. Decisão: NÃO modelar
subetapas agora. A fundição opera como etapa única no tótem, igual às demais
estações (validado em browser: OS 211331 passou por iniciar/encerrar/+1 peça).

Motivo: nenhuma validação presencial foi feita ainda. Modelar 5 subetapas sem
ver a operação real da fundição no chão é aposta cega com custo de retrabalho de
schema. Barato adiar, caro errar.

Interface desktop da fundição: já coberta — o tótem é a mesma PWA, layout
desktop, funcionou no PC no teste.

Consequência: Bloco C fechado sem código novo. Reabrir só se a validação
presencial mostrar que as subetapas têm estações/pessoas distintas e que lotes
esperam entre elas (onde gargalo e lote fantasma se escondem).

## Pergunta adicionada à pauta da validação presencial na fábrica

A fundição tem subetapas em estações/pessoas separadas, com lotes esperando
entre elas? Ou é um programador tocando o lote do início ao fim no mesmo PC?
(Decide se subetapas viram modelo ou seguem como etapa única.)

## Pendências técnicas registradas (não-bloqueantes)

- Validação Zod falhando retorna HTTP 500 em vez de 400 (visto em
  /api/lotes-fantasmas?horas=0). Padronizar tratamento de erro de input.
- Bug de `.data` duplicado: corrigido em NovaOSModal.tsx; provável que persista
  em OSListPage.tsx (mesmo erro de tipo apontado pelo tsc).

## Achados de design — LEVAR À VALIDAÇÃO PRESENCIAL (descobertos 13/06 no teste)

1. **"+1 peça" credita a peça a quem está LOGADO no tótem, não ao operador
   designado no carimbo.** No teste, o Japonês (programador) iniciou a OP
   escolhendo Douglas como operador, mas as 3 peças foram creditadas ao Japonês
   (quem clicou). Origem: apontamento-peca.ts usa request.user.pessoaId.

2. **Conferência de turno é por "quem registrou", não por "quem operou"** —
   consequência direta do item 1.

Para "controle interno de produtividade" (resposta do Ricardo, pendência #1),
isso pode estar TROCADO: a produtividade ficaria no nome do programador, não do
operador que produziu. Decisão de negócio, não bug. Confirmar na fábrica:
quem deve "assinar" a peça — quem está no tótem ou o operador da máquina?
Se for o operador, mudar o registro para receber operadorId explícito (vindo
do carimbo em andamento) em vez do usuário logado.

## Débito de modelagem — Motivo de Parada / Downtime (adicionado 21/07/2026)

**Contexto:** o cadastro legado "Tipos de Serviço" (planilha Pecsil) mistura
dois domínios num catálogo só: operações reais de roteiro — as que viraram
`Etapa`/`OperacaoArtigo` no forja (Metalização, Torno, Acabamento...) — e
motivos de parada de máquina, sinalizados na coluna `Motivo de Parada = Sim`
(Limpeza, Quebra de Máquina, Falta de Projeto, Falta de Material, Setup,
Quebra de Ferramenta, Troca de Ferramenta, Ajuste de Máquina, Controle de
Medição, Falta de Operador, Micro Parada, Serviço de Terceiros). O forja hoje
só migrou a primeira metade. Não existe model nem tela para motivo de parada;
`Carimbo` só tem `observacoes` (texto livre, não estruturado).

**Por que importa:** sem isso não dá pra calcular disponibilidade de
máquina/OEE nem diferenciar, no dashboard e no alerta de lote fantasma, uma
máquina parada por falta de material de uma parada por quebra — hoje os dois
casos aparecem como "carimbo aberto há X horas sem encerrar" e mais nada.

**Opções de modelagem avaliadas:**

1. *Reaproveitar o cadastro de Tipos de Serviço, com um campo `categoria`
   (`operacao` | `parada`).* Migração de dados trivial (importa a planilha
   direto), mas mistura dois domínios semânticos diferentes na mesma
   tabela/tela — polui o formulário de roteiro e a tela de OS com opções que
   não fazem sentido ali.
2. *Cadastro `MotivoParada` dedicado + model `ParadaMaquina` vinculado a
   `Carimbo`/`ProcessamentoMaquina`* (`inicio`, `fim`, `motivoId`,
   `planejada: boolean`). Separação limpa de domínio e suporta múltiplas
   paradas dentro do mesmo carimbo, mas exige migration e tela novas.
3. *Campo `motivoParadaId` nullable direto em `Carimbo`.* Mais simples de
   encaixar no fluxo atual do tótem (um select na hora de pausar), mas não
   aguenta duas paradas diferentes dentro da mesma OP em andamento — perde
   granularidade pro cálculo de OEE.

**Recomendação:** opção 2, mas migrando só as ~13 linhas do legado que são de
fato motivo de parada (não as 49). Manter `planejado: boolean` (mapeando a
coluna "Motivo de Parada Planejado" do legado — hoje vazia na planilha, mas
existe pra separar parada programada de não programada). No Tótem, isso vira
um botão "Pausar" na tela de OP em andamento, ao lado de "Encerrar", que abre
modal de motivo — sem sair do fluxo atual de iniciar/encerrar.

Não bloqueante agora — só entra em jogo quando o dashboard de OEE/métricas
(Sprint 6) for escopado. Registrado aqui pra não se perder.

## REVERTE Bloco C: fundição ganha operações internas (reunião com o PCP, 15/08/2026)

A decisão de 13/06 (fundição como etapa única) **cai**. A pergunta que estava
na pauta da visita — "a fundição tem subetapas?" — foi respondida pelo Rafael:
sim, e ele definiu a sequência.

**Operações da fundição**, nesta ordem:
`Modelação → Moldagem → Vazamento → Rebarbação → Tratamento Térmico`

- O OK de cada operação é do **Guilherme**.
- **Tratamento térmico entra no lugar do Controle de Qualidade** — na fundição
  não há CQ: quem confere é o desbaste, ao receber a peça, antes de pôr na
  máquina.
- Tratamento térmico registra **início e fim**, ciclo de ~3 dias. Não precisa de
  "pendente/em andamento" ("o que entra tem que sair"). Pode rodar parcial: a
  engenharia já programa com o parcial, mas **só libera para o desbaste com o
  lote todo tratado**.

**Implementado como operações, não como Etapas novas** — é o termo que o próprio
PCP usou, e o modelo atual já suporta: o roteiro do Artigo tem N operações, cada
uma apontando para uma Etapa. Todas as cinco apontam para Fundição, então
aparecem em sequência no tótem daquela estação. Nenhuma estação nova no tótem.

`TRATAMENTO TÉRMICO` **não existia** no catálogo dos 49 códigos do GRV —
cadastrado como código **50**.

## Alerta parcial: a etapa seguinte não espera o lote fechar (15/08/2026)

Os "loopings" que o PCP pediu. A engenharia é acionada **várias vezes** ao longo
do processo, por eventos de etapas posteriores a ela:

```
Fundição (tratamento térmico)
   └─→ avisa ENGENHARIA → programa de "desbaste + metalização" (os dois de uma vez)
Metalização (peça a peça)
   └─→ ao atingir N peças → avisa ENGENHARIA → programa de "encaixe + arredondamento"
   └─→ segue para Encaixe
```

**Modelagem:** `gatilhoAlertaPecas` em `OperacaoArtigo` (padrão do roteiro) e em
`OPLote` (ajustável por lote), mais `OPLote.alertaParcialEm` para o disparo
acontecer uma única vez. Migration `20260815220332_add_gatilho_alerta_pecas`.

- O disparo acontece no `POST /apontamento-peca`, ao cruzar a quantidade, e
  emite `op:parcial-pronta` via Socket.IO.
- **O número não pode ficar engessado.** Quem define na prática é o chão de
  fábrica (o Domingo), que não usa o sistema — liga para o PCP. Por isso
  `PATCH /op-lote/:id/gatilho-alerta` permite ao PCP mudar por lote, na hora
  ("é 10, mas preciso agora os cinco para adiantar"). Validado contra o tamanho
  do lote; baixar o gatilho rearma o alerta.
- Valor inicial: **10 peças na metalização**, número que o Rafael estimou. A
  confirmar com o pessoal da metalização (quantas peças/dia eles fazem).

**Pendências que a própria reunião registrou:**
- Perguntar à metalização a produção diária, para calibrar o gatilho.
- Confirmar o fluxo físico: jateamento → metalização → alívio de tensão (forno
  600°) → estufa. Estimado em 1-2 dias, ninguém tinha certeza.
- Tempos das operações da fundição — o roteiro está com 0, a levantar.
- Conversas futuras com engenharia e fundição podem reajustar tudo isso.

## Decisão do PCP: Travar Máquina descartada, Motivo de Parada é prioridade (21/07/2026)

Conversa com o PCP resolveu as duas pendências em aberto sobre o cadastro
legado de Tipos de Serviço:

1. **"Travar Máquina" (item 5 do levantamento) — NÃO será usado.** Tinha sido
   implementado como POC (campo `travaMaquina` em `OperacaoArtigo`/`OPLote`,
   validação no `POST /op-lote/:id/iniciar`) pra testar a ideia de prender uma
   operação parcial à mesma máquina entre carimbos. O PCP decidiu que não é
   necessário — revertido por completo (schema, migration, backend, frontend).
   Fica registrado que a ideia foi avaliada e descartada, caso surja de novo.

2. **"Motivo de Parada" (item 4 do levantamento, opção 2 acima) — CONFIRMADO
   como prioridade**, especificamente para alimentar o **Painel de Produção
   do chefe** (acompanhamento do fluxo de produção em tempo real). Implementado
   conforme a recomendação já registrada: `MotivoParada` (catálogo, com
   `codigo`, `nome`, `planejado`, `capturaAutomaticaIot`) + `ParadaMaquina`
   (N por `Carimbo`, `inicio`/`fim`/`observacoes`/`registradoPor`).

   - Tótem: botão "Pausar" no card de OP em andamento → modal de motivo →
     `POST /op-lote/:id/pausar`. Card fica vermelho com "⏸ PARADO — <motivo>
     desde Xmin" e troca pra botão "Retomar" (`POST /op-lote/:id/retomar`).
     Encerrar a OP fecha automaticamente qualquer parada aberta (não deixa
     pendurada).
   - Painel de Produção (`/dashboard`): dois cards novos — "Máquinas paradas
     agora" (lista ao vivo, com motivo e minutos parado) e "Tempo parado
     hoje, por motivo" (agregado, ordenado por minutos — a base do indicador
     de disponibilidade/OEE que faltava).
   - Cadastro: tela `/motivos-parada` (mesmo padrão de Tipos de Serviço),
     atalho na Home em "Cadastros".

   Pendente pro PCP popular: os motivos reais migrados do legado (Limpeza,
   Quebra de Máquina, Falta de Material, Setup, Quebra/Troca de Ferramenta,
   Ajuste de Máquina, Controle de Medição, Falta de Operador, Micro Parada,
   Serviço de Terceiros) ainda não foram cadastrados via tela — o catálogo
   está vazio em produção até alguém inserir.

## Fases da fundição visíveis no tótem e no painel + alerta do tratamento térmico (29/08/2026)

Duas coisas que a caminhada pela fábrica com o Rafael deixou claras:

**1. A fundição é a única etapa com processo interno.** Saindo dela, cada etapa
de usinagem é "processo único" — a peça entra, faz e sai, não circula. Só que
como as 5 operações da fundição apontam pra mesma Etapa, o tótem mostrava dois
baldes ("Em andamento"/"Pendentes") sem dizer em qual das fases cada OS estava.
O painel do chefe tinha o mesmo buraco: a coluna "Fundição" do kanban é um
número só, sem previsibilidade de cadenciamento dentro da etapa mais longa
(~7 dias).

**2. O aviso do tratamento térmico é o gargalo real.** O ciclo leva 2-3 dias e
hoje ninguém avisa a engenharia que uma OS entrou no forno — o Domingo descobre
de passagem, e quando não descobre, a peça fica parada esperando programa. Esses
2-3 dias são exatamente a janela pra programar o desbaste.

### Como ficou

**Fases são cadastro, não código.** `TipoServico.ordemNaEtapa` (1..N) define a
posição do serviço dentro da etapa. Nulo = etapa de processo único, e a tela
segue idêntica ao que sempre foi. Só a fundição recebeu valores:

| ordem | código | tipo de serviço |
|-------|--------|-----------------|
| 1 | 20 | MODELAÇÃO |
| 2 | 15 | MOLDAGEM |
| 3 | 17 | VAZAMENTO |
| 4 | 7  | REBARBAÇÃO FUNDIÇÃO |
| 5 | 50 | TRATAMENTO TÉRMICO |

Os outros 3 códigos que a fundição herdou do GRV (6 FORNO INDUÇÃO, 12 SERRA,
16 LEVANTAMENTO) ficaram sem ordem de propósito — não fazem parte da sequência
que o Rafael definiu. Se aparecerem numa OS, o pipeline os mostra num aviso de
"fora das fases cadastradas", em vez de sumir com eles.

`montarPipelineEtapa()` (`backend/src/lib/pipeline-etapa.ts`) é a fonte única:
o tótem chama por `GET /api/etapas/:id/pipeline`, o painel recebe no bloco
`pipelines` do `GET /api/dashboard`. O que o chefe vê é literalmente o que o
chão de fábrica vê.

**Faixa de fluxo** (`PipelineEtapa.tsx`) nas duas telas: as 5 fases ligadas por
seta, contador por fase, quantos rodando/na fila/parado, há quanto tempo está a
OS mais antiga da fase e a lista dos GRV. No tótem ela filtra a lista abaixo;
no painel é só leitura, seguida da tabela "Ciclo de TRATAMENTO TÉRMICO" (OS,
artigo, cliente, tempo no ciclo, se já avisou a engenharia e quando).

**Alerta ao iniciar.** `avisaAoIniciar` + `alertaInicioEm` em `OperacaoArtigo` e
`OPLote` — par simétrico ao `gatilhoAlertaPecas`/`alertaParcialEm` que já
existia, usando o mesmo `etapaAvisadaId`. Ao apontar o início do tratamento
térmico no tótem (o momento em que o Guilherme põe a peça no forno), o
`POST /op-lote/:id/iniciar` cria o `Alerta` e emite `op:fase-iniciada`. Dispara
**uma vez só**: reiniciar depois de um encerramento parcial não alerta de novo.

**O alerta é da ESTAÇÃO, não de pessoas.** `Alerta.etapaDestinoId` endereça o
aviso à etapa avisada, e `destinatarioId` virou opcional. Quem abrir o tótem da
Engenharia vê o aviso — não importa quem está logado nem quem foi cadastrado com
qual papel. A primeira versão mandava pra toda pessoa com papel `engenharia`,
`programador` ou `pcp`, o que era frágil de dois jeitos: dependia de existir
alguém cadastrado com aquele papel (não existia), e espalhava o aviso pra
programadores de outras estações que não têm nada a ver com aquilo. O aviso da
metalização (gatilho de peças) usa o mesmo mecanismo.

Marcar como lido é da estação também: qualquer um que esteja ali pode limpar,
como quem apaga do quadro da parede.

O enum `TipoAlerta` ganhou `fase_iniciada` e `parcial_pronta` — este último
substitui o `lote_parado` que o gatilho de peças usava como placeholder.

Continua valendo: **os alertas ficam dentro da aplicação**. WhatsApp segue
adiado pro Sprint 7.

### O que replicar em cada ambiente (não vai no deploy)

```sql
-- 1) as 5 fases da fundição
UPDATE tipos_servico SET ordem_na_etapa = CASE codigo
  WHEN 20 THEN 1 WHEN 15 THEN 2 WHEN 17 THEN 3 WHEN 7 THEN 4 WHEN 50 THEN 5 END
WHERE codigo IN (20, 15, 17, 7, 50);

-- 2) artigos que já tinham o roteiro de fundição aplicado ANTES desta mudança
--    não têm o aviso ligado. Conferir:
SELECT count(*) FROM operacoes_artigo WHERE tipo_servico ILIKE '%TRATAMENTO%';
--    Se houver, o PCP reaplica o roteiro na aba Operações do artigo.
--    Em dev, na data desta mudança, não havia nenhum.
```

### Ainda aberto

- **Passos que o Rafael descreveu e não estão no roteiro**: cura do molde
  (12h–1 dia), resfriamento na areia (12h), jato de granalha (entre rebarbação
  e forno), e o fato de a **rebarbação ser terceirizada** (a peça sai de
  caminhão e volta). Hoje nada disso é visível no sistema.
- **Sub-fluxo da coquilha**: verificar se existe → serve? → senão fabricar em
  madeira/3D e fundir. É um ativo reaproveitável, não uma etapa linear.
- Tempos das 5 operações continuam zerados, a levantar com a fundição.

## Fundição fiel ao chão de fábrica: terceiros, esperas e trava do forno (30/08/2026)

A caminhada com o Rafael (29/08) mostrou que o roteiro de 5 operações descrevia
menos do que a fundição faz. Faltavam três coisas, e nenhuma é detalhe:

**1. A rebarbação é feita FORA.** A peça sai de empilhadeira, vai de caminhão pro
terceiro e volta. Antigamente era interna. O sistema tratava como operação normal
— abria máquina para trabalho que acontece em outra empresa.

**2. Duas esperas obrigatórias que ninguém via.** Cura do molde (12h, às vezes um
dia) antes de montar na linha, e resfriamento na areia (12h) antes de desmoldar.
São 24h de calendário que não apareciam em lugar nenhum, mas que o PCP precisa
contar quando promete prazo.

**3. Jato de granalha.** Interno, entre o retorno da rebarbação e o forno. Não
existia no roteiro.

E a regra que o Rafael repetiu: **o que sai parcial do forno não desce pro
desbaste**. Isso estava só como texto numa observação — o sistema deixava iniciar
o desbaste com o lote metade tratado.

### Como ficou

Três campos novos em `OperacaoArtigo`/`OPLote`, todos data-driven:

| campo | pra quê |
|---|---|
| `terceirizada` + `fornecedor` + `prazoPrevistoDias` + `custoPrevisto` | operação fora da fábrica |
| `esperaHoras` | operação que é só o relógio |
| `exigeLoteCompleto` | trava a operação seguinte até o lote fechar aqui |

`POST /op-lote/:id/iniciar` passou a aceitar OP **sem máquina e sem operador**
quando ela é terceirizada ou de espera — o carimbo marca só o relógio, e nenhum
`ProcessamentoMaquina` é aberto. `Carimbo.maquinaId` já era nullable, então não
precisou de mudança estrutural.

A guarda do `exigeLoteCompleto` roda no início de qualquer OP: se existe uma OP
anterior no lote marcada assim e ainda não concluída, devolve 409 dizendo quantas
peças faltam. Fechado o lote, libera.

**O roteiro da fundição foi de 5 para 8 operações:**

```
1 Modelação   2 Moldagem   3 Cura do molde (12h)   4 Vazamento
5 Resfriamento na areia (12h)   6 Rebarbação (FORA, 3d)
7 Jato de granalha   8 Tratamento térmico (avisa eng. + exige lote completo)
```

Três tipos de serviço novos no catálogo: **51 CURA DO MOLDE**, **52 RESFRIAMENTO
NA AREIA**, **53 JATO DE GRANALHA**.

No tótem o botão muda conforme a OP: "🚚 Enviar" na terceirizada, "⏳ Iniciar
espera (12h)" nas esperas, "Iniciar OP" no resto — e o modal esconde máquina e
operador explicando por quê. A faixa de fluxo mostra "⏳ libera em 8h" e "🚚 fora
da fábrica" no lugar do tempo comum. Com 8 fases as caixas apertam sozinhas, pra
o tratamento térmico não sair da tela.

### O que replicar em cada ambiente

```sql
-- os 3 tipos de serviço novos (ou cadastrar pela tela)
-- e depois a ordem das 8 fases:
UPDATE tipos_servico SET ordem_na_etapa = CASE codigo
  WHEN 20 THEN 1 WHEN 15 THEN 2 WHEN 51 THEN 3 WHEN 17 THEN 4
  WHEN 52 THEN 5 WHEN 7 THEN 6 WHEN 53 THEN 7 WHEN 50 THEN 8 END
WHERE codigo IN (20,15,51,17,52,7,53,50);
```

### Ainda aberto

- **Sub-fluxo da coquilha** — verificar se existe, se serve, senão fabricar em
  madeira/3D e fundir. Hoje está só como observação na modelação.
- Tempos de execução das operações continuam zerados.
- O prazo de 3 dias da rebarbação terceirizada é chute — confirmar com quem
  controla o envio.
