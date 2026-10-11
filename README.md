# Cinema Noir para Samsung Tizen TV

Aplicativo Web para listas Xtream, feito somente em HTML, CSS e JavaScript tradicional. Não há React, TypeScript, Vite, npm ou etapa de compilação. Os dados são armazenados localmente por perfil e as chamadas vão diretamente ao servidor configurado.

## Importar no Tizen Studio

1. Instale o Tizen Studio com a extensão **Samsung TV** e crie um certificado Samsung válido.
2. Use **File > Import > Tizen > Tizen Project** e selecione esta pasta.
3. Preserve o `package` e o `id` do `config.xml` gerados pelo Tizen Studio se ele pedir para recriá-los. O `package` precisa ter 10 caracteres alfanuméricos.
4. Execute primeiro no TV Emulator e depois numa TV com o modo desenvolvedor habilitado.
5. Caso a lista use HTTP numa TV recente, prefira uma origem HTTPS. Servidores sem CORS podem impedir chamadas diretas pelo Web Runtime.

O manifesto declara Tizen 4.0 como versão mínima. O player usa AVPlay quando disponível. No navegador, transmissões HLS usam o build local reduzido do Shaka Player; `<video>` permanece como alternativa. Canais ao vivo são solicitados em `.m3u8`. Formatos, codecs, certificados HTTPS e comportamento de rede variam por modelo; a reprodução em TV real só pode ser considerada validada após teste no aparelho.

## Controles

- Setas: mover foco
- OK/Enter: abrir
- OK segurado por 700 ms num card: alternar favorito
- Voltar: fechar teclado/player ou voltar de tela
- Teclado virtual: abre ao selecionar um campo

## Arquitetura de navegação

O foco foi separado em `js/navigation/`: histórico por perfil e rota, gerenciador de foco, cálculo espacial e eventos do controle remoto. A interface usa IDs estáveis, viewport fixa e `translate3d` para trazer o conteúdo até a região de foco.

Os catálogos usam uma janela virtual de linhas próximas ao foco, mantendo poucas dezenas de cards no DOM mesmo com milhares de itens. Capas são carregadas por uma fila de baixa concorrência e categorias/EPG usam cache local com expiração e limpeza automática.

## Pareamento pelo celular na Vercel

O projeto inclui a página móvel `/pair`, a função `/api/pair` e a integração da TV. O código temporário tem 6 números e dura 15 minutos. Durante a sessão, o celular pode adicionar quantas listas quiser, ativar uma lista ou removê-la. A API expõe ao celular somente os nomes e identificadores; as credenciais não são devolvidas.

1. Importe este diretório em um novo projeto da Vercel.
2. Crie um banco Redis no Marketplace da Vercel (Upstash) e conecte-o ao projeto.
3. Confirme que o projeto recebeu `KV_REST_API_URL` e `KV_REST_API_TOKEN`. A API também aceita os nomes `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
4. Faça o deploy e copie o domínio HTTPS gerado.
5. Altere `window.PAIRING_SERVER_URL` em `js/pairing-config.js` para esse domínio e gere novamente o pacote Tizen.

Depois disso, a tela inicial e a tela de primeiro acesso mostram o endereço `/pair` e um código de seis números. Abra o endereço no celular para adicionar, usar, ativar/desativar, renomear, ordenar ou remover listas.

Servidor publicado deste projeto: `https://cinema-noir-pairing.vercel.app`. A hospedagem publica o gerenciador móvel, a API de pareamento e o manifesto de versão.

## Atualizações na TV

O aplicativo consulta `/api/version` e permite verificar a versão em Configurações. Por segurança, uma aplicação Tizen instalada em modo desenvolvedor não pode substituir o próprio pacote. Para atualizar sem Tizen Studio, publique cada nova versão no Samsung Apps TV Seller Office com o mesmo Application ID, Package ID e certificado de autor; com atualização automática habilitada na TV, o pacote novo é instalado pelo sistema. O `config.xml` deve sempre receber uma versão superior antes do envio.

## Validação recomendada na TV

Teste login válido e inválido, timeout, troca entre duas listas, isolamento de favoritos e progresso, todos os campos com controle remoto, pressionamento longo, catálogos grandes, temporadas e episódios, retomada, formatos usados pelo provedor e saída pelo botão Voltar.
