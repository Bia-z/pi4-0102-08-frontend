# RestManager · Frontend

Interface web do RestManager em HTML, CSS (Bootstrap 5) e JavaScript ES6, servida pelo nginx. As chamadas para `/api` e `/ws` são repassadas ao backend.

## Como rodar

O frontend sobe junto com o backend e o banco pelo `compose.yaml` do repositório [pi4-0102-08-backend](https://github.com/Bia-z/pi4-0102-08-backend). Os dois repositórios precisam estar na mesma pasta:

```
pi4-0102-08-backend/
pi4-0102-08-frontend/
```

Depois, dentro de `pi4-0102-08-backend`:

```
docker compose up -d --build
```

A aplicação fica em http://localhost:3000.

## Usuários de teste

Todos com a senha `restmanager123`.

| Código | Perfil |
| :--- | :--- |
| `admin` | Administrador |
| `garcom1`, `garcom2` | Garçom |
| `cozinha` | Cozinha |
| `caixa` | Caixa |

## Estrutura

| Pasta | Conteúdo |
| :--- | :--- |
| `admin/` | Funcionários, itens do cardápio e mesas |
| `garcom/` | Mapa de mesas, cardápio, lançamento e acompanhamento de pedidos |
| `cozinha/` | Painel de pedidos em tempo real e impressão de comandas |
| `caixa/` | Turno, mapa de mesas, pagamento, comprovante, sangria, relatórios e configurações |
| `assets/js/core/` | Código comum: API, sessão, proteção das páginas, WebSocket e mapa de mesas |
| `tests/` | Testes automatizados |
| `docs/` | Fluxos de cada entrega e ADR |

## Testes

Requer Node.js 20 ou superior.

```
npm test
```
