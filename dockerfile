# ---- Stage 1: build ----
# Start from a small Linux image that already has Node 22
FROM node:22-alpine AS build
WORKDIR /app

# Copy only the package files first, so Docker can reuse the
# installed packages when only your code changes (faster builds)
COPY package*.json ./
RUN npm ci

# Now copy the code and compile TypeScript into dist/ e
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: run ----
# A fresh, clean image: only what's needed to run, nothing used for building
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]