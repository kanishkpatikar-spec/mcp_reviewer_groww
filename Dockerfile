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

# Start the scheduler
CMD ["node", "dist/scheduler.js"]
