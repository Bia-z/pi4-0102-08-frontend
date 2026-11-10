# Fluxo do E2: Cadastro de mesas e cardápio

**Feito quando:** Admin cadastra produtos com nome, preço e categoria; o garçom consulta os produtos ativos agrupados por categoria.

## Passos

1. O Administrador preenche o cadastro do produto no painel gerencial. As categorias são carregadas do cardápio; descrição e imagem são opcionais. As categorias do cardápio são Entradas, Pratos principais, Sobremesas, Adicionais e Bebidas.
2. O Frontend envia `POST /api/produtos` com o token do administrador no cabeçalho `Authorization: Bearer <token>` e corpo JSON (CT4).
3. O Backend valida o preço, a categoria e a duplicidade, persiste o produto e responde com `201 Created`.
4. O garçom consulta o cardápio e o Frontend envia `GET /api/cardapio` com o token no cabeçalho `Authorization: Bearer <token>`.
5. O Backend responde com produtos ativos agrupados por categoria ativa e o Frontend exibe os dados.

## Cadastro de mesas

1. O Administrador informa o número e a capacidade da mesa no painel gerencial.
2. O Frontend envia `POST /api/mesas` com o token no cabeçalho `Authorization: Bearer <token>` e corpo JSON contendo `numero` e `capacidade` (CT5).
3. O Backend valida e grava a mesa em `tb_mesa` (CT6), respondendo com `201 Created`; o Frontend confirma o número e a capacidade retornados.
4. Se o número já existir ou a capacidade for inválida, o Frontend informa o erro retornado pelo Backend.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Admin as Administrador
    actor Garcom as Garçom
    participant Frontend
    participant Backend
    participant Banco

    Admin->>Frontend: preenche dados do produto
    Frontend->>Backend: POST /api/produtos (Bearer token)
    Backend->>Backend: valida preço, categoria e duplicidade
    Backend->>Banco: persiste produto
    Banco-->>Backend: produto salvo
    Backend-->>Frontend: 201 Created

    Garcom->>Frontend: abre o cardápio
    Frontend->>Backend: GET /api/cardapio (Bearer token)
    Backend-->>Frontend: produtos ativos por categoria ativa
    Frontend-->>Garcom: exibe o cardápio

    Admin->>Frontend: preenche dados da mesa
    Frontend->>Backend: CT5 cadastrarMesa
    Backend->>Backend: valida número e capacidade
    Backend->>Banco: grava em tb_mesa (CT6)
    Banco-->>Backend: mesa salva
    Backend-->>Frontend: confirmação da mesa
