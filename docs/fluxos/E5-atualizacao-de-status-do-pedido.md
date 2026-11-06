# Fluxo do E5: Atualização de status dos itens do pedido

**Feito quando:** Cozinha ou Admin atualiza o status de um item de pedido de `aguardando` para `em_preparo` e depois para `pronto`, refletindo nos painéis conectados.

## Passos

1. Um usuário com perfil `COZINHA` ou `ADMIN` solicita a atualização de um item.
2. O frontend chama `PATCH /api/pedidos/{pedidoId}/itens/{itemId}/status` com `{ "novoStatus": "em_preparo" }` ou `{ "novoStatus": "pronto" }`.
3. O backend valida o perfil e a transição permitida (`aguardando` → `em_preparo` → `pronto`) e retorna `pedidoId`, `itemId`, `status` e `atualizadoEm`.
4. O backend publica no tópico STOMP `/topic/pedidos` uma mensagem `statusPedidoAtualizado` com `tipo`, `pedidoId`, `itemId`, `numeroMesa`, `status` e `atualizadoEm`.
5. Os painéis conectados localizam o item por `pedidoId` e `itemId` e atualizam sua visualização.

Erros de domínio retornados pelo backend: `PEDIDO_NAO_ENCONTRADO`, `ITEM_PEDIDO_NAO_ENCONTRADO`, `TRANSICAO_STATUS_INVALIDA` e `ACESSO_NEGADO`.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Cozinha as Cozinha
    actor Cozinha as Cozinha
    actor Garcom as Garçom
    participant Frontend
    participant Backend
    participant Banco

    Cozinha->>Frontend: atualiza status do item
    Frontend->>Backend: PATCH /api/pedidos/{pedidoId}/itens/{itemId}/status
    Backend->>Banco: valida e atualiza status do item
    Banco-->>Backend: status atualizado
    Backend-->>Frontend: pedidoId, itemId, status, atualizadoEm
    Backend-->>Frontend: STOMP /topic/pedidos: statusPedidoAtualizado
    Frontend-->>Cozinha: atualiza item correspondente
    Frontend-->>Garcom: atualiza item correspondente
