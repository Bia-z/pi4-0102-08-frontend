# Fluxo do E2: Cadastro de mesas e cardápio

**Feito quando:** Admin cadastra produtos com nome/preço e mesas com número/capacidade.

## Passos

1. O Administrador preenche o cadastro de um novo produto do cardápio ou de uma nova mesa no painel gerencial.
2. O Frontend envia os dados para o Backend utilizando o contrato `cadastrarProduto` (CT4) ou `cadastrarMesa` (CT5).
3. O Backend valida se os dados obrigatórios estão preenchidos e sem duplicidade.
4. O Backend grava as informações nas tabelas `tb_produto` / `tb_categoria` ou `tb_mesa` (CT6).
5. O Banco confirma a gravação dos registros.
6. O Backend responde ao Frontend confirmando o sucesso da operação.
7. O Frontend atualiza a listagem de produtos ou o mapa de mesas na tela do Administrador.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Admin as Administrador
    participant Frontend
    participant Backend
    participant Banco

    Admin->>Frontend: preenche dados do produto ou mesa
    Frontend->>Backend: CT4 cadastrarProduto / CT5 cadastrarMesa
    Backend->>Backend: valida campos e duplicidade
    Backend->>Banco: CT6 tb_produto / tb_mesa (INSERT)
    Banco-->>Backend: registro salvo
    Backend-->>Frontend: resposta de confirmação
    Frontend-->>Admin: exibe item cadastrado na lista
