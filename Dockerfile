FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# 依存パッケージはない（Node 標準の http だけで動く）
COPY package.json app.js ./
COPY public ./public

USER node
EXPOSE 8750
CMD ["node", "app.js"]
