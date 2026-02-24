# Qline Backend — Roadmap & Future Recommendations

> **Last updated:** 2026-02-24
> This document outlines what has been done so far and what should be implemented next to make Qline a production-ready, SaaS-worthy queue management platform.

---

## Table of Contents

- [Current State](#current-state)
- [Phase 1 — Foundation Hardening (Priority: Critical)](#phase-1--foundation-hardening-priority-critical)
- [Phase 2 — Core Feature Expansion (Priority: High)](#phase-2--core-feature-expansion-priority-high)
- [Phase 3 — SaaS & Monetization (Priority: Medium)](#phase-3--saas--monetization-priority-medium)
- [Phase 4 — Scale & Performance (Priority: Medium)](#phase-4--scale--performance-priority-medium)
- [Phase 5 — Advanced Features (Priority: Low)](#phase-5--advanced-features-priority-low)
- [Architecture Recommendations](#architecture-recommendations)
- [DevOps & Infrastructure](#devops--infrastructure)

---

## Current State

### What's Implemented ✅

| Module         | Features                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| **Auth**       | Local registration/login, Google OAuth, JWT (cookie + Bearer), password reset   |
| **Queue**      | Create, join, status, QR code verification, participant prioritization          |
| **Email**      | Password-reset emails via Nodemailer (branded HTML template)                    |
| **Database**   | PostgreSQL via TypeORM with User, Queue, and QueueEntry entities                |
| **Validation** | Global `ValidationPipe` with class-validator DTOs                               |

### What's Missing ❌

- No Swagger/OpenAPI documentation
- No rate limiting or throttling
- No logging framework (structured logs)
- No database migrations (relying on `synchronize: true`)
- No real-time updates (WebSockets)
- No multi-tenancy or subscription tiers
- No admin dashboard API
- No analytics or metrics collection
- No comprehensive test coverage
- No CI/CD pipeline configuration

---

## Phase 1 — Foundation Hardening (Priority: Critical)

These are **must-have** items before Qline can be considered production-ready.

### 1.1 Database Migrations
- [ ] Set up TypeORM migrations (`typeorm migration:generate`, `migration:run`)
- [ ] Disable `synchronize: true` in production
- [ ] Create a seed script for development data
- [ ] Add proper database indexes for frequently queried columns (`queueId`, `userId`, `status`, `position`)

### 1.2 Swagger / OpenAPI Documentation
- [ ] Install `@nestjs/swagger`
- [ ] Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` decorators to all controllers
- [ ] Add `@ApiProperty` decorators to all DTOs and entities
- [ ] Expose Swagger UI at `/api/docs`

### 1.3 Rate Limiting & Throttling
- [ ] Install `@nestjs/throttler`
- [ ] Apply global rate limiting (e.g. 100 requests per minute)
- [ ] Apply stricter limits on auth endpoints (login, register, forgot-password)
- [ ] Apply stricter limits on queue-join to prevent abuse

### 1.4 Structured Logging
- [ ] Replace `console.log` with a proper logger (e.g. `@nestjs/common`'s `Logger` or `winston`/`pino`)
- [ ] Add request logging middleware (method, URL, status code, response time)
- [ ] Add contextual logging in services (user ID, queue ID)
- [ ] Configure log levels per environment (verbose in dev, warn+ in production)

### 1.5 Error Handling & Response Format
- [ ] Create a global exception filter for consistent error response shapes:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "errors": [{ "field": "email", "message": "email must be a valid email" }],
    "timestamp": "2026-02-24T12:00:00.000Z"
  }
  ```
- [ ] Handle unexpected errors gracefully (don't leak stack traces in production)
- [ ] Add a custom `HttpExceptionFilter`

### 1.6 Security Hardening
- [ ] Install `helmet` for secure HTTP headers
- [ ] Add CSRF protection for cookie-based auth
- [ ] Validate and sanitize all user input (prevent XSS in custom fields)
- [ ] Implement account lockout after repeated failed login attempts
- [ ] Add password complexity requirements (uppercase, number, special char)
- [ ] Rotate JWT secrets via environment variable without downtime

### 1.7 Comprehensive Testing
- [ ] Write unit tests for `AuthService` (register, login, password reset flows)
- [ ] Write unit tests for `QueueService` (create, join, prioritize, verify)
- [ ] Write e2e tests for all API endpoints using `supertest`
- [ ] Set up test database for integration tests
- [ ] Achieve >80% code coverage

---

## Phase 2 — Core Feature Expansion (Priority: High)

### 2.1 Real-Time Updates (WebSockets)
- [ ] Install `@nestjs/websockets` and `@nestjs/platform-socket.io`
- [ ] Create a `QueueGateway` that emits events when:
  - A user joins/leaves a queue
  - Positions are updated
  - A queue status changes (active → paused → closed)
  - It's a user's turn (serving)
- [ ] Implement room-based subscriptions (one room per queue)
- [ ] Add JWT authentication to WebSocket connections

### 2.2 Queue Lifecycle Management
- [ ] **Serve next** — Move the first `WAITING` entry to `SERVING` status
- [ ] **Complete service** — Move a `SERVING` entry to `COMPLETED` status
- [ ] **Cancel entry** — Allow users to leave a queue (self-cancel)
- [ ] **Pause/Resume queue** — Allow owners to temporarily stop accepting new joins
- [ ] **Close queue** — Permanently close a queue and notify all waiting participants
- [ ] **Auto-close** — Schedule queue closure at a specific time

### 2.3 Queue Discovery & Search
- [ ] Add a public `GET /queues/browse` endpoint with pagination
- [ ] Support filtering by status, location, category
- [ ] Support text search on queue name/description
- [ ] Add queue categories/tags

### 2.4 Notifications
- [ ] In-app push notifications (Firebase Cloud Messaging for mobile)
- [ ] Email notifications for position updates ("You're next!")
- [ ] SMS notifications (Twilio integration — optional, paid feature)
- [ ] Notification preferences per user

### 2.5 Queue Analytics (Owner Dashboard)
- [ ] Average wait time per queue
- [ ] Peak hours and busiest days
- [ ] Total participants served (daily, weekly, monthly)
- [ ] No-show rate (cancelled vs completed)
- [ ] Custom field data aggregation

---

## Phase 3 — SaaS & Monetization (Priority: Medium)

### 3.1 Multi-Tenancy & Organizations
- [ ] Create an `Organization` entity (name, owner, members, plan)
- [ ] Associate queues with organizations (not just individual users)
- [ ] Implement role-based access control (RBAC):
  - **Owner** — full control
  - **Manager** — can create/manage queues, serve participants
  - **Member** — can view queues and analytics
- [ ] Invite members via email

### 3.2 Subscription Plans & Billing
- [ ] Integrate Stripe for payment processing
- [ ] Define tiered plans:
  | Plan       | Queues/Day | Max Participants | Custom Branding | Analytics | Priority Support |
  |------------|-----------|-----------------|-----------------|-----------|------------------|
  | **Free**   | 3         | 50              | ❌              | Basic     | ❌               |
  | **Pro**    | 10        | 200             | ✅              | Advanced  | ❌               |
  | **Business** | Unlimited | 1000          | ✅              | Full      | ✅               |
- [ ] Create `Subscription` entity and middleware to enforce plan limits
- [ ] Implement usage tracking and overage alerts
- [ ] Add Stripe webhook handlers for subscription events

### 3.3 Custom Branding
- [ ] Allow organizations to set a custom logo and color scheme
- [ ] White-label queue pages for Business plan users
- [ ] Custom domain support

### 3.4 API Keys & Webhooks
- [ ] Allow organizations to generate API keys for programmatic access
- [ ] Implement webhook delivery for queue events (joined, served, completed)
- [ ] Webhook retry logic with exponential backoff
- [ ] Webhook signature verification

---

## Phase 4 — Scale & Performance (Priority: Medium)

### 4.1 Caching
- [ ] Install `@nestjs/cache-manager` with Redis
- [ ] Cache frequently accessed data:
  - Queue details (TTL: 30s)
  - Queue participant counts (TTL: 10s)
  - User profiles (TTL: 5min)
- [ ] Implement cache invalidation on writes

### 4.2 Queue Processing & Background Jobs
- [ ] Install `@nestjs/bull` with Redis for background job processing
- [ ] Move email sending to a background queue (prevent blocking API responses)
- [ ] Implement scheduled jobs:
  - Auto-close expired queues
  - Send reminder notifications
  - Generate daily analytics reports
  - Clean up old completed/cancelled entries

### 4.3 Database Optimization
- [ ] Add composite indexes for common query patterns
- [ ] Implement soft-delete for queues and entries (preserve historical data)
- [ ] Partition `queue_entries` table by status or date for large datasets
- [ ] Add connection pooling configuration

### 4.4 Horizontal Scaling
- [ ] Ensure stateless application design (no in-memory state)
- [ ] Configure Redis for session/cache sharing across instances
- [ ] Use Redis adapter for Socket.IO in multi-instance deployments
- [ ] Add health-check endpoints for load balancer probing

---

## Phase 5 — Advanced Features (Priority: Low)

### 5.1 Advanced Queue Types
- [ ] **Appointment-based queues** — users select a specific time slot
- [ ] **Priority queues** — VIP lanes with different priority levels
- [ ] **Virtual queues** — users join remotely and receive a notification when it's their turn
- [ ] **Recurring queues** — templates that auto-create queues on a schedule

### 5.2 Geolocation
- [ ] Add latitude/longitude columns to the Queue entity
- [ ] "Nearby queues" endpoint using PostGIS or simple distance calculations
- [ ] Map view in the frontend

### 5.3 Integrations
- [ ] Slack integration (notify a channel when queue status changes)
- [ ] Google Calendar integration (appointment-based queues)
- [ ] POS system integration (auto-serve when a transaction completes)

### 5.4 Admin Panel API
- [ ] User management (list, ban, impersonate)
- [ ] Queue management (force-close, audit logs)
- [ ] Subscription management (upgrade, downgrade, refund)
- [ ] System health dashboard (database, queue processing, email delivery)

### 5.5 Internationalization (i18n)
- [ ] Multi-language support for API error messages
- [ ] Multi-language email templates
- [ ] Timezone-aware queue scheduling

---

## Architecture Recommendations

### Code Organization (as the project grows)
```
src/
├── common/                  # Shared utilities, decorators, pipes, filters
│   ├── decorators/          # Custom decorators (e.g. @CurrentUser)
│   ├── filters/             # Exception filters
│   ├── guards/              # Shared guards (move auth guards here)
│   ├── interceptors/        # Logging, transform interceptors
│   ├── pipes/               # Custom validation pipes
│   └── interfaces/          # Shared TypeScript interfaces
├── config/                  # Configuration module and validation schemas
│   ├── config.module.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── app.config.ts
├── auth/                    # Authentication module
├── queue/                   # Queue module
├── email/                   # Email module
├── notification/            # Push/email/SMS notifications
├── organization/            # Multi-tenancy
├── subscription/            # Billing & plans
├── analytics/               # Queue analytics
└── database/                # Database module & migrations
```

### Key Patterns to Adopt

1. **Custom `@CurrentUser` Decorator** — Instead of `@Req() req` + `req.user`, create a `@CurrentUser()` parameter decorator for cleaner, type-safe user extraction.

2. **Configuration Validation** — Use `@nestjs/config` with `Joi` or `class-validator` to validate all environment variables at startup (fail fast if misconfigured).

3. **Repository Pattern** — Consider creating custom repositories for complex queries instead of putting QueryBuilder logic directly in services.

4. **Event-Driven Architecture** — Use NestJS's built-in `EventEmitter2` for decoupling (e.g. `queue.joined` event triggers notification sending).

5. **DTOs for Responses** — Create response DTOs to control exactly what data is returned (not just hiding password with spread operator).

---

## DevOps & Infrastructure

### CI/CD Pipeline
- [ ] Set up GitHub Actions or GitLab CI with:
  - Lint check (`npm run lint`)
  - Build check (`npm run build`)
  - Unit tests (`npm run test`)
  - E2E tests (`npm run test:e2e`)
  - Database migration check
  - Deploy to staging on PR merge
  - Deploy to production on release tag

### Monitoring & Observability
- [ ] Set up application performance monitoring (APM) — e.g. Sentry, Datadog, New Relic
- [ ] Configure uptime monitoring
- [ ] Set up alerting for error rates, response times, and downtime
- [ ] Add distributed tracing for debugging complex request flows

### Infrastructure
- [ ] Containerize with Docker (`Dockerfile` + `docker-compose.yml`)
- [ ] Set up separate environments: development, staging, production
- [ ] Use managed PostgreSQL (e.g. Supabase, AWS RDS, Railway)
- [ ] Use managed Redis for caching and job queues
- [ ] Set up automated database backups

---

## Summary — Suggested Implementation Order

| Priority | Items                                                    | Estimated Effort |
| -------- | -------------------------------------------------------- | ---------------- |
| 🔴 P0    | Migrations, Swagger, Rate Limiting, Logging              | 1–2 weeks        |
| 🔴 P0    | Error handling, Security hardening, Tests                | 1–2 weeks        |
| 🟠 P1    | WebSockets, Queue lifecycle, Notifications               | 2–3 weeks        |
| 🟠 P1    | Queue discovery, Analytics dashboard API                 | 1–2 weeks        |
| 🟡 P2    | Multi-tenancy, RBAC, Stripe billing                      | 3–4 weeks        |
| 🟡 P2    | Caching, Background jobs, DB optimization                | 1–2 weeks        |
| 🟢 P3    | Advanced queue types, Geolocation, Integrations          | 3–4 weeks        |
| 🟢 P3    | Admin panel, i18n, CI/CD, Docker                         | 2–3 weeks        |

---

*This plan is a living document and should be updated as features are completed and priorities evolve.*
