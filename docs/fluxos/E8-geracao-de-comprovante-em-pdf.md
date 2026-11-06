# Fluxo do E8: Geração de comprovante em PDF

**Feito quando:** Após a confirmação do pagamento, o Operador de Caixa pode baixar o comprovante PDF da conta.

## Passos

1. Após o pagamento ser confirmado, o Frontend habilita "Baixar comprovante" usando um dos IDs de `pedidosPagos` retornados pela API.
2. Ao clicar, o Frontend faz `GET /api/pedidos/{pedidoId}/comprovante-pdf` com o token JWT no cabeçalho `Authorization: Bearer`.
3. O Backend verifica que a conta está paga, compila o comprovante e responde com o arquivo `application/pdf`.
4. O Frontend baixa o arquivo para o usuário.
5. Se o Backend retornar erro, o Frontend exibe o código correspondente, incluindo `CONTA_NAO_PAGA`.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Caixa as Operador de Caixa
    participant Frontend
    participant Backend
    participant Banco

    Backend-->>Frontend: pagamento confirmado + pedidosPagos
    Frontend-->>Caixa: habilita "Baixar comprovante"
    Caixa->>Frontend: clica para baixar
    Frontend->>Backend: GET /api/pedidos/{pedidoId}/comprovante-pdf (Bearer JWT)
    Backend->>Banco: verifica pagamento e consulta dados da conta
    Banco-->>Backend: conta paga e dados do comprovante
    Backend-->>Frontend: arquivo PDF (application/pdf)
    Frontend-->>Caixa: inicia download do PDF
    Backend-->>Frontend: erro CONTA_NAO_PAGA (se aplicável)
    Frontend-->>Caixa: mostra erro retornado
