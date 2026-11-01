# ST1 Sales PAP Web + Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir protótipo Web + aplicativo Android/iPhone com API de campo e validação comercial isolado do ST1 Sales atual.

**Architecture:** Preservar painel Web/Admin e regras SQLite da versão 0.1. Adicionar motor de autenticação/telemetria e API móvel em porta distinta; app Expo SDK 58 compartilha os contratos da API, mas nenhum segredo da administração. Integração futura com ST1 Sales é adaptador separado que não existe nesta versão.

**Tech Stack:** Node 22+ (`node:http`, `node:sqlite`, `node:crypto`), SQLite, HTML/JS/Leaflet local, Expo 58 / React Native, expo-location, expo-task-manager, expo-secure-store.

---

### Task 1: Dados e autenticação móvel

**Files:** Create `server/mobile-db.mjs`; Test `server/mobile.test.mjs`.

- [ ] Definir tabelas de pareamento, tokens, jornadas, posição e visitas em `ensureMobileSchema(db)`.
- [ ] Escrever teste que emite um código temporário para vendedor real e não permite reaproveitamento.
- [ ] Implementar `issuePairing`, `redeemPairing`, `authenticate` com códigos aleatórios e SHA-256 dos tokens.
- [ ] Escrever testes de revogação, validade, segregação por perfil e expiração.
- [ ] Executar `npm test`, confirmar falha antes de completar e sucesso após implementação.

**Exemplo de contrato esperado:**

```js
const pair = issuePairing(db, sellerId, 'seller');
const session = redeemPairing(db, pair.code);
const principal = authenticate(db, session.token);
if (principal.sellerId !== sellerId) throw new Error('identidade divergente');
```

### Task 2: Jornada, GPS e visitas

**Files:** Modify `server/mobile-db.mjs`; Test `server/mobile.test.mjs`.

- [ ] Escrever testes para localização sem jornada, timestamps desatualizados e precisão inválida.
- [ ] Implementar início e encerramento de jornada.
- [ ] Implementar salvamento rate-limited e `mobilePositionsForSellers` com indicador de frescor.
- [ ] Implementar visita atribuída ao autor, com tipos enumerados; listar só do autor/equipe autorizada.
- [ ] Executar testes, inspecionar a tabela e retenção de 7 dias.

**Exemplo de contrato esperado:**

```js
startShift(db, sellerId);
ingestPosition(db, sellerId, {lat:-2.537, lon:-44.299, accuracy:18, recordedAt:new Date().toISOString()});
stopShift(db, sellerId);
```

### Task 3: API móvel com segurança de escopo

**Files:** Create `server/mobile-api.mjs`; Modify `server/index.mjs`; Test `server/mobile-api.test.mjs`.

- [ ] Definir rotas `health`, `pair`, `session`, `shift/start`, `shift/stop`, `location`, `catalog`, `evaluate`, `visits`, `team`.
- [ ] Recusar rotas de admin na porta móvel, verificar bearer em toda rota exceto `pair` e `health`.
- [ ] Aplicar restrição de acesso aos dados de equipe conforme papel e equipe.
- [ ] Modificar o `GET /api/state` para mostrar GPS do app quando recente.
- [ ] Confirmar admin apenas loopback, LAN móvel desativada por padrão e testes HTTP integrados.

**Contrato de resposta:**

```json
{"labOnly":true,"status":"EM_ANALISE","reasons":["..."],"checkedAt":"2026-11-01T00:00:00.000Z"}
```

### Task 4: Admin Web e pareamento

**Files:** Modify `public/app.js`, `public/styles.css`, `server/index.mjs`.

- [ ] Adicionar página "Aplicativo PAP", escolha de vendedor real e papel, geração de código único.
- [ ] Exibir expiração e botão de revogação sem exibir bearer tokens.
- [ ] Mostrar saúde de API móvel e distinguir GPS de app, Traccar e demonstração no mapa.
- [ ] Exercitar pela interface Web a emissão/revogação de códigos.

### Task 5: App Android+iOS

**Files:** Create `mobile/package.json`, `mobile/app.json`, `mobile/eas.json`, `mobile/App.js`, `mobile/src/api.js`, `mobile/src/tracking.js`, `mobile/README.md`.

- [ ] Definir Expo SDK 58, requisitos de localização, notificações Android e background mode iOS.
- [ ] Criar pareamento, sessão SecureStore e fluxo de logout.
- [ ] Criar jornada e tarefa GPS em segundo plano, além de fallback foreground para diagnóstico.
- [ ] Criar catálogo/consulta de elegibilidade, visitas e visão de equipe do supervisor.
- [ ] Verificar sintaxe JS e configuração estática. Sem npm disponível, não afirmar compilação nem funcionamento nativo.

### Task 6: Homologação e entrega Windows

**Files:** Modify `README.md`, `.env.example`, `INICIAR.bat`, `VERIFICAR-WINDOWS.bat`, `docs/TESTES.md`; Create `mobile/README.md`.

- [ ] Adicionar roteiro de teste Windows + Android/iOS (primeiro LAN, depois HTTPS remoto).
- [ ] Executar `npm test` na raiz, teste HTTP/pareamento, teste de Web e gerador ZIP.
- [ ] Conferir ZIP com exclusão de `.env`, banco SQLite, arquivos npm e segredos.
- [ ] Documentar explicitamente etapas não verificadas: instalações Expo, APK e IPA, GPS real de dispositivo e integração ST1 Sales.

**Comandos de verificação:**

```bash
npm test
node --check server/mobile-db.mjs
node --check server/mobile-api.mjs
node --check mobile/App.js
unzip -t ST1-Sales-PAP-Web-Mobile-Homologacao.zip
```

**Status final:** registrar o que efetivamente passou; não marcar build nativo como testado sem um dispositivo Android/iPhone e credenciais de build.
