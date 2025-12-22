# Giftasso API

Backend service for digital gift campaign management and e-commerce operations. Built with NestJS.

## Development Setup

### Prerequisites

- Node.js 20.x LTS
- MySQL 5.7
- pnpm 
- Docker & Docker Compose

### Initial Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Database setup:
```bash
# Development database
pnpm run migration:run

# Seed initial data (need to add)
```

4. Start development server:
```bash
pnpm run start:dev
```

## Production Deployment

### Docker (Recommended)

Secure, containerized deployment:
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with scaled services
docker-compose -f docker-compose.prod.yml up -d --scale metacard-backend=2
```

### Manual Deployment

1. Build application:
```bash
pnpm run build
```

2. Run migrations:
```bash
NODE_ENV=production pnpm run migration:run
```

3. Start server:
```bash
NODE_ENV=production pnpm run start:prod
```

## Environment Configuration

Critical production variables:

```env
# Database (Use connection pooling in production)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=giftasso_prod
DATABASE_PASSWORD=<strong-password>
DATABASE_NAME=giftasso_prod
DATABASE_SSL=true

# Security
JWT_SECRET=<min-32-char-secret>
JWT_ADMIN_SECRET=<min-32-char-secret>
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Logtail
LOGTAIL_TOKEN=<your-logtail-token>
```

## Security Considerations

1. **Database Access**
   - Use separate credentials for development/production
   - Enable SSL for database connections
   - Implement connection pooling

2. **API Security**
   - All endpoints are JWT-protected by default
   - Rate limiting enabled
   - CORS configured for approved domains only

3. **Environment**
   - Never commit `.env` files
   - Use secrets management in production
   - Regular security audits with `pnpm audit`

## Monitoring & Logging

- Sentry for error tracking
- Logtail for centralized logging
- Apitally for API metrics

## CI/CD Pipeline

Automated workflows available:

- **Code Quality**
  - ESLint checks on all PRs
  - Prettier formatting validation
  - Runs on push to main/develop
- Unit/Integration testing
- Security scanning
- Docker image building
- Database migration checks

## Development Guidelines

1. **Code Quality**
   ```bash
   # Run linting
   pnpm run lint
   
   # Check formatting
   pnpm run format:check
   
   # Fix formatting
   pnpm run format
   
   # Run tests
   pnpm run test
   ```

2. **Database Changes**
   ```bash
   # Create migration
   pnpm run migration:generate src/migrations/MigrationName
   
   # Test migration
   pnpm run migration:run
   ```

## License

Proprietary - Giftasso Enterprise License
All rights reserved.
