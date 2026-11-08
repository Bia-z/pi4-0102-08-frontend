# Fluxo do E6: Fechamento de caixa e controle de mesas

**Feito quando:** Caixa visualiza status de todas as mesas e valor total consumido em cada uma.

## Operações de turno, movimentações e relatórios

Os perfis ADMIN e CAIXA consultam o turno atual em `GET /api/caixa/aberto`, abrem turnos em `POST /api/caixa/abrir` (valor inicial e turno MANHA, TARDE ou NOITE), fecham em `POST /api/caixa/fechar` (valor contado e resultado esperado/contado/diferença) e consultam `GET /api/caixa/historico`. Sangrias e reforços são registrados em `POST /api/caixa/movimentacoes` e listados no mesmo recurso por GET. O relatório diário usa `GET /api/caixa/relatorios/{AAAA-MM-DD}` e permite abrir ou baixar seu PDF autenticado.

As configurações são consultáveis por ADMIN e CAIXA em `GET /api/caixa/configuracao`; somente ADMIN pode atualizar `PUT /api/caixa/configuracao`, incluindo a taxa de serviço entre 0 e 100% e a impressão de comanda ao aceitar um item.

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
