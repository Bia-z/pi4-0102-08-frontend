# Fluxo do E9: Transferência de mesa

**Feito quando:** Usuários CAIXA, GARÇOM e ADMIN transferem pedido em aberto de uma mesa para outra mantendo o histórico.

## Passos

1. Em uma mesa ocupada, perfis CAIXA, GARÇOM e ADMIN podem iniciar uma transferência, escolher o pedido em aberto e selecionar uma mesa de destino com status `disponivel`. A interface envia os IDs internos do pedido e da mesa, não os números apresentados.
2. O Frontend envia `POST /api/pedidos/{pedidoId}/transferir-mesa` com `{ "mesaDestinoId": 8 }` e o token JWT.
3. O Backend valida se o pedido está em aberto e se a mesa de destino está disponível, então transfere o pedido.
4. O Backend responde com `pedidoId`, `mesaOrigemId`, `mesaDestinoId` e `transferidoEm`.
5. O Backend publica atualizações de mesa no tópico STOMP `/topic/mesas`. O Frontend atualiza o mapa ao receber `statusMesaAtualizado`.
6. A mesa de origem só fica disponível se não houver outros pedidos abertos nela.

Erros tratados: `MESA_DESTINO_OCUPADA`, `MESA_EM_PAGAMENTO`, `PEDIDO_NAO_EM_ABERTO` e `MESA_NAO_ENCONTRADA`.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Usuario as CAIXA, GARÇOM ou ADMIN
    participant Frontend
    participant Backend
    participant Banco

    Usuario->>Frontend: escolhe pedido em aberto e mesa disponível
    Frontend->>Backend: POST /api/pedidos/{pedidoId}/transferir-mesa
    Backend->>Banco: valida pedido e disponibilidade do destino
    Backend->>Banco: transfere pedido e recalcula status das mesas
    Banco-->>Backend: alterações persistidas
    Backend-->>Frontend: pedidoId, mesaOrigemId, mesaDestinoId, transferidoEm
    Backend-->>Frontend: STOMP /topic/mesas: statusMesaAtualizado
    Frontend-->>Usuario: atualiza mapa conforme eventos recebidos
