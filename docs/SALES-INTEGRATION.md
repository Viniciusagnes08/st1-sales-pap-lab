# Integração ST1 Sales → PAP Web

Fonte: https://st1sales.com.br/admin/api-docs
Consulta: 02/11/2026. Documentação acessada em sessão autenticada; nenhuma credencial foi extraída ou criada, nenhuma API comercial foi alterada.

## Contratos confirmados na documentação

Base: https://st1sales.com.br/api
Autenticação: Authorization: Bearer <token>. Tokens herdam permissões do usuário vinculado.

| Área PAP | Endpoint documentado | Aplicação |
|---|---|---|
| Identidade | GET /auth/me | Identificar usuário e confirmar escopo retornado |
| Usuários | GET /usuarios/ | Fonte de usuários; confirmar campos de perfil, status e equipe |
| Prospecções | GET /prospeccoes | Leitura comercial; confirmar filtros e paginação |
| Negociações | GET /negociacoes | Acompanhamento comercial |
| Detalhes | GET /negociacoes/{id}/detalhes | Detalhamento sob demanda e conforme permissão |
| Território | GET /kmz/opcoes | Regionais e cidades disponíveis |
| CTOs importadas | GET /kmz/ctos | Inventário territorial importado |
| CTOs ativas | GET /viabilidade/ctos | Camada de rede ativa |
| Regionais | GET /viabilidade/regionais | Filtro territorial |
| Cidades | GET /viabilidade/cidades | Filtro territorial |
| Viabilidade | GET /viabilidade/consultar?latitude={lat}&longitude={lng} | Consultar o ponto de instalação |
| Instalação | GET /bairros/taxa-instalacao?nome={bairro} | Taxa, processo e metragem por bairro |

A página também documenta operações de escrita, mas este levantamento não as executa nem as inclui na primeira conexão. A implementação inicial deve consumir consultas e manter registro da origem e horário de sincronização.

## Equipes

A imagem fornecida mostra equipes por regional e canal, incluindo PAP, Indoor e parceiros. Os nomes são rótulos, não identificadores. Não inferir ID, vínculo de vendedor, supervisor ou acesso a partir do texto da equipe.

Não foi encontrada rota de equipes nas seções disponíveis da documentação. Confirmar contrato de equipes, IDs estáveis e relação usuário-equipe antes de construir sincronização. Também confirmar se um usuário pode pertencer a mais de uma equipe e como as permissões delimitam cada consulta.

## Públicos territoriais

Área azul = A; amarela = B; cinza = C; vermelha = D+.
Esse eixo é independente de equipe, regional e canal. Um nome de equipe ou regional não determina público. A classificação socioeconômica não constitui autorização comercial: a viabilidade deve ser consultada para a coordenada do imóvel.

## Arquitetura de integração

Web PAP → backend autenticado PAP → API Sales.
Tokens de integração ficam exclusivamente no servidor; não inserir em JavaScript estático, LocalStorage, exportações ou repositório. Uma credencial compartilhada de administrador não deve servir como autorização dos usuários do PAP: o backend precisa validar o escopo de cada solicitante. Preferir identidade delegada por usuário ou integração com privilégios mínimos e filtro de autorização no servidor.

Separar dados remotos dos cenários DEMO. Falha da API deve gerar estado indisponível ou dados anteriores com horário explícito, sem substituir silenciosamente por dados fictícios. Preservar IDs externos e não duplicar pessoas por variações de nomes.

## Pontos ainda não confirmados

- Schemas completos das respostas, paginação, filtros, limites e convenção de datas.
- Endpoint de equipes e relação usuário/equipe/perfil.
- Catálogo oficial de planos e regras por público/território.
- Existência de polígonos comerciais e sua classificação na API; CTOs não equivalem a polígonos.
- Estado, precisão, capacidade e horário de atualização das CTOs.
- GPS, jornadas e rotas: não documentados nas seções consultadas.
- Disponibilidade de webhooks ou atualização incremental.

## Aceite para a conexão real

1. Confirmar contratos ausentes e credencial apropriada por canal seguro.
2. Implementar adaptador no backend e respostas mínimas, sem encaminhar dados pessoais desnecessários.
3. Validar isolamento entre equipes com duas identidades de escopos diferentes.
4. Testar 401 (expirado/revogado), 403 (sem permissão), dados vazios, erros e indisponibilidade.
5. Conciliar IDs, contagens e amostras de registros com o Sales.
6. Liberar somente após autenticação Web e backend remoto estarem configurados.

Estado: documentação verificada e integração especificada. Não há conexão operacional implementada nesta entrega.
