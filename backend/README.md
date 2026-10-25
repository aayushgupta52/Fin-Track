# FinTrack — Backend (Phase 1)

Node.js + Express + Prisma backend for the AI Personal Finance & Tax Assistant.

## Status

**Phase 1 — Core (in progress)**
- [x] Project + folder structure
- [x] Prisma schema (all models)
- [x] Auth system — JWT access/refresh + Google OAuth
- [ ] Expense / Income CRUD
- [ ] Dashboard aggregation endpoints

## Setup

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, etc.
npm run prisma:generate
npm run prisma:migrate      # needs a reachable PostgreSQL (Neon/local)
npm run dev                 # starts on http://localhost:5000
```

> Redis is optional in dev — if `REDIS_URL` is unreachable the server still
> boots, but refresh-token storage/rotation needs Redis to work end-to-end.

## Auth API

| Method | Route                       | Auth | Description                          |
|--------|-----------------------------|------|--------------------------------------|
| POST   | `/api/auth/register`        | —    | Create account, returns access token |
| POST   | `/api/auth/login`           | —    | Email/password login                 |
| GET    | `/api/auth/google`          | —    | Start Google OAuth                   |
| GET    | `/api/auth/google/callback` | —    | OAuth callback → redirects to FE     |
| POST   | `/api/auth/refresh`         | cookie | Rotate + issue new access token    |
| POST   | `/api/auth/logout`          | —    | Revoke refresh token                 |
| GET    | `/api/auth/me`              | JWT  | Current user                         |

**Token model**
- Access token (15m) returned in the JSON body → send as `Authorization: Bearer <token>`.
- Refresh token (7d) set as an httpOnly cookie scoped to `/api/auth`, mirrored in
  Redis per user for rotation + revocation.

### Quick test

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@example.com","password":"secret123"}'
```
