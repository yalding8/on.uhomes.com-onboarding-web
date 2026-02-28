# Multi-stage build for Extraction Worker
# Base: Playwright image with Chromium pre-installed

# ── Stage 1: Install dependencies ──
FROM mcr.microsoft.com/playwright:v1.49.0-noble AS deps

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

# ── Stage 2: Build TypeScript ──
FROM deps AS builder

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ── Stage 3: Production image ──
FROM mcr.microsoft.com/playwright:v1.49.0-noble AS runner

WORKDIR /app

# Only install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled JS
COPY --from=builder /app/dist/ ./dist/

# Only install Chromium (skip Firefox/WebKit to save space)
RUN npx playwright install chromium

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
