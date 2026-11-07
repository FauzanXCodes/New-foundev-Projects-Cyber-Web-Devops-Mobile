# The Rally API. No dependencies and no build step: Node runs the TypeScript directly.
FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY assets/icon.png ./assets/icon.png
# The data file lives on a mounted volume, so it survives deploys and restarts.
ENV PORT=8080 DATA_FILE=/data/db.json NODE_ENV=production
EXPOSE 8080
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "server/index.ts"]
