# Imagem da API de Pagamentos (fictícia)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY openapi ./openapi

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:3000/saude || exit 1

CMD ["node", "src/server.js"]
