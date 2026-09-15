# Metalização externa por lote

Na estação Metalização, **Escolher metalização** abre as opções interna na Pecsil e externa. A decisão vale para o lote da OS, sem alterar o roteiro padrão do artigo.

- **Interna:** exige máquina e operador; mantém a contagem e o encerramento existentes.
- **Externa:** antes de iniciar a produção interna, registra o envio do lote inteiro. Todas as peças precisam ter chegado à Metalização. Fornecedor e observações são opcionais.
- O lote fica na aba **ENVIO EXTERNO**, sem liberar peças para a operação seguinte. Não ocupa máquina, não permite contagem, pausa, retomada ou encerramento comum.
- **Confirmar recebimento:** exige marcar que todas as peças retornaram metalizadas e prontas. Conclui pela quantidade registrada no envio, sem criar apontamentos peça a peça. Se o roteiro exigir inspeção, mantém essa exigência.
- A conta da Metalização pode enviar e receber. As permissões existentes de PCP/admin e programadores são mantidas; contas de outras estações são recusadas.
- Envio e recebimento ficam na timeline da OS com data, autor, quantidade e fornecedor. Cliques concorrentes não duplicam envio ou recebimento.

OS com vários lotes pode ter decisões diferentes por lote. Remessas parciais e recebimento parcial não fazem parte desta regra: não confirme enquanto faltarem peças.

## Deploy

Aplicar a migration `20260915180000_metalizacao_envio_externo` no banco existente:

```sh
cd /app/backend && pnpm exec prisma migrate deploy
```

A migration somente adiciona campos e uma restrição de consistência. Não exige seed nem restauração. Mantém o endereço HTTP e a configuração do Coolify existentes.
