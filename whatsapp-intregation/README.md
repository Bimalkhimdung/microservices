# WhatsApp Integration Microservice

A production-ready **WhatsApp Web integration microservice** extracted from the [openclaw](https://github.com/openclaw/openclaw) project.
Built with **Node.js 20 + TypeScript**, **Fastify**, and **[`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys)** (WhatsApp Web protocol).

---

## ⚠️ Important Notice

This service uses the **unofficial WhatsApp Web API** (reverse-engineered Baileys library).
Use responsibly; excessive automated messaging may trigger WhatsApp to ban the linked number.

---

## Features

| Feature | Details |
|---|---|
| **QR Login** | Scan QR code with WhatsApp mobile to link your number |
| **Auto-reconnect** | Exponential-backoff reconnection on disconnects |
| **Session persistence** | Credentials saved to disk (survives restarts) |
| **Send text** | Send text messages to any WhatsApp number |
| **Send media** | Send images and documents via URL |
| **API key auth** | All endpoints protected by `x-api-key` header |
| **Health probes** | `/health` (liveness) and `/ready` (readiness) for Kubernetes |

---

## Quick Start (Docker)

```bash
# 1. Copy env file and configure
cp .env.example .env
# Edit .env — set a strong API_KEY

# 2. Build and start
docker-compose up -d

# 3. Get QR code
curl -H "x-api-key: your-api-key" http://localhost:3000/api/qr
# Copy qr_data_url value and open in browser, or display as image

# 4. Scan with WhatsApp → Linked Devices

# 5. Check status
curl -H "x-api-key: your-api-key" http://localhost:3000/api/status

# 6. Send a message
curl -X POST -H "x-api-key: your-api-key" -H "Content-Type: application/json" \
  -d '{"to": "+977980XXXXXXX", "text": "Hello!"}' \
  http://localhost:3000/api/send
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `API_KEY` | **required** | Secret key for `x-api-key` header auth |
| `AUTH_DIR` | `/data/wa-auth` | Directory to store WA session credentials |
| `LOG_LEVEL` | `info` | Pino log level: `fatal/error/warn/info/debug/trace` |

---

## API Reference

All endpoints (except health probes) require the header: **`x-api-key: <your-key>`**

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — always 200 |
| `GET` | `/ready` | Readiness probe — 200 only if WA connected |

### Authentication / Session

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | Get connection status and linked JID |
| `GET` | `/api/qr` | Get QR code (triggers connect if not running) |
| `POST` | `/api/connect` | Manually trigger reconnect |
| `POST` | `/api/logout` | Disconnect and optionally clear credentials |

#### GET /api/qr — Response
```json
{
  "already_linked": false,
  "qr_data_url": "data:image/png;base64,...",
  "expires_at": 1234567890000,
  "message": "Scan this QR code with WhatsApp → Linked Devices."
}
```

#### GET /api/status — Response
```json
{
  "status": "open",
  "connected": true,
  "jid": "9779801234567@s.whatsapp.net",
  "last_error": null
}
```

### Messaging

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/send` | Send a text message |
| `POST` | `/api/send-media` | Send an image or document |

#### POST /api/send — Body
```json
{ "to": "+977980XXXXXXX", "text": "Hello from the microservice!" }
```

#### POST /api/send-media — Body
```json
{
  "to": "+977980XXXXXXX",
  "caption": "Check this out!",
  "image_url": "https://example.com/photo.jpg"
}
```

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

---

## Docker Build

```bash
# Build image
docker build -t whatsapp-intregation:latest .

# Run with volume for auth persistence
docker run -d \
  --name whatsapp-intregation \
  -p 3000:3000 \
  -e API_KEY=your-secret-key \
  -v wa-auth:/data/wa-auth \
  whatsapp-intregation:latest
```

---

## Kubernetes (Helm)

```bash
# Install to cluster
helm install whatsapp-intregation ./helm \
  -f helm/values/prod.yaml \
  --set secret.apiKey="your-strong-secret" \
  --set image.tag="v1.0.0"

# Upgrade
helm upgrade whatsapp-intregation ./helm \
  -f helm/values/prod.yaml \
  --set secret.apiKey="your-strong-secret" \
  --set image.tag="v1.0.1"

# Check status
kubectl get pods -l app.kubernetes.io/name=whatsapp-intregation

# Get QR after deployment
kubectl port-forward svc/whatsapp-intregation 3000:3000
curl -H "x-api-key: your-strong-secret" http://localhost:3000/api/qr
```

> ⚠️ **replicas must be 1** — WhatsApp Web allows only one active socket per linked device.
> The Helm chart uses `strategy: Recreate` to enforce this.

---

## Architecture

```
┌─────────────────────────────────────┐
│          src/index.ts               │  ← entrypoint, graceful shutdown
├─────────────────────────────────────┤
│          src/api/server.ts          │  ← Fastify server
│  routes: health, auth, message      │
├─────────────────────────────────────┤
│       src/whatsapp/                 │
│  connection.ts  ← Baileys socket    │
│  auth-store.ts  ← creds persistence │
│  qr.ts          ← QR generation     │
│  send.ts        ← message sending   │
└─────────────────────────────────────┘
```
