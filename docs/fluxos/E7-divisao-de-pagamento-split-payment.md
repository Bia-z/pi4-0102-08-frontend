# Fluxo do E7: Divisão de pagamento (split payment)

**Feito quando:** Caixa fecha conta dividindo entre mais de uma forma de pagamento conferindo o total.

## Passos

1. O Operador do Caixa seleciona a mesa e insere os pagamentos fracionados (ex.: parte no PIX e parte no Cartão de Crédito).
2. O Frontend calcula os totais parciais e envia a requisição de pagamento ao Backend via contrato `processarPagamento` (CT14).
3. O Backend valida se a soma dos pagamentos fracionados cobre o valor total devido da mesa.
4. O Backend insere as movimentações de pagamento na tabela `tb_pagamento` (CT15) e atualiza o pedido para "Pago".
5. O Backend altera o status da mesa para "Disponível" na tabela `tb_mesa` (CT6).
6. O Backend retorna a confirmação da transação e o valor do troco (se houver).
7. O Frontend exibe a confirmação do pagamento e libera a mesa na interface visual do caixa.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Caixa as Operador de Caixa
    participant Frontend
    participant Backend
    participant Banco

    Caixa->>Frontend: seleciona formas de pagamento e valores
    Frontend->>Backend: CT14 processarPagamento
    Backend->>Backend: confere se soma bate com o total
    Backend->>Banco: CT15 tb_pagamento (INSERT)
    Backend->>Banco: CT6 tb_mesa (UPDATE status=Disponivel)
    Banco-->>Backend: transação gravada
    Backend-->>Frontend: resposta de pagamento concluído
    Frontend-->>Caixa: exibe comprovante e libera a mesa
