# Visão Geral do Sistema (RestManager)


---

## 1. Tabela de Módulos

| Módulo | O que faz | Tecnologia | Repositório | Responsável |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Interface web responsiva para Garçom, Cozinha, Caixa e Administrador | HTML5, CSS3 (Bootstrap), JavaScript (ES6) | `pi4-0102-08-frontend` | João Victor Teles Carneiro |
| **Backend** | Recebe as operações das telas, aplica as regras (autenticação por perfil, pedidos, pagamento e split, transferência de mesa), gera o comprovante em PDF e avisa a cozinha e o garçom em tempo real | Java, Spring Boot, Spring Security + JWT, WebSocket/STOMP | `pi4-0102-08-backend` | Beatriz Caroline Moreno Tavares |
| **Banco de Dados** | Persistência relacional de usuários, cardápio, mesas, pedidos, itens e movimentações de caixa | PostgreSQL | junto do Backend (`pi4-0102-08-backend`) | - |

---

## 2. Diagrama de Contêineres

```mermaid
flowchart TB
    garcom(["Garçom"])
    cozinha(["Cozinha"])
    caixa(["Operador de Caixa"])
    admin(["Administrador"])

    subgraph restmanager ["Sistema RestManager"]
        frontend["Frontend Web<br/>HTML/ CSS / JavaScript / Bootstrap<br/>Telas operacionais e responsivas"]
        backend["Backend API<br/>Java / Spring Boot<br/>Regras de negócio, segurança e WebSocket"]
        banco[("Banco de Dados<br/>PostgreSQL<br/>Usuários, cardápio, mesas, pedidos e caixa")]
    end

    garcom -->|usa| frontend
    cozinha -->|usa| frontend
    caixa -->|usa| frontend
    admin -->|usa| frontend

    frontend -->|"operações REST, HTTP/JSON"| backend
    backend -->|"atualizações de pedidos em tempo real, WebSocket/STOMP"| frontend
    backend -->|"lê e grava dados, SQL (JPA/Hibernate)"| banco
