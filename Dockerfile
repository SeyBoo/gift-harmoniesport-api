# Stage 1: Builder – install dependencies and build the app
FROM node:20 AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files for caching dependency installation
COPY package*.json ./
RUN pnpm install --no-frozen-lockfile

# Copy the rest of your source code and build the project
COPY . .
RUN pnpm run build

# Stage 2: Production – use a lightweight image for runtime
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm in the production image
RUN npm install -g pnpm

# Copy all the built files and dependencies from the builder stage
COPY --from=builder /app .

# Datadog environment variables
ENV DD_AGENT_HOST="datadog-agent"
ENV DD_TRACE_AGENT_PORT=8126
ENV DD_PROFILING_ENABLED=true
ENV DD_LOGS_INJECTION=true
ENV DD_RUNTIME_METRICS_ENABLED=true

EXPOSE 3000
EXPOSE 8080

# Run migrations then start the application
CMD ["sh", "-c", "pnpm run migration:run && pnpm run start:prod"]
