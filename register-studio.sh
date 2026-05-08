#!/bin/bash
# Usage: register-studio.sh <instance_name> [studio_port]
# If studio_port is omitted, reads STUDIO_PORT from the instance .env

set -e
INSTANCE="${1:?Usage: $0 <instance_name> [studio_port]}"
PORT="${2}"

if [ -z "$PORT" ]; then
    ENV_FILE="/root/multibase/projects/${INSTANCE}/.env"
    if [ ! -f "$ENV_FILE" ]; then
        echo "Error: No .env found at $ENV_FILE and no port provided"
        exit 1
    fi
    PORT=$(grep '^STUDIO_PORT=' "$ENV_FILE" | cut -d= -f2)
fi

if [ -z "$PORT" ]; then
    echo "Error: Could not determine STUDIO_PORT for instance: $INSTANCE"
    exit 1
fi

echo "Registering ${INSTANCE}.db.xcorpllc.com → port ${PORT}"
echo "${INSTANCE}.db.xcorpllc.com ${PORT};" > "/etc/nginx/multibase-studio-ports/${INSTANCE}.conf"

nginx -s reload
echo "Done. Studio live at https://${INSTANCE}.db.xcorpllc.com"
