# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm install --workspace server --ignore-scripts
COPY server ./server
RUN npm run build --workspace server

# --- runtime stage ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm install --workspace server --omit=dev --ignore-scripts
COPY --from=build /app/server/dist ./server/dist
EXPOSE 1234
CMD ["node", "server/dist/index.js"]
