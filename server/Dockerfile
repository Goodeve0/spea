# 后端镜像：HTTP API(账号/数据) + WS(对话/TTS/ASR) + SQLite
# 用 node:20（含 openssl，Prisma 需要）。密钥一律通过运行时环境变量注入，不打进镜像。
FROM node:20

WORKDIR /app

# 先拷依赖清单，利用层缓存
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# 拷后端与共享源码（.dockerignore 已排除 .env / db / node_modules）
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server

# 生成 Prisma Client
WORKDIR /app/server
RUN npx prisma generate

EXPOSE 3001 3002

# 启动：先把迁移应用到数据库（SQLite 文件在挂载卷），再运行服务
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/main.ts"]
