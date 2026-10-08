# Fluxo do E1: Cadastro e autenticação de usuários

**Feito quando:** Admin cadastra funcionário com nome, e-mail e perfil; usuário faz login e acessa apenas sua área.

## Passos

1. O Administrador preenche o formulário com dados do novo funcionário e perfil de acesso.
2. O Frontend envia a requisição de cadastro para o Backend com o contrato `cadastrarUsuario` (CT1).
3. O Backend valida as informações e persiste o novo usuário na tabela `tb_usuario` (CT2).
4. O Backend responde ao Frontend confirmando o cadastro do funcionário.
5. O funcionário insere suas credenciais na tela de login.
6. O Frontend chama o Backend para autenticação com o contrato `autenticarUsuario` (CT3).
7. O Backend valida as credenciais na tabela `tb_usuario` (CT2) e gera um token JWT contendo o perfil de acesso.
8. O Frontend armazena o token e redireciona o usuário estritamente para a sua área correspondente ao perfil.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor Admin as Administrador
    actor Usuario as Funcionário
    participant Frontend
    participant Backend
    participant Banco

    Admin->>Frontend: cadastra novo funcionário e perfil
    Frontend->>Backend: CT1 cadastrarUsuario
    Backend->>Banco: CT2 tb_usuario (INSERT)
    Banco-->>Backend: confirmação
    Backend-->>Frontend: usuário cadastrado com sucesso

    Usuario->>Frontend: insere código e senha no login
    Frontend->>Backend: CT3 autenticarUsuario
    Backend->>Banco: CT2 tb_usuario (SELECT)
    Banco-->>Backend: dados do usuário e perfil
    Backend-->>Frontend: token JWT com perfil retornado
    Frontend-->>Usuario: direciona para a tela do perfil
