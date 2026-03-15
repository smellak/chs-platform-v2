#!/bin/bash
# update-container-urls.sh
# Updates app_instances.internal_url and Traefik ForwardAuth configs
# after a Coolify redeploy changes container names.
#
# Usage: sudo ./scripts/update-container-urls.sh

set -euo pipefail

DB_CONTAINER="chs-db"
DB_USER="chs"
DB_NAME="chs"
TRAEFIK_DIR="/data/coolify/proxy/dynamic"

# Map of Coolify service ID prefix → app name + port + Traefik config file
declare -A APPS=(
  ["a00g4os8ogg8skgk0oowk8c8"]="Araña de Precios|3000|chs-v2-arana-auth.yaml"
  ["ms84cwosc0occ488ggccg8g8"]="Sistema AON|3000|chs-v2-aon-auth.yaml"
  ["cogk4c4s8kgsk4k4s00wskss"]="Citas Almacén|5000|chs-v2-citas-auth.yaml"
  ["css4cosk08k0c40gkgww84go"]="Cuadro de Dirección|3000|chs-v2-dashboard-auth.yaml"
  ["wk8sggsg4koowwccssww4c4s"]="Procesador de Medidas|3000|chs-v2-medidas-auth.yaml"
)

echo "=== CHS Container URL Updater ==="
echo ""

for prefix in "${!APPS[@]}"; do
  IFS='|' read -r app_name port traefik_file <<< "${APPS[$prefix]}"

  # Find current container name
  container=$(docker ps --format "{{.Names}}" | grep "^${prefix}" | head -1)

  if [ -z "$container" ]; then
    echo "[SKIP] $app_name — container with prefix $prefix not found"
    continue
  fi

  echo "[OK]   $app_name — container: $container"

  # Update DB internal_url
  new_url="http://${container}:${port}"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "UPDATE app_instances SET internal_url = '${new_url}' WHERE internal_url LIKE 'http://${prefix}%';" \
    2>/dev/null
  echo "       DB updated: $new_url"

  # Update Traefik config (replace old service ID prefix with current)
  config_path="${TRAEFIK_DIR}/${traefik_file}"
  if [ -f "$config_path" ]; then
    # The service reference format is: https-0-<prefix>@docker
    # We only need to ensure the prefix matches (it doesn't include the suffix)
    current_prefix=$(grep -oP 'https-0-\K[^@]+' "$config_path" | head -1)
    if [ "$current_prefix" != "$prefix" ]; then
      sed -i "s/${current_prefix}/${prefix}/g" "$config_path"
      echo "       Traefik config updated: $traefik_file ($current_prefix → $prefix)"
    else
      echo "       Traefik config OK: $traefik_file"
    fi
  else
    echo "       Traefik config not found: $traefik_file"
  fi

  echo ""
done

echo "Done. Traefik auto-reloads file configs within ~2 seconds."
