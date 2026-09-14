# Forja no desktop do tótem

Após merge e deploy da branch main no Coolify, abra o Forja no Chrome ou Edge usando HTTPS com certificado válido/confiável no tótem. HTTP em IP de rede ou domínio interno não habilita a instalação PWA; localhost é apenas a exceção de desenvolvimento. O certificado e o domínio são configurações do ambiente, não ficam resolvidos por este PR.

1. Abra o Forja e clique em **Instalar Forja** (disponível também no login).
2. Confirme a instalação no navegador. Se oferecido, selecione **Criar atalho na área de trabalho**. O navegador/Windows pode exigir a criação do atalho a partir do aplicativo instalado.
3. Abra pelo ícone Forja. A janela é independente, sem barra de endereço.
4. Faça login com a conta habitual da estação. O atalho não dispensa autenticação.

O ícone reaproveita a marca tipográfica do login: FORJA, vermelho #dc2626, peso 800, sobre fundo #0a0a0a. Os SVGs têm dimensões de 192 e 512 pixels e margem segura para recorte maskable; não dependem de imagem externa.

O service worker mantém os arquivos estáticos. API, Socket.IO, storage e health não recebem fallback de navegação. Apontamentos não são enfileirados offline e exigem conexão com o servidor.
Novas versões oferecem **Atualizar agora** ou **Depois**, para evitar recarga automática durante uma operação. Uma aba com o service worker antigo pode atualizar uma última vez pelo comportamento da versão anterior.

## Conferência no tótem
- Instalar em HTTPS, verificar ícone e abrir em janela própria.
- Confirmar login e acesso à estação, mantendo as permissões da conta.
- Confirmar que o botão de instalação desaparece no aplicativo instalado.
- Publicar uma versão e verificar que a atualização aguarda o clique.
- Em HTTP, verificar a instrução de acesso por HTTPS, sem promessa de instalação.

Referência: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
