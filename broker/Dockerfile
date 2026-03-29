# Copilot Studio Direct Line broker — production image (Node 20 LTS)
FROM node:20-bookworm-slim

LABEL org.opencontainers.image.title="Copilot Studio Direct Line broker"
LABEL org.opencontainers.image.description="Express broker for Copilot Studio via Direct Line v3 + OpenAI-compatible API"
LABEL org.opencontainers.image.source="https://github.com/twgcriot/RT_Azure_Co-PilotStudio"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const p=Number(process.env.PORT)||8080;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
