# Aplicativo ST1 PAP — Android e iPhone — Homologação 0.2

Este diretório é o **código-fonte** do aplicativo React Native com Expo SDK 58, **não um APK ou IPA já compilado**. A interface Web do gestor e a API Node ficam na pasta raiz do pacote. Nenhum arquivo depende do código-fonte do ST1 Sales.

## Pré-requisitos no Windows

- Node.js 22.16 ou mais recente; internet para instalar dependências Expo.
- Celular Android e/ou iPhone autorizados para teste; ambos com acesso à **API móvel**.
- Conta Expo para compilar builds EAS; iPhone físico precisa de associação ao programa Apple Developer para assinatura e instalação de builds internos.
- Quando quiser testar GPS em background: `expo-dev-client` + build próprio. **Expo Go não prova background GPS**.

## Iniciar o projeto

Abra um segundo Prompt de Comando na pasta `mobile`:

```bat
cd C:\ST1-PAP-HOMOLOGACAO\mobile
npm install
npx expo install --check
npx expo start
```

Para a experiência com GPS em segundo plano, instale dev-client e gere o build:

```bat
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

Os builds `preview` (distribuição interna) podem ser criados com `npx eas-cli@latest build --platform android --profile preview` e o equivalente para iOS. No Android, o EAS fornece APK. No iPhone, gera IPA assinado com perfil ad hoc para dispositivos cadastrados; o programa Apple Developer é obrigatório para essa via.

Antes de compilar, atualize os identificadores `android.package` e `ios.bundleIdentifier` em `app.json` se a organização já tiver identificadores oficiais.

## Conectar ao servidor do PC

1. Na raiz do pacote Windows, inicie `INICIAR-LAN-TESTE.bat` para habilitar a API móvel na porta 4174 da rede privada. O painel de gestão em `http://127.0.0.1:4173` continua **somente no computador**.
2. Execute `ipconfig` e identifique o IPv4 do computador na mesma rede Wi-Fi do telefone; confirme que a porta 4174 foi permitida apenas no perfil privado do Firewall.
3. No painel Web, crie um vendedor não fictício. Vá a **Aplicativo PAP**, escolha o vendedor e papel, gere um código temporário de 16 caracteres (10 minutos).
4. No app, use o endereço `http://IP-DO-PC:4174` e o código gerado. A senha longa gerada no pareamento fica somente no SecureStore do aparelho. Os servidores guardam apenas o hash.
5. Inicie a jornada. O app solicita permissão de GPS, envia amostras e o mapa Web exibe a última posição recebida. O supervisor vê somente pessoas da própria equipe. Ao encerrar a jornada, o app interrompe o rastreamento.

**Atenção à privacidade:** HTTP na LAN é somente para cenário controlado com dados sintéticos. Para GPS real ou teste entre cidades, implante a API em ambiente HTTPS homologado (certificado confiável), revise as permissões legais e defina retenção. Nunca exponha a porta 4174 diretamente à internet por encaminhamento de roteador.

## O que o aplicativo entrega

- Pareamento temporário com papéis Vendedor e Supervisor.
- Iniciar/encerrar jornada, registrar GPS; task em segundo plano quando autorizada pelo Android/iOS e em development build.
- Mapa com camadas de CTO, territórios ilustrativos e, para supervisores, integrantes da própria equipe.
- Consulta de plano/CTO por coordenadas **do imóvel**, não pelo GPS do funcionário.
- Registro básico de visitas sem nome/endereço/documento do cliente; acesso apenas do próprio vendedor ou supervisor da mesma equipe.
- Alertas quando o dispositivo não confirmou envio, fonte do GPS e aviso de simulação.

## Limitações para homologação

- A versão ainda não tem sincronização offline persistente; se o telefone perder conexão, atualizações podem faltar. O sistema não finge que a posição é recente.
- Background GPS não foi compilado nem testado em dispositivo nesta entrega: depende de instalação, permissões e build nativo. Android pode interromper serviços dependendo da política do fabricante; iOS pode pausar ou encerrar tarefas.
- A versão inclui permissões de HTTP local (`NSAllowsArbitraryLoads`/`usesCleartextTraffic`) **apenas para esta homologação**. Remova essas exceções antes de promover a produção e exija HTTPS.
- `react-native-maps` pode exigir chave Google Maps ao gerar Android fora do Expo Go; documente a configuração da chave em build e não inclua chaves no repositório. No iOS, o padrão utiliza Apple Maps.
- Não há integração com IXC nem autorização de vendas reais no ST1 Sales.

Fontes oficiais: [Expo Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [TaskManager](https://docs.expo.dev/versions/v58.0.0/sdk/task-manager/), [Maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/), [EAS builds internos](https://docs.expo.dev/build/internal-distribution/).
