# NDT Portal API — multi-stage build
# Stage 1: compile TypeScript (cached if only src/ changes)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: lean runtime image (no devDependencies, no source)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3100
CMD ["node", "dist/index.js"]
