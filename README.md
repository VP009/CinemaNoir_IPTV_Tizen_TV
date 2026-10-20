# Cinema Noir para Samsung Tizen TV

Aplicativo Web para listas Xtream, feito somente em HTML, CSS e JavaScript tradicional. O app da TV fica em `app/`, as funções serverless em `api/` e a interface de pareamento móvel em `pair/`. Os dados do app são armazenados localmente por perfil e as chamadas vão diretamente ao servidor configurado.

## APK para Android TV / TV Box

O diretório `android-tv/` é um projeto Android TV independente. Ele mantém a interface em `app/`, mas reproduz em tela cheia com **AndroidX Media3 (ExoPlayer)**, não com AVPlay. Assim, funciona em TV Boxes Android com HLS (`.m3u8`), MPEG-TS e os formatos que o decodificador do aparelho suportar.

1. Abra `android-tv/` no Android Studio (JDK 17 e Android SDK 35).
2. Execute `Build > Build APK(s)`; o arquivo de instalação será criado em `android-tv/app/build/outputs/apk/debug/app-debug.apk`.
3. Instale esse APK na TV Box. O aplicativo aparece também no launcher Android TV, abre em paisagem e aceita HTTP para servidores IPTV configurados pelo usuário.

O player usa a decodificação de hardware disponível na própria TV Box. Compatibilidade com codecs além de H.264/AVC (por exemplo HEVC) depende do chip do aparelho e do stream do provedor.

## Importar no Tizen Studio

1. Instale o Tizen Studio com a extensão **Samsung TV** e crie um certificado Samsung válido.
2. Use **File > Import > Tizen > Tizen Project** e selecione esta pasta. O manifesto na raiz abre `app/index.html`.
3. Preserve o `package` e o `id` do `config.xml` gerados pelo Tizen Studio se ele pedir para recriá-los. O `package` precisa ter 10 caracteres alfanuméricos.
4. Execute primeiro no TV Emulator e depois numa TV com o modo desenvolvedor habilitado.
5. Caso a lista use HTTP numa TV recente, prefira uma origem HTTPS. Servidores sem CORS podem impedir chamadas diretas pelo Web Runtime.

Para abrir somente o app da TV no navegador durante o desenvolvimento, execute `npx http-server app -p 8080`. As funções `/api` ficam na raiz do projeto para o runtime da Vercel; execute `vercel dev` na raiz para trabalhar localmente com elas.

O manifesto declara Tizen 4.0 como versão mínima. O player usa AVPlay quando disponível. No navegador, transmissões HLS usam o build local reduzido do Shaka Player; `<video>` permanece como alternativa. Canais ao vivo são solicitados em `.m3u8`. Formatos, codecs, certificados HTTPS e comportamento de rede variam por modelo; a reprodução em TV real só pode ser considerada validada após teste no aparelho.

## Controles

- Setas: mover foco
- OK/Enter: abrir
- OK segurado por 700 ms num card: alternar favorito
- Voltar: fechar teclado/player ou voltar de tela
- Teclado virtual: abre ao selecionar um campo

## Arquitetura de navegação

O foco foi separado em `app/js/navigation/`: histórico por perfil e rota, gerenciador de foco, cálculo espacial e eventos do controle remoto. A interface usa IDs estáveis, viewport fixa e `translate3d` para trazer o conteúdo até a região de foco.

Os catálogos usam uma janela virtual de linhas próximas ao foco, mantendo poucas dezenas de cards no DOM mesmo com milhares de itens. Capas são carregadas por uma fila de baixa concorrência e categorias/EPG usam cache local com expiração e limpeza automática.

## Pareamento pelo celular na Vercel

O projeto mantém o cliente Tizen em `app/`, as páginas e funções de servidor em `api/` e o gerenciador móvel em `pair/` (publicado de `public/`). O endpoint `/api/pair` e a integração da TV usam código temporário de 6 números, válido por 15 minutos. Durante a sessão, o celular pode adicionar quantas listas quiser, ativar uma lista ou removê-la. A API expõe ao celular somente os nomes e identificadores; as credenciais não são devolvidas.

1. Importe este diretório em um novo projeto da Vercel.
2. Crie um banco Redis no Marketplace da Vercel (Upstash) e conecte-o ao projeto.
3. Confirme que o projeto recebeu `KV_REST_API_URL` e `KV_REST_API_TOKEN`. A API também aceita os nomes `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
4. Faça o deploy e copie o domínio HTTPS gerado.
5. Altere `window.PAIRING_SERVER_URL` em `app/js/pairing-config.js` para esse domínio e gere novamente o pacote Tizen.

Depois disso, a tela inicial e a tela de primeiro acesso mostram o endereço `/pair` e um código de seis números. Abra o endereço no celular para adicionar, usar, ativar/desativar, renomear, ordenar ou remover listas.

Servidor publicado deste projeto: `https://cinema-noir-pairing.vercel.app`. A hospedagem publica o gerenciador móvel, a API de pareamento e o manifesto de versão.

## Atualizações na TV

O aplicativo consulta `/api/version` e permite verificar a versão em Configurações. Por segurança, uma aplicação Tizen instalada em modo desenvolvedor não pode substituir o próprio pacote. Para atualizar sem Tizen Studio, publique cada nova versão no Samsung Apps TV Seller Office com o mesmo Application ID, Package ID e certificado de autor; com atualização automática habilitada na TV, o pacote novo é instalado pelo sistema. O `config.xml` deve sempre receber uma versão superior antes do envio.

## Validação recomendada na TV

Teste login válido e inválido, timeout, troca entre duas listas, isolamento de favoritos e progresso, todos os campos com controle remoto, pressionamento longo, catálogos grandes, temporadas e episódios, retomada, formatos usados pelo provedor e saída pelo botão Voltar.
