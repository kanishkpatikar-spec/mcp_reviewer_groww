FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript → JavaScript
RUN npx tsc

# Expose the API port (Railway uses PORT env var)
EXPOSE 3000

# Start the API server (includes scheduler)
CMD ["node", "dist/server.js"]
