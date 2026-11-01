# ST1 PAP Web 0.3 — homologação

## Interface
- Mapa raster OpenStreetMap com CTOs, vendedores fictícios e polígonos por território.
- Tela de rotas com 65 pontos sintéticos, reprodução por horário e exportação GeoJSON.
- Cadastro DEMO de produtos e preços opcionais, matrizes de elegibilidade territorial, equipes e visita.
- LocalStorage local e importação GeoJSON/KML; sem dependência de ST1 Connect.

## Segurança e integração
- **A aplicação na Vercel não rastreia pessoas reais**. Dados e percursos são sintéticos.
- API Node/SQLite local de GPS, incluindo rota histórica e opção Traccar, permanece fora da Vercel.
- Para produção operacional: HTTPS, autenticação Web/RBAC, banco remoto persistente isolado, trilhas de auditoria, gestão LGPD e builds nativos Android/iPhone.

## Recursos
- [Traccar](https://github.com/traccar/traccar) — consulta opcional de rotas GPS.
- [salesperson-tracking](https://github.com/stevebargelt/salesperson-tracking) — estrutura Web/mobile.
- [Tracko](https://github.com/rahulmasal/Tracko) — jornada e visitas.

Código desenvolvido independentemente; sem copiar os repositórios de referência.
