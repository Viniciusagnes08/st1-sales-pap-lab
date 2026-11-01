# ST1 Sales | PAP Lab — Web + App Android/iPhone

**Versão 0.2.0 — ambiente de homologação independente.** Código e testes locais; não é o ST1 Sales em produção, não utiliza ST1 Connect e **não altera qualquer cadastro ou venda em sistemas externos**.

## O que há neste pacote

| Superfície | Caminho | Estado nesta entrega |
| --- | --- | --- |
| Painel Web de gestão | `public/`, `server/index.mjs` | Executável no PC Windows com Node.js 22.16+ |
| Motor local de elegibilidade | `server/eligibility.mjs` | Executável, com teste de território/CTO/plano, sempre `labOnly` |
| API exclusiva dos celulares | `server/mobile-api.mjs` | Executável, testada localmente, porta `4174` |
| Banco e credenciais | `server/db.mjs`, `server/mobile-db.mjs` | SQLite no PC, credenciais só em hash, acesso temporário |
| App Android/iPhone | `mobile/` | Código-fonte Expo SDK 58, **sem APK/IPA nesta entrega** |
| GPS em segundo plano | `mobile/src/tracking.js` | Implementado em fonte; requer build nativo e validação em dispositivos |
| Integração Traccar antiga | `server/traccar.mjs` | Opcional, somente leitura; **o novo app não depende de Traccar Client** |

## Operação prevista

- **Gerentes e diretores:** painel Web para mapa, equipes, CTOs, planos, regras, simulações e controle de aparelhos. Na homologação inicial, o painel só abre no PC que o executa; acesso Web remoto de gestores exige um backend publicado com HTTPS, autenticação e autorização, ainda **não implementados**.
- **Supervisor:** mesmo app Android/iOS dos vendedores, com autorização adicional para visualizar somente sua equipe no mapa e em listagem.
- **Vendedor PAP:** app com jornada, localização, mapa, consulta de ofertas por coordenada do imóvel e registro básico de visitas.
- **API:** sessões individuais temporárias e autenticação por token. Nenhuma API de administração é publicada na porta dos celulares.

## A. Primeiro teste no Windows, sem Docker

1. Extraia o ZIP para `C:\ST1-PAP-HOMOLOGACAO`.
2. Instale Node.js **22.16 ou posterior** (se já não possuir).
3. Execute `VERIFICAR-WINDOWS.bat` para conferir SQLite e testes.
4. Execute `INICIAR.bat` para abrir o painel Web **http://127.0.0.1:4173** (restrito ao próprio PC).
5. Clique em **Carregar cenário de teste** para visualizar áreas, CTOs, planos e vendedores identificados como fictícios.
6. Execute os testes de elegibilidade em **Verificar oferta**. `LIBERADO` sempre significa **simulação**, nunca autorização comercial real.

Este teste básico dispensa `npm install`, Docker, Git e qualquer acesso ao código-fonte do ST1 Sales. O servidor cria o banco em `data\pap-lab.sqlite` sem registros fictícios automáticos. As camadas do OpenStreetMap exigem internet para carregar imagens de fundo; as regras funcionam sem os tiles.

## B. Habilitar API dos celulares na rede local

1. Pare `INICIAR.bat` com `Ctrl+C` e execute **`INICIAR-LAN-TESTE.bat`**.
2. O Web Admin seguirá em `127.0.0.1:4173`. Só a API móvel escutará a rede privada na porta **4174**, por configuração explícita.
3. No Windows, use `ipconfig` para descobrir o IPv4 da placa Wi-Fi; por exemplo, se o IPv4 fosse `192.168.0.50`, o aplicativo usaria `http://192.168.0.50:4174`. Este IP é apenas um exemplo, não o IP do seu computador.
4. Faça o pareamento pelo painel Web em **Aplicativo PAP**. Antes, crie um cadastro de vendedor **não fictício** (os personagens TESTE são bloqueados para pareamento).
5. Para perfil supervisor, escolha a mesma equipe dos vendedores que ele poderá acompanhar. O acesso à listagem de equipe é validado na API.
6. Teste `http://IP-DO-PC:4174/mobile/v1/health` no navegador do celular para verificar se a rede e o firewall permitem acesso. Não é necessário abrir portas no roteador nem publicar a API na internet.

**Atenção:** esta via HTTP serve somente para demonstração e teste controlado com dados sintéticos. Não trafegue localização real identificável em rede HTTP. Para acompanhamento de pessoas e testes fora da mesma LAN, primeiro hospede a API em HTTPS com certificado confiável, controle de acesso, retenção aprovada e validação jurídica/LGPD. O `.env` tem campos opcionais para habilitar TLS no servidor Node.

## C. Iniciar o app Android + iPhone

Instale as dependências dentro da pasta `mobile` (esta etapa **precisa de internet**):

