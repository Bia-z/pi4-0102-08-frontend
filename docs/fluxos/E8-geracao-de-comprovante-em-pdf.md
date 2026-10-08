# Fluxo do E8: Geração de comprovante em PDF

**Feito quando:** Sistema gera PDF formatado dos itens consumidos para download/impressão.

## Passos

1. O Operador de Caixa clica no botão "Imprimir" ou "Gerar Comprovante" no detalhe da mesa ou fechamento.
2. O Frontend faz uma requisição HTTP GET para o contrato `gerarComprovantePDF` (CT16) informando o ID da mesa ou do pedido.
3. O Backend busca o histórico completo do consumo e pagamentos nas tabelas `tb_pedido`, `tb_item_pedido` e `tb_pagamento` (CT17).
4. O Backend compila e formata os dados gerando o arquivo binário em formato PDF (`application/pdf`).
5. O Backend envia o arquivo PDF como resposta no fluxo HTTP.
6. O Frontend recebe o arquivo e abre automaticamente o modal de visualização/download ou aciona o diálogo de impressão do navegador.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Caixa as Operador de Caixa
    participant Frontend
    participant Backend
    participant Banco

    Caixa->>Frontend: solicita geração do comprovante
    Frontend->>Backend: CT16 gerarComprovantePDF
    Backend->>Banco: CT17 tb_pedido / tb_item_pedido / tb_pagamento (SELECT)
    Banco-->>Backend: extrato completo
    Backend->>Backend: compila documento em PDF
    Backend-->>Frontend: retorna arquivo PDF (application/pdf)
    Frontend-->>Caixa: exibe PDF para download/impressão
