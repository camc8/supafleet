#!/usr/bin/env bash
set -euo pipefail

# Supafleet setup script for Ubuntu 22.04 / 24.04
# Usage: curl -fsSL https://raw.githubusercontent.com/camc8/supafleet/main/setup.sh | bash

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[supafleet]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
die() { echo -e "${RED}[error]${NC} $1"; exit 1; }

# Check deps
for cmd in git docker node nginx certbot; do
  command -v "$cmd" &>/dev/null || die "Required: $cmd (not found)"
done
docker compose version &>/dev/null || die "Docker Compose v2 required (docker compose)"
node_ver=$(node -e "console.log(parseInt(process.version.slice(1)))" 2>/dev/null)
[[ "$node_ver" -ge 18 ]] || die "Node.js 18+ required (found: $(node --version))"

echo ""
echo "  Supafleet Setup"
echo "  Self-hosted Supabase fleet manager"
echo ""

read -rp "Base domain for DB instances (e.g. db.yourdomain.com): " BASE_DOMAIN
read -rp "Dashboard domain (e.g. manage.yourdomain.com): " DASHBOARD_DOMAIN
read -rp "Admin email (for TLS cert): " ADMIN_EMAIL
read -rsp "Dashboard password: " ADMIN_PASS; echo
[[ -z "$ADMIN_PASS" ]] && die "Dashboard password cannot be empty"

INSTALL_DIR="/opt/supafleet"

log "Cloning Supafleet to ${INSTALL_DIR}..."
git clone https://github.com/camc8/supafleet "$INSTALL_DIR"
cd "$INSTALL_DIR"

log "Obtaining wildcard TLS certificate via Cloudflare DNS..."
warn "Ensure ~/.cloudflare.ini exists with dns_cloudflare_api_token = YOUR_TOKEN"
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials ~/.cloudflare.ini \
  -d "*.${BASE_DOMAIN}" -d "${BASE_DOMAIN}" \
  --email "$ADMIN_EMAIL" --agree-tos --non-interactive

log "Configuring nginx..."
mkdir -p /etc/nginx/supafleet-studio-ports /etc/nginx/supafleet-kong-ports

sed "s/{{BASE_DOMAIN}}/${BASE_DOMAIN}/g; s/{{DASHBOARD_DOMAIN}}/${DASHBOARD_DOMAIN}/g" \
  nginx/supafleet-wildcard.conf > /etc/nginx/sites-available/supafleet-wildcard
sed "s/{{BASE_DOMAIN}}/${BASE_DOMAIN}/g; s/{{DASHBOARD_DOMAIN}}/${DASHBOARD_DOMAIN}/g" \
  nginx/supafleet-dashboard.conf > /etc/nginx/sites-available/supafleet-dashboard

ln -sf /etc/nginx/sites-available/supafleet-wildcard /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/supafleet-dashboard /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

log "Writing configuration..."
mkdir -p "${INSTALL_DIR}/projects"

cat > dashboard/backend/.env << ENVEOF
PORT=3001
NODE_ENV=production
DATABASE_URL=file:./data/supafleet.db
PROJECTS_PATH=${INSTALL_DIR}/projects
BASE_DOMAIN=${BASE_DOMAIN}
DASHBOARD_DOMAIN=${DASHBOARD_DOMAIN}
CORS_ORIGIN=https://${DASHBOARD_DOMAIN}
LOG_LEVEL=info
ENVEOF

cat > dashboard/frontend/.env.production << ENVEOF
VITE_BASE_DOMAIN=${BASE_DOMAIN}
VITE_API_URL=https://${DASHBOARD_DOMAIN}/api
ENVEOF

log "Building backend..."
cd dashboard/backend && npm ci && npm run build && cd ../..

log "Building frontend..."
cd dashboard/frontend && npm ci && npm run build && cd ../..

log "Installing systemd service..."
cat > /etc/systemd/system/supafleet.service << SVCEOF
[Unit]
Description=Supafleet Dashboard Backend
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/dashboard/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
EnvironmentFile=${INSTALL_DIR}/dashboard/backend/.env

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now supafleet

echo ""
echo "  Supafleet is running!"
echo "  Dashboard: https://${DASHBOARD_DOMAIN}"
echo ""
echo "  Next steps:"
echo "    1. Go to https://${DASHBOARD_DOMAIN} and click 'New Instance'"
echo "    2. Each instance gets its own subdomain: {name}.${BASE_DOMAIN}"
echo "    3. Supabase Studio: https://{name}.${BASE_DOMAIN}/studio"
echo ""
