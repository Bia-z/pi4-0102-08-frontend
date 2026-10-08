# Fluxo do E5: Atualização de status do pedido

**Feito quando:** Cozinha muda pedido de 'novo' para 'em preparo' e 'pronto', refletindo no garçom.

## Passos

1. O cozinheiro clica na tela para alterar o status do pedido (ex.: de "Aguardando" para "Em Preparo" ou "Pronto").
2. O Frontend da Cozinha chama o Backend com a operação `atualizarStatusPedido` (CT10).
3. O Backend valida a transição de estado permitida e atualiza a coluna `status` na tabela `tb_pedido` (CT8).
4. O Backend envia a notificação WebSocket `statusPedidoAtualizado` (CT11) para todos os painéis ativos.
5. O painel do Garçom e o totem da Cozinha recebem o evento e atualizam a visualização do pedido em tempo real.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Cozinha as Cozinha
    actor Garcom as Garçom
    participant Frontend
    participant Backend
    participant Banco

    Cozinha->>Frontend: clica em "Aceitar Pedido" / "Pronto"
    Frontend->>Backend: CT10 atualizarStatusPedido
    Backend->>Banco: CT8 tb_pedido (UPDATE status)
    Banco-->>Backend: status atualizado
    Backend-->>Frontend: CT11 statusPedidoAtualizado (WebSocket)
    Frontend-->>Cozinha: atualiza aba e cor do card
    Frontend-->>Garcom: sinaliza que o prato está pronto
