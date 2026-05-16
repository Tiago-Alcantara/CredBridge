FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci --workspace=packages/types --workspace=packages/anchor-client --workspace=apps/api --ignore-scripts

RUN npm run build:types
RUN npm run build -w packages/anchor-client
RUN npm run build -w apps/api

WORKDIR /app/apps/api

RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
