# Fluxo do E3: Lançamento de pedido pelo garçom

**Feito quando:** Garçom escolhe mesa, adiciona itens com observação e registra o pedido na mesa.

## Passos

1. O Garçom seleciona uma mesa disponível, escolhe os produtos no cardápio e adiciona observações.
2. O Frontend envia a requisição de criação do pedido para o Backend via contrato `criarPedido` (CT7).
3. O Backend valida a disponibilidade da mesa e registra o pedido na tabela `tb_pedido` e seus itens em `tb_item_pedido` (CT8).
4. O Backend atualiza o status da mesa para "Ocupada" na tabela `tb_mesa` (CT6).
5. O Backend retorna ao Frontend a confirmação do pedido registrado com o valor total atualizado.
6. O Frontend exibe ao Garçom a confirmação do envio do pedido e atualiza a cor da mesa.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Garcom as Garçom
    participant Frontend
    participant Backend
    participant Banco

    Garcom->>Frontend: seleciona mesa, itens e observações
    Frontend->>Backend: CT7 criarPedido
    Backend->>Banco: CT8 tb_pedido / tb_item_pedido (INSERT)
    Banco-->>Backend: pedido gravado
    Backend->>Banco: CT6 tb_mesa (UPDATE status=Ocupada)
    Banco-->>Backend: mesa atualizada
    Backend-->>Frontend: confirmação do pedido registrado
    Frontend-->>Garcom: confirma envio e mostra mesa ocupada
