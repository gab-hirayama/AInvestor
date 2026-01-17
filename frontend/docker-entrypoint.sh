#!/bin/sh
set -e

# Generate env.js with runtime environment variables
cat > /usr/share/nginx/html/env.js <<EOF
window.ENV = {
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  N8N_IMPORT_WEBHOOK_URL: "${N8N_IMPORT_WEBHOOK_URL:-https://n8n.hirayama-tech.com/webhook/import-faturas}"
};
EOF

echo "Environment configuration generated successfully"
echo "SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "N8N_IMPORT_WEBHOOK_URL: ${N8N_IMPORT_WEBHOOK_URL:-https://n8n.hirayama-tech.com/webhook/import-faturas}"

# Execute the CMD
exec "$@"

