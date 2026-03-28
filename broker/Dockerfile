# Copilot Studio Direct Line broker — production image (Node 20 LTS)
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
