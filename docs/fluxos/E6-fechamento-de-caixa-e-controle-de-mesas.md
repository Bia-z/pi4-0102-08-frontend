# Fluxo do E6: Fechamento de caixa e controle de mesas

**Feito quando:** Caixa visualiza status de todas as mesas e valor total consumido em cada uma.

## Passos

1. O Operador do Caixa acessa a tela de Gestão de Mesas ou o Extrato da Conta.
2. O Frontend faz a requisição das mesas ativas e seus extratos via contrato `obterMapaMesas` (CT12).
3. O Backend busca no banco o status de cada mesa (`tb_mesa`) e calcula o somatório dos pedidos em aberto (`tb_pedido` e `tb_item_pedido`) (CT13).
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
    Backend->>Banco: CT13 tb_mesa / tb_pedido (SELECT & SUM)
    Banco-->>Backend: consumo detalhado por mesa
    Backend-->>Frontend: resposta com mapa e totais
    Frontend-->>Caixa: exibe mapa visual e valores das mesas