```bat
cd C:\ST1-PAP-HOMOLOGACAO\mobile
npm install
npx expo install --check
npx expo start
```

Para rastreamento real em segundo plano, **o Expo Go não é suficiente**. Use um **development build** com Expo EAS, conforme `mobile/README.md`:

```bat
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

A compilação para iPhone físico requer Apple Developer e provisionamento do aparelho. O Android gera APK via EAS Build, o iOS um IPA assinado; nenhum dos dois binários foi gerado nesta entrega. O mapa móvel usa `react-native-maps` e pode exigir chave de Google Maps para Android fora do Expo Go.

## D. Roteiro de homologação

1. **Web:** cenários fictícios de plano, território, CTO, sem portas e área inválida.
2. **Pareamento:** emitir código válido por 10 minutos, entrar no app e tentar reutilizar (deve falhar).
3. **Permissões:** vendedor não acessa a equipe; supervisor só recebe vendedores da mesma equipe.
4. **Jornada:** antes de iniciar, GPS é recusado; iniciada a jornada, coordenadas válidas aparecem no Web; encerrada, o servidor recusa novas amostras.
5. **Oferta:** o app pede a coordenada do **endereço de instalação**; o vendedor estar em outra área não pode liberar um plano.
6. **Revogação:** revogue a credencial pelo painel Web. O próximo acesso do aplicativo falha e a jornada do vendedor é encerrada no banco.
7. **Offline e background:** testar rede desligada, permissão "Sempre", app em segundo plano, Android com otimização agressiva de bateria e iOS em repouso. Não presumir continuidade se houver silêncio de GPS.
8. **Backup:** exportação de dados comerciais locais pelo Web. A exportação não inclui tokens e histórico detalhado de localização da API.

## Regras de decisão comercial

`BLOQUEADO` quando plano está inativo/negado, endereço fora de cobertura, CTO incorreta/inoperante ou sem portas. `EM_ANALISE` quando existem polígonos sobrepostos, ausência de regra/CTO ou confirmação de capacidade desatualizada (mais de 24 horas). `LIBERADO` somente na **simulação local** quando território, regra, CTO e portas estão coerentes. O sistema não consulta a rede IXC, não publica regras e não envia vendas ao ST1 Sales.

## Limites de segurança e vida privada

- Painel administrativo não pode ser publicado: não tem autenticação multiusuário; por projeto fica em loopback. Quando gestores precisarem acessá-lo de outros locais, projetar backend Web autenticado, HTTPS e RBAC antes da publicação.
- API móvel tem autenticação por token individual com duração de 14 dias, armazenado em hash no servidor; pareamento por código de uso único (10 minutos). Há limite de requisições de pareamento por IP.
- Localização é aceita somente se houver jornada ativa, timestamp recente e coordenadas/precisão válidas, respeitando intervalo mínimo de 8 segundos. Posições antigas aparecem como antigas; o banco elimina posições e visitas depois de 7 dias.
- Sem conexão ou sem permissão, o app não apresenta falso "envio confirmado". **Não há fila offline persistente nesta versão**.
- Não coletar GPS de colaboradores antes de informar finalidade, base legal, proporcionalidade, gestão de jornada, retenção e acesso autorizados. Em produção exigem-se gestão de consentimento/avisos, criptografia de transporte e revisões de segurança/LGPD.
- O app de homologação permite HTTP apenas para hosts privados; contém exceções nativas de HTTP LAN que **devem ser removidas antes da distribuição corporativa definitiva**.
- Não versionar nem compartilhar `.env`, banco SQLite, senhas, chaves ou tokens. A versão não tem integração com o ST1 Sales, IXC ou ST1 Connect.

## Estrutura de arquivos

```text
ST1-Sales-PAP-Homologacao-v2/
  INICIAR.bat                # painel Web só no PC; API móvel só no PC
  INICIAR-LAN-TESTE.bat      # expõe somente API móvel na LAN privada
  VERIFICAR-WINDOWS.bat     # verificação SQLite + testes
  public/                   # painel Web de gestão
  server/                   # backend, dados, motor de ofertas, mobile API
  mobile/                   # aplicativo Expo SDK 58 Android/iOS (código-fonte)
  examples/                 # territórios e mapas fictícios
  docs/                     # testes, spec, plano de implantação
```

## Verificações automatizadas

```bat
npm test
npm run smoke
```

Execute na raiz. Os testes cobrem geografia e regras, Traccar opcional, segurança de pareamento, jornada e GPS, equipe e visitas. **Testes automatizados locais não validam permissões reais Android/iOS, nem a compilação nativa.**

Fontes oficiais: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [TaskManager](https://docs.expo.dev/versions/v58.0.0/sdk/task-manager/), [react-native-maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/), [EAS distribuição interna](https://docs.expo.dev/build/internal-distribution/).
