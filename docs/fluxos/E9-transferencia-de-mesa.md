# Fluxo do E9: Transferência de mesa

**Feito quando:** Caixa transfere pedido em aberto de uma mesa para outra mantendo o histórico.

## Passos

1. O Operador do Caixa seleciona a mesa de origem e escolhe a nova mesa de destino para transferência.
2. O Frontend envia a requisição de transferência para o Backend via contrato `transferirMesa` (CT18).
3. O Backend verifica se a mesa de destino está disponível na tabela `tb_mesa` (CT6).
4. O Backend atualiza a chave estrangeira `mesa_id` do pedido em aberto na tabela `tb_pedido` para a nova mesa (CT8).
5. O Backend atualiza a mesa de origem para "Disponível" e a mesa de destino para "Ocupada" na tabela `tb_mesa` (CT6).
6. O Backend responde confirmando a transferência realizada com sucesso.
7. O Frontend atualiza visualmente o mapa do salão, movendo a comanda para a mesa de destino.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Caixa as Operador de Caixa
    participant Frontend
    participant Backend
    participant Banco

    Caixa->>Frontend: informa mesa de origem e destino
    Frontend->>Backend: CT18 transferirMesa
    Backend->>Banco: CT6 tb_mesa (verifica disponibilidade da destino)
    Backend->>Banco: CT8 tb_pedido (UPDATE mesa_id)
    Backend->>Banco: CT6 tb_mesa (UPDATE status origem e destino)
    Banco-->>Backend: alterações persistidas
    Backend-->>Frontend: confirmação de transferência
    Frontend-->>Caixa: atualiza o mapa de mesas na tela
