# ST1 Sales PAP — Critérios e evidências de homologação v0.2

**Escopo do ambiente:** Windows Node local e código-fonte Expo Android/iOS. Não representa integração com ST1 Sales ou IXC.

## Automatizados (Node)

Execute `npm test` na raiz. Verifique cobertura dos cenários:

- geografia: pontos dentro/fora, buracos de polígonos, áreas sobrepostas, CTO errada e sem portas;
- matriz comercial: regra negativa, ausência de regra, CTO sem verificação recente;
- credenciais: pareamento de uso único de 10 minutos, rejeição de vendedores fictícios, revogação imediata;
- segurança: API móvel não publica rotas `/api/*` do painel, autenticação obrigatória, equipe somente supervisor;
- jornada: início/fim, GPS somente dentro da jornada, precisão/timestamp e taxa de envio;
- visitas: registro atribuído ao autor, leitura por equipe somente quando supervisor, expurgo em 7 dias;
- Traccar: integração opcional e exibição de frescor.

## Validações manuais no PC

| Etapa | Procedimento | Resultado esperado |
|---|---|---|
| Web | `INICIAR.bat`, abrir `http://127.0.0.1:4173` | Painel inicia e API móvel não é visível na rede |
| Demo | Carregar cenário | 3 pessoas fictícias, 2 áreas, 2 CTOs e 2 planos de teste |
| Cadastro | Adicionar vendedor não fictício | Cadastro criado sem modificar sistemas externos |
| Pareamento | `Aplicativo PAP` → emitir código | Exibir somente uma vez, validade 10min, código armazenado somente em hash |
| Rede | `INICIAR-LAN-TESTE.bat` e acesso à porta 4174 | Somente `/mobile/v1/*` acessível ao celular |
| Revogação | Revogar sessão pareada | Próxima consulta 401, jornada encerrada no servidor |
| Localização | Simular envio de app com token e jornada aberta | Fonte APP PAP no Web e timestamp explícito |
| Oferta | Avaliar endereço em local/CTO inválidos | Regras negativas nunca liberam; resultado rotulado `labOnly` |

## Validações reais pendentes (não realizadas nesta entrega)

1. `npm install` e build Android com EAS: desenvolvimento e preview.
2. Build iOS físico assinado, cadastro UDID do dispositivo e instalação.
3. Consentimento/avisos de GPS e seleção de permissão Always/segundo plano.
4. GPS com app em uso, em segundo plano e encerrado; verificar política do fabricante e iOS.
5. Rede celular/fora da LAN por HTTPS homologado e autenticação de gestores Web.
6. Teste de carga com vendedores simultâneos, indisponibilidade de internet e expiração de tokens.
7. Revisão de segurança, privacidade, necessidade de coleta, retenção, LGPD e publicação.
8. Homologação de contrato/API do ST1 Sales pelo responsável técnico autorizado.

**Nunca confundir simulação local, testes de API Node, compilação nativa e integração em produção.**
