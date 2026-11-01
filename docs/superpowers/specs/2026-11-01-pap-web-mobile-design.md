# ST1 Sales PAP | Web + Android/iPhone (homologação)

**Aprovado pelo solicitante:** painel Web para gestores/líderes e aplicativo para vendedores/supervisores Android e iPhone. Construção isolada, primeiro no Windows, sem alterar ST1 Sales e sem envolver ST1 Connect.

## Objetivo e escopo

Preservar o laboratório Web `http://127.0.0.1:4173` e o motor de avaliação. Acrescentar app Expo React Native e API móvel independente para teste local. A mesma base SQLite fica no PC. Na homologação, planos/CTOs são locais e **nunca autorizam venda real**, mesmo quando status simulado for `LIBERADO`.

## Arquitetura e interfaces

- **Web Admin** — o painel atual, restrito ao próprio PC: mapa, territórios, catálogo, regras, testes e novos controles de pareamento/revogação dos dispositivos.
- **Mobile API** — serviço separado na porta `4174`, com rotas estritamente `/mobile/v1/*`, dados segregados por token e papel. Disponível apenas em loopback por padrão, liberável na rede local por configuração consciente. Não expõe rotas administrativas.
- **Mobile App** — projeto Expo SDK 58 para Android+iPhone, com pareamento por código temporário, sessão salva no SecureStore, início/fim da jornada, localização em segundo plano por `expo-location`/`expo-task-manager`, consulta a catálogo e oferta, visita e, para supervisor, mapa/listagem da própria equipe.
- **Banco** — SQLite local compartilhado entre ambos servidores do mesmo processo Node; tabelas adicionais `mobile_pairings`, `mobile_tokens`, `mobile_shifts`, `mobile_positions`, `mobile_visits`. O Web recebe apenas última posição com frescor explícito.

## Fluxo de dados

1. Gestor cadastra vendedor não fictício e emite código temporário no Web. Código tem duração de 10 minutos e vincula um vendedor/papel.
2. Usuário informa endereço da API e código no app. API troca o código uma única vez por token criptograficamente aleatório; somente hash fica no banco. Credencial do aplicativo fica em armazenamento seguro do dispositivo.
3. Vendedor abre jornada, aprova permissões de localização e ativa o rastreamento. Posições têm precisão e timestamp, e são aceitas apenas dentro da jornada. Localização fora da jornada é recusada.
4. Gestor vê última posição no mapa Web. Supervisor vê somente vendedores da mesma equipe em seu app.
5. Oferta avaliada usando coordenada **do endereço de instalação**, o plano e a CTO; não se aceita GPS do vendedor como prova de cobertura.
6. Gestor revoga token pelo Web, efetivo na próxima requisição.

## Segurança e limites de homologação

- Painel administrativo Web continua somente `localhost` e sem autenticação de equipe. NUNCA publicar na internet.
- API móvel suporta apenas endpoints com autenticação individual, exceções: saúde e pareamento. Tokens gerados com fonte criptográfica e armazenados em hash, prazo de 14 dias. Pareamento one-time, 10 min, limitado por IP.
- `PAP_MOBILE_LAN=1` expõe só a API móvel à rede privada. HTTP LAN é exclusivo de testes com pessoas autorizadas, dados fictícios e dispositivos controlados; GPS real entre localidades requer HTTPS em servidor homologado.
- Posições têm limite de frequência, validação de lat/lon, precisão e idade, expiração de dados históricos em até 7 dias; GPS não é coleta permanente e o dispositivo interrompe a emissão ao terminar a jornada. Ausência de internet pode resultar em lacunas, sem simular atualização.
- Expo Go não comprova rastreamento em background; exige development/internal build. Para iOS físico, credenciais Apple Developer, provisionamento e aparelhos registrados.
- Nenhuma API de gravação no IXC/ST1 Sales, nenhum segredo distribuído em código e nenhuma integração existente alterada.

## Testes de aceitação

- Sem pareamento o mobile não consulta equipe nem envia posição.
- Token de vendedor não acessa listagem de equipe; supervisor só vê sua equipe.
- Sem jornada ativa POST localização retorna erro; com jornada aceita coordenada válida e mapeia posição com fonte APP PAP.
- Após encerramento não aceita GPS; token revogado não autentica.
- Oferta no app permanece `labOnly` e usa endereço de instalação, sem depender da posição do funcionário.
- Admin Web segue escutando apenas loopback, mobile API escuta a rede local apenas com variável habilitada.
- Fontes Expo e Node estão no pacote; build nativo Android/iOS depende de ambiente e credenciais externas e não será declarado validado sem executar.

## Fases

1. API móvel + testes de contrato e segurança, preservando Web.
2. Pareamento no Web + observação das posições na mesma tela.
3. App Expo + jornada/background, consulta de planos, visitas, equipe.
4. Teste LAN com Android e iPhone instalados, HTTPS homologado para teste remoto.
5. Somente após aceite, mapear API oficial ST1 Sales e autorização do proprietário do sistema.
