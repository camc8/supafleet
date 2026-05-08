#!/bin/bash
# Run once after:
#   1. *.db.xcorpllc.com A record → 5.161.114.48 added in Cloudflare (proxy OFF)
#   2. CF_API_TOKEN exported with DNS:Edit for xcorpllc.com

set -e

CF_API_TOKEN="${CF_API_TOKEN:?Set CF_API_TOKEN before running this script}"

mkdir -p /etc/letsencrypt/cloudflare
cat > /etc/letsencrypt/cloudflare/xcorpllc.ini << INIEOF
dns_cloudflare_api_token = ${CF_API_TOKEN}
INIEOF
chmod 600 /etc/letsencrypt/cloudflare/xcorpllc.ini

certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare/xcorpllc.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d "*.db.xcorpllc.com" \
  -d "db.xcorpllc.com" \
  --non-interactive --agree-tos \
  --email admin@xcorpllc.com \
  --expand

nginx -s reload
echo "Done. Wildcard cert active."
