<div align="center">
  <img src="logo/logo.png" width="180" alt="Supafleet logo" />
  <h1>Supafleet</h1>
  <p>Self-hosted Supabase fleet manager. One command to spin up isolated, production-ready Supabase instances on any VPS.</p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-black" alt="MIT" />
    <img src="https://img.shields.io/badge/node-%3E%3D18-black" alt="Node 18+" />
    <img src="https://img.shields.io/badge/docker-required-black" alt="Docker" />
  </p>
</div>

---

## What is Supafleet?

Supafleet lets you manage multiple self-hosted [Supabase](https://supabase.com) instances from a single dashboard on your own VPS. Each instance gets:

- A dedicated subdomain: `{name}.db.yourdomain.com`
- Supabase Studio at `{name}.db.yourdomain.com/studio`
- Its own isolated Postgres database, Auth, Storage, Realtime, and Kong API gateway
- One-click stop/start/disable for optional services to save RAM

## Features

- **Multi-instance dashboard** — create, monitor, and manage any number of Supabase instances
- **Automatic subdomain routing** — wildcard DNS + nginx, no manual DNS per instance
- **Auth-gated Studio access** — login wall in front of every Studio via JWT session
- **Service management** — stop optional services (analytics, imgproxy, vector) to reclaim memory; disable to survive reboots
- **Real-time logs** — live log streaming per service
- **Resource metrics** — CPU, memory, and network charts per instance
- **One-command setup** — `setup.sh` handles TLS, nginx, systemd, and builds

## Architecture

```
               Internet
                  |
              nginx (443)
         ┌────────┴────────┐
  *.db.domain.com     manage.domain.com
         |                  |
   auth check          Supafleet UI
    (port 4000)        (port 3001 API)
         |
  ┌──────┴──────┐
  /studio       /
     |           |
  Studio      Kong API
 (per inst)  (per inst)
```

Each Supabase instance runs as a Docker Compose project with ~10 containers isolated per project directory.

## Server Recommendations

| Instances | VPS Size | RAM | vCPU | Monthly (Hetzner) |
|-----------|----------|-----|------|-------------------|
| 1–2       | CX22     | 4 GB | 2   | ~€4–5             |
| 3–5       | CX32     | 8 GB | 4   | ~€9–10            |
| 6–10      | CX42     | 16 GB | 8  | ~€17–18           |

Each Supabase instance uses ~300–500 MB RAM at idle with all services running. Disabling optional services (analytics, imgproxy, vector, edge-functions) drops this to ~150 MB.

## Why Hetzner?

- **€4–5/mo** for a capable 2 vCPU / 4 GB VPS (CX22)
- **1 Gbps network** — no egress fees that add up like AWS/GCP
- **EU and US datacenters** — pick your region
- **Transparent pricing** — no surprise bills, predictable flat rates
- **€20 free trial** — enough to run Supafleet for months before paying
- Supports [Hetzner Cloud API](https://docs.hetzner.cloud/) for automation

## DNS Setup — Automatic Subdomains

Supafleet uses a **wildcard DNS record** so each new instance automatically gets a subdomain without manual DNS changes.

### Cloudflare (recommended)

1. In Cloudflare DNS, add a record:
   - Type: `A`
   - Name: `*.db` (for wildcard under `db.yourdomain.com`)
   - Value: your VPS IP
   - Proxy: **DNS only** (orange cloud off — TLS is handled by certbot)
2. Add a second `A` record for your dashboard domain:
   - Name: `manage`
   - Value: same VPS IP

Cloudflare also provides the API token needed for wildcard TLS cert issuance via DNS-01 challenge.

### Other DNS providers

Any provider supporting wildcard `A` records works. The `setup.sh` uses `certbot-dns-cloudflare` for wildcard TLS; for other providers, switch to the matching certbot DNS plugin.

## Prerequisites

- Ubuntu 22.04 or 24.04
- Docker Engine + Docker Compose v2
- Node.js 18+
- nginx
- certbot + certbot-dns-cloudflare (for wildcard TLS)
- A domain with DNS managed by Cloudflare
- A Cloudflare API token with `Zone:DNS:Edit` permission

```bash
# Install deps on Ubuntu 24.04
apt-get update && apt-get install -y git nginx certbot python3-certbot-dns-cloudflare
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Create Cloudflare credentials file
cat > ~/.cloudflare.ini << '"'"'CF'"'"'
dns_cloudflare_api_token = YOUR_TOKEN_HERE
CF
chmod 600 ~/.cloudflare.ini
```

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/camc8/supafleet/main/setup.sh | bash
```

The script will prompt for:
- **Base domain** for instances (e.g. `db.yourdomain.com`)
- **Dashboard domain** (e.g. `manage.yourdomain.com`)
- **Admin email** for TLS certificate
- **Dashboard password**

Then it handles TLS, nginx, build, and systemd automatically.

## Configuration

After setup, configuration files live at:

| File | Purpose |
|------|---------|
| `/opt/supafleet/dashboard/backend/.env` | Backend config (domain, paths, CORS) |
| `/opt/supafleet/dashboard/frontend/.env.production` | Frontend config (base domain, API URL) |

To rebuild after config changes:
```bash
cd /opt/supafleet/dashboard/frontend && npm run build
systemctl restart supafleet
```

## Creating Your First Instance

1. Navigate to `https://manage.yourdomain.com`
2. Click **New Instance**
3. Enter a name (lowercase letters, numbers, hyphens)
4. Supafleet provisions the instance and configures nginx automatically
5. Access Studio at `https://{name}.db.yourdomain.com/studio`
6. API endpoint: `https://{name}.db.yourdomain.com`

## Managing Services

Each instance runs optional services that can be stopped to save memory:

- **Stop** — temporarily stop a service (restarts on reboot)
- **Disable** — permanently disable (survives reboots, `docker compose up`)
- **Enable** — re-enable a disabled service

Core services (db, kong, auth, rest, pooler, realtime) cannot be disabled.

## Updating Supafleet

```bash
cd /opt/supafleet
git pull
cd dashboard/backend && npm ci && npm run build && cd ../..
cd dashboard/frontend && npm ci && npm run build && cd ../..
systemctl restart supafleet
```

## Troubleshooting

**Dashboard not loading**
```bash
systemctl status supafleet
journalctl -u supafleet -n 50
```

**Studio returning 502**
```bash
# Check that the instance is running
docker ps | grep {name}
# Check nginx
nginx -t && systemctl reload nginx
```

**Wildcard cert not working**
```bash
certbot renew --dry-run
```

## Credits

- Built on [Supabase](https://github.com/supabase/supabase) self-hosted
- Inspired by [multibase](https://github.com/multibase) — the original multi-tenant Supabase manager
- [Kong](https://github.com/Kong/kong) API gateway
- [nginx](https://nginx.org) reverse proxy
- [Let's Encrypt](https://letsencrypt.org) / [certbot](https://certbot.eff.org) for TLS

## License

MIT — Copyright (c) 2026 Cameron Clark. See [LICENSE](LICENSE).
