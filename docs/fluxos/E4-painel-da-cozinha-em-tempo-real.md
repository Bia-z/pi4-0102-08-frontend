# Fluxo do E4: Painel da cozinha em tempo real

**Feito quando:** Cozinha visualiza pedidos novos automaticamente por ordem de chegada via WebSocket.

Quando um item é aceito e passa de `AGUARDANDO` para `EM_PREPARO`, a cozinha também assina `/topic/comandas`. Se a configuração `imprimirComandaAoAceitar` estiver ativa, o Backend publica a comanda; o Frontend busca os detalhes do pedido, exibe pedido, mesa, garçom, horário, itens, quantidades, observações e status, e inicia a impressão.

## Passos

1. O Garçom finaliza e envia um novo pedido no salão.
2. O Frontend envia o pedido ao Backend com a operação `criarPedido` (CT7).
3. O Backend grava o pedido no banco de dados nas tabelas `tb_pedido` e `tb_item_pedido` (CT8).
4. O Backend dispara um evento em tempo real via WebSocket pelo canal STOMP com o contrato `pedidoCriado` (CT9).
5. O painel da Cozinha recebe a notificação instantânea sem necessidade de recarregar a página.
6. O Frontend da Cozinha renderiza o novo card na tela por ordem cronológica de chegada com status "Aguardando".

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Garcom as Garçom
    actor Cozinha as Cozinha
    participant Frontend
    participant Backend
    participant Banco

    Garcom->>Frontend: envia novo pedido da mesa
    Frontend->>Backend: CT7 criarPedido
    Backend->>Banco: CT8 tb_pedido / tb_item_pedido (INSERT)
    Banco-->>Backend: pedido salvo
    Backend-->>Frontend: CT9 pedidoCriado (WebSocket/STOMP)
    Frontend-->>Cozinha: exibe novo card no totem da cozinha
