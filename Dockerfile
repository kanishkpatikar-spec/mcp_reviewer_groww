FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src/ ./src/

# Install frontend dependencies and build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# Build TypeScript backend
RUN npx tsc

# Expose the API port (Railway uses PORT env var)
EXPOSE 3000

# Start the API server (includes scheduler)
CMD ["node", "dist/server.js"]
