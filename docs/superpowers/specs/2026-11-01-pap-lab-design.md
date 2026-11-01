# ST1 Sales PAP Lab — design aprovado (01/11/2026)

## Escopo
Piloto independente, executado somente no Windows do operador; sem uso de código, banco ou API do ST1 Sales nesta versão e sem relação com ST1 Connect. O objetivo é testar posições de vendedores PAP, polígonos territoriais, CTOs e decisão de elegibilidade de oferta com rastreabilidade. Não registrar vendas reais.

## Arquitetura
Interface HTML/CSS/JavaScript nativa com tiles do OpenStreetMap no navegador em localhost; API HTTP nativa de Node escutando apenas 127.0.0.1:4173; SQLite embutido no Node 22+ em `data/pap-lab.sqlite`; adaptador de leitura Traccar REST configurado no `.env` (somente backend). Node serve a API e os arquivos estáticos do diretório `public/` no mesmo endereço, sem npm install.

## Unidades
- `server/db.mjs`: schema, CRUD e transações locais.
- `server/geo.mjs`: geometria GeoJSON Polygon/MultiPolygon e detecção de inclusões e sobreposições.
- `server/eligibility.mjs`: decisão centralizada fail-closed: LIBERADO, EM_ANALISE ou BLOQUEADO.
- `server/traccar.mjs`: consulta de dispositivos e últimas posições no Traccar sem expor segredos à UI.
- `server/index.mjs`: endpoints HTTP com Node nativo, validação, logs de decisão e app local.
- `public/app.js`, `public/map.js`, `public/styles.css`: painéis de mapa, cadastro e simulador de oferta.

## Regras cruciais
GPS do vendedor informa onde o colaborador está, mas a autorização comercial é baseada no endereço de INSTALAÇÃO indicado no mapa; nunca pelo GPS do vendedor. Verificação exige território único, regra explícita plano-território, CTO correspondente, capacidade maior que zero, status operacional, validação de capacidade recente (24h). Ausência, conflito ou dado vencido nunca produzem LIBERADO. Um resultado LIBERADO é sempre rotulado como SIMULAÇÃO LOCAL, não autorização real do ST1 Sales.

## Dados de demonstração
Nenhum vendedor, plano, CTO ou área fictício deve aparecer sem ação explícita de `Carregar cenário de teste`. Ao carregar, registros identificados com prefixo TESTE são inseridos e a interface mantém aviso visual de DEMONSTRAÇÃO. Deve haver mecanismo de remover somente os dados de demonstração com confirmação; não implementar sincronização externa na remoção.

## Validação
Testes unitários para polígonos e buracos, sobreposições, regras deny-by-default, CTO sem capacidade, check vencido e cenário aprovado. Verificações HTTP do ambiente vazio, cenário demonstrativo, mapa e importação. QA visual desktop/mobile via navegador.

## Segurança/privacidade
API restrita a loopback, não publicar endereço/credenciais em frontend, segredos em `.env` ignorado pelo Git. Traccar fornece posições reais apenas com aparelho autorizado durante jornada e transparência aos empregados. Antes de uso com equipe real, exigir revisão LGPD, autenticação, RBAC, política de retenção e infraestrutura remota segura.
