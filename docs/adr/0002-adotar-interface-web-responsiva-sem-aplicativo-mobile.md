# ADR 0002: Adotar interface web responsiva sem aplicativo mobile

**Status:** aceito

**Contexto:** O sistema precisa rodar em diferentes dispositivos dentro do restaurante, como celulares/tablets para os garçons no salão e computadores/monitores no caixa e na cozinha. A equipe possui prazo limitado no semestre e precisa de uma solução visual leve e rápida de implementar.

**Decisão:** Desenvolver o frontend como uma aplicação Web responsiva utilizando HTML, CSS e JavaScript, acessível diretamente pelo navegador dos dispositivos.

**Alternativas consideradas:**
- Aplicativo Mobile Nativo (Android/iOS): descartado porque dobraria o tempo de desenvolvimento e exigiria criar códigos separados para celulares e computadores, estourando o prazo do projeto.
- Sistema Desktop Instalável: descartado por dificultar o uso em tablets e celulares pelos garçons no salão.

**Consequências:**
- Positivas: código único que roda em qualquer aparelho com navegador de internet, facilidade de acesso sem instalar nada nos aparelhos e desenvolvimento mais rápido.
- Negativas: dependência constante de uma conexão Wi-Fi estável na rede local do restaurante para carregar e usar as páginas.
