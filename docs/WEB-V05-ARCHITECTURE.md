# ST1 PAP Web — arquitetura e entrega 0.5

## Implementado nesta revisão

A web de homologação em `web-preview/` mantém mapa geográfico, replay de rotas, equipes, catálogo, regras e importação territorial. Acrescenta visitas, funil, planejamento, relatórios e administração. Todos os dados operacionais continuam sintéticos e locais ao navegador.

| Rota | Responsabilidade | Ações |
|---|---|---|
| `#overview` | Visão territorial | Camadas, municípios, seleção de endereço, simulação |
| `#routes` | Histórico geográfico | Seleção de vendedor, replay, exportação GeoJSON |
| `#people` | Equipe demonstrativa | Inclusão, exclusão e acesso ao trajeto |
| `#visits` | Agenda e funil | Cadastro, mudança de etapa, busca, data, CSV |
| `#planning` | Distribuição territorial | Vendedor, área, data, meta, conclusão e reabertura |
| `#products` | Catálogo e matriz | Cadastro, ativação, regras por território |
| `#coverage` | Cobertura de teste | Importação GeoJSON/KML, CTOs e remoção de vínculos |
| `#reports` | Indicadores | Filtros, distribuição por etapa, resultado por vendedor |
| `#admin` | Dados locais | Exportação, restauração e histórico auxiliar |

`operations.js` concentra validação de visitas, filtragem, indicadores e CSV. `app.js` faz composição de telas e eventos; `map.js` mantém o renderizador geográfico existente. A persistência usa a chave existente e adapta visitas antigas sem apagar os cadastros.

## Regras e métricas

- Etapas: Planejada, Visitada, Proposta, Venda simulada e Sem interesse.
- Realizadas: registros cuja etapa atual não é Planejada. Não representa quantidade histórica de transições.
- Conversão: vendas simuladas / realizadas, com resultado zero quando não há realizadas.
- Filtros de relatório aplicam-se também ao CSV.
- Alocações duplicadas de vendedor + território + data são recusadas.
- Excluir vendedor remove suas visitas e alocações; excluir território remove as alocações, CTOs e regras vinculadas.
- Não há cálculo de receita, otimização viária, autorização de venda ou sincronização com sistemas comerciais.

## Arquitetura necessária para operação remota real

O backend atual Node/SQLite é local; a Vercel serve somente arquivos estáticos. Publicar a interface não publica a API. Não expor a porta administrativa existente: ela não possui autenticação Web multiusuário.

Arquitetura proposta: frontend Vercel → API HTTPS autenticada → banco persistente dedicado. O aplicativo móvel envia jornada, visitas e GPS à API. O gateway Traccar permanece opcional, no servidor. A web nunca recebe credenciais do Traccar.

Entidades do ambiente operacional: organização, usuário, papel, equipe, vínculo de equipe, vendedor, dispositivo, jornada, amostra de posição, território com versão de geometria, CTO com confirmação de capacidade, produto, regra de elegibilidade, alocação, visita, transição de visita e evento de auditoria.

Endpoints propostos (ainda não implementados):

| Recurso | Contrato e restrições |
|---|---|
| `/web/v1/session` | Sessão em cookie Secure/HttpOnly, expiração, revogação e proteção CSRF |
| `/web/v1/teams`, `/sellers` | Diretoria/gerência administram; supervisão recebe somente equipe autorizada |
| `/web/v1/positions` | Cursor incremental, timestamp de origem, precisão e indicador de posição antiga |
| `/web/v1/routes` | Vendedor, início/fim com limites, paginação e isolamento por equipe |
| `/web/v1/visits` | Validação de autor, coordenadas e etapa; chave de idempotência |
| `/web/v1/assignments` | Verificação de vendedor e território; controle de concorrência por versão |
| `/web/v1/coverage`, `/products`, `/rules` | Leitura operacional e alterações por gestores autorizados |
| `/web/v1/reports` | Mesmos filtros e fuso em painel e exportação; nenhuma soma de preços como receita |
| `/web/v1/audit` | Eventos persistentes no servidor com autor, horário e mudança |

Permissões devem ser verificadas na API para cada objeto. Diretoria vê a organização; gerência administra a operação; supervisor vê sua equipe; vendedor acessa seus próprios registros. Esconder botões não implementa autorização.

Erros esperados: 401 sessão expirada, 403 escopo negado, 409 concorrência, 422 validação, 429 limite e 503 dependência indisponível. Preservar formulários em erro e não indicar sincronização antes da confirmação do servidor.

## Implantação e aceite

1. Revisar esta branch e gerar Preview Vercel usando `web-preview` como root directory.
2. Homologar navegação, formulários, filtros, exportações, persistência e replay em desktop e celular.
3. Selecionar serviço de API e banco persistente; configurar autenticação e perfis antes de usar dados identificáveis.
4. Implementar os contratos acima com migrações, isolamento de equipes e auditoria; validar backup e restauração.
5. Integrar aplicativo móvel e validar jornada/GPS em aparelhos reais, perda de rede e revogação.
6. Promover apenas após os critérios operacionais; a web 0.5 sozinha não satisfaz essas etapas.

## Referências

- https://github.com/traccar/traccar — referência para serviço e histórico de localização.
- https://github.com/stevebargelt/salesperson-tracking — separação entre aplicativo, painel e backend.
- https://github.com/rahulmasal/Tracko — organização de jornada e visitas de campo.

Implementação independente; nenhum código desses projetos foi incorporado.
