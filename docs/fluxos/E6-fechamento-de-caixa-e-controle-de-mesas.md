# Fluxo do E6: Fechamento de caixa e controle de mesas

**Feito quando:** Caixa visualiza status de todas as mesas e valor total consumido em cada uma.

## Operações de turno, movimentações e relatórios

Ao entrar, o perfil CAIXA consulta `GET /api/caixa/aberto`; se não houver turno ativo, o frontend o abre automaticamente com valor inicial zero e turno definido pelo horário local (manhã: 06h–12h, tarde: 12h–18h, noite: 18h–06h). A tela de fechamento mostra o valor de abertura retornado pelo turno ativo junto ao resumo das vendas. Depois de fechar o turno, as páginas operacionais ficam bloqueadas; o caixa é encaminhado à tela de abertura e precisa abrir outro turno para voltar à área. ADMIN e CAIXA podem consultar o turno atual, e a abertura manual continua disponível por `POST /api/caixa/abrir` (valor inicial e turno MANHA, TARDE ou NOITE). Os turnos são fechados em `POST /api/caixa/fechar` (valor contado e resultado esperado/contado/diferença) e consultados em `GET /api/caixa/historico`. Sangrias e reforços são registrados em `POST /api/caixa/movimentacoes` e listados no mesmo recurso por GET. O relatório diário usa `GET /api/caixa/relatorios/{AAAA-MM-DD}` e permite abrir ou baixar seu PDF autenticado.

As configurações são consultáveis por ADMIN e CAIXA em `GET /api/caixa/configuracao`; somente ADMIN pode atualizar `PUT /api/caixa/configuracao`, incluindo a taxa de serviço entre 0 e 100% e a impressão de comanda ao aceitar um item.

Na tela inicial do CAIXA, a ação “Ver itens” de cada mesa abre a tela de pagamento correspondente. Nela, os pedidos e itens são exibidos com o status atualizado pela cozinha; pedidos abertos podem ser transferidos para uma mesa disponível antes de iniciar o pagamento. O pagamento também é iniciado e concluído nessa tela.

## Passos

1. O Operador do Caixa acessa a tela de Gestão de Mesas ou o Extrato da Conta.
2. O Frontend faz a requisição das mesas ativas e seus extratos via contrato `obterMapaMesas` (CT12).
3. O Backend consulta o banco para obter o status de cada mesa e calcular o somatório dos pedidos em aberto, via contrato `tb_pedido_extrato` (CT13).
4. O Banco retorna a consolidação dos consumos por mesa.
5. O Backend responde ao Frontend com a lista estruturada das mesas e valores consumidos.
6. O Frontend exibe o mapa visual com a indicação de mesas livres, ocupadas, reservadas e o valor parcial consumido.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Caixa as Operador de Caixa
    participant Frontend
    participant Backend
    participant Banco

    Caixa->>Frontend: abre o mapa de mesas / extrato
    Frontend->>Backend: CT12 obterMapaMesas
    Backend->>Banco: CT13 tb_pedido_extrato (SELECT & SUM)
    Banco-->>Backend: consumo detalhado por mesa
    Backend-->>Frontend: resposta com mapa e totais
    Frontend-->>Caixa: exibe mapa visual e valores das mesas
