# Usa o nginx (servidor web leve) como base
FROM nginx:alpine

# Copia a configuração do nginx que você já tem no repo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia seus arquivos (index.html, pastas admin, caixa, etc.) para onde o nginx entrega
COPY . /usr/share/nginx/html

# Avisa que o nginx usa a porta 80
EXPOSE 80