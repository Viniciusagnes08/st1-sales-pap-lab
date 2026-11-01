# ST1 Sales PAP Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar um laboratório local Windows para rastrear PAP via Traccar e testar a elegibilidade geográfica de ofertas, sem acesso ao ST1 Sales.

**Architecture:** UI HTML/CSS/JS sem dependências JS externas, API Node nativa em localhost, SQLite node:sqlite em arquivo local e adaptador server-side para Traccar. Validação de planos sempre no servidor; exemplos só por ação explícita.

**Tech Stack:** Node 22.16+ (flag --experimental-sqlite), Node.js, HTML, CSS, JavaScript, OpenStreetMap raster tiles e SQLite.

---

### Task 1: Inicialização e persistência
**Files:** `package.json`, `server/db.mjs`, `server/index.mjs`, `.env.example`, `.gitignore`
- [x] Definir dependências e comandos `npm run dev`, `npm run start` e `npm test`.
- [x] Criar schema de sellers, zones, ctos, plans, rules, evaluations e meta.
- [x] Construir API nativa em Node apenas para 127.0.0.1, sem liberar CORS externo.
- [x] Validar inicialização com `npm test` e `curl http://127.0.0.1:4173/api/health`.

### Task 2: Domínio espacial e aprovação
**Files:** `server/geo.mjs`, `server/eligibility.mjs`, `server/eligibility.test.mjs`
- [x] Implementar PIP suportando Polygon e MultiPolygon, incluindo buracos.
- [x] Implementar avaliação fail-closed com área única, regra, CTO, portas e verificação <24h.
- [x] Cobrir oito cenários com `node --experimental-sqlite --test`.

### Task 3: Integração GPS
**Files:** `server/traccar.mjs`, `server/index.mjs`, `.env.example`
- [x] Fazer chamadas de leitura autenticadas a `/api/devices` e `/api/positions` com timeout.
- [x] Exibir nenhuma posição como real quando configuração ausente ou offline.
- [x] Vincular `traccar_device_id` por vendedor e classificar posições antigas como desatualizadas.

### Task 4: Interface de mapa e gestão
**Files:** `public/index.html`, `public/app.js`, `public/map.js`, `public/styles.css`
- [x] Construir mapa com vendedores, zonas e CTOs.
- [x] Fornecer cadastro de vendedores, planos, CTOs e regras por zona.
- [x] Aceitar GeoJSON/KML e validar importação no backend.
- [x] Incluir formulário para escolher um ponto de instalação e avaliar plano.
- [x] Mostrar expressamente DEMONSTRAÇÃO quando houver dados de teste.

### Task 5: Instalação Windows e QA
**Files:** `INSTALAR.bat`, `INICIAR.bat`, `README.md`, `docs/TESTES.md`
- [x] Criar inicializador para Node instalado e sem npm install, iniciar diretamente com `node --experimental-sqlite server/index.mjs`.
- [x] Testar endpoints sem alterações externas e validar app após `npm run start`.
- [x] Renderizar no Chromium e revisar desktop e mobile.
- [x] Entregar ZIP com fonte, instruções e testes, sem segredos nem banco gerado.
