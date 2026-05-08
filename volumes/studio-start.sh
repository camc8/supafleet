#!/bin/sh
set -e

# Create missing content directory that Studio tries to scan at runtime
mkdir -p /app/apps/studio/components/interfaces/Home/Connect/content

# Reset basePath so studio works at root path (nginx strips /studio prefix)
node - << 'JSEOF'
const fs = require('fs');
const p = '/app/apps/studio/server.js';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/"basePath":"[^"]*"/, '"basePath":""');
c = c.replace(/"assetPrefix":"[^"]*"/, '"assetPrefix":""');
fs.writeFileSync(p, c);
console.log('Studio basePath reset to empty');
JSEOF

exec node /app/apps/studio/server.js
