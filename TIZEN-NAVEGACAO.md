# Navegação e reprodução Tizen

O aplicativo usa JavaScript puro, CSS e ícones SVG locais. Não carrega bibliotecas externas. A API webapis é fornecida pela própria Samsung.

## Módulos

- RemoteNavigation (js/navigation/remote.js): recebe setas e OK, impede o comportamento padrão e mantém o atalho de favorito por OK prolongado.
- FocusManager (js/navigation/focus-manager.js): mantém o elemento ativo e a classe focused. Não chama foco nativo nem atribui tabindex. A navegação entre regiões continua em spatial-navigation.js.
- GridScroller (js/navigation/grid-scroller.js): cada trilho tem uma instância. Calcula linha = floor(index / columns), altura = cardHeight + rowGap, limites e margem segura. Somente o transform do trilho muda.

O CSS final está em css/tizen-grid.css. O catálogo usa seis colunas; canais e episódios usam uma. Dimensões são lidas ao criar ou renovar o trilho, e não para descobrir linhas a cada tecla. Scale do card não altera offsetHeight, portanto não afeta o cálculo matemático.

Ao selecionar uma nova categoria, o app salva índice, limite carregado e deslocamento da anterior. Uma categoria nova começa no primeiro item; uma categoria visitada recupera sua posição. Na primeira coluna, esquerda retorna à categoria selecionada; direita da categoria recupera o card anterior. Direita no último card da linha não pula para a seguinte. Baixo numa última linha incompleta escolhe o último item disponível.

## Exemplo independente

Abra demo-grid.html: HTML, css/demo-grid.css e js/demo-grid.js compõem um exemplo offline com 43 filmes fictícios, duas categorias e memória de posição. Ele utiliza os mesmos módulos de navegação do aplicativo. Não precisa de conta IPTV.

## Player

Foi corrigido o uso incorreto de new webapis.avplay(). A API expõe o objeto webapis.avplay, cujo open inicia a sessão. O app registra os eventos, prepara assincronamente, configura o modo de exibição, reproduz e retoma a posição. O objeto application/avplayer e fundos transparentes deixam o plano nativo de vídeo visível.

Cada abertura tem uma geração; callbacks de uma sessão encerrada não podem controlar a seguinte. Stop/close são executados em um único caminho. Erros de preparação são exibidos como AVPlay com o nome do erro, sem mostrar credenciais.

Sem AVPlay, a prévia usa o vídeo HTML5 do navegador. HLS no desktop depende do suporte nativo do navegador, pois o pedido atual remove bibliotecas externas. A TV instalada usa AVPlay.

Referência: https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html

## Verificação

Execute node tests/tizen-regression.cjs para verificar clamp, zona segura, retomada AVPlay, encerramento e callbacks tardios. O teste usa um objeto AVPlay simulado: não comprova compatibilidade de codecs nem acesso ao servidor de IPTV da TV.

Reempacote e instale a versão atualizada na TV para testar a reprodução real. Recarregar o navegador do computador não atualiza o aplicativo instalado.
