#!/bin/bash
# update-container-urls.sh
# Updates app_instances.internal_url and Traefik ForwardAuth configs
# after a Coolify redeploy changes container names or service IDs.
#
# Handles two Traefik service patterns:
#   1. @docker refs  — service ID read from Docker labels (Araña, AON, Citas, Dashboard)
#   2. file services — loadBalancer URL updated with current container name (Medidas)
#
# Safe to run repeatedly (idempotent). Only modifies chs-v2-* configs.
#
# Usage: sudo ./scripts/update-container-urls.sh

set -euo pipefail

DB_CONTAINER="chs-db"
DB_USER="chs"
DB_NAME="chs"
TRAEFIK_DIR="/data/coolify/proxy/dynamic"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

# Map: Coolify prefix → app name | port | Traefik YAML
declare -A APPS=(
  ["a00g4os8ogg8skgk0oowk8c8"]="Araña de Precios|3000|chs-v2-arana-auth.yaml"
  ["ms84cwosc0occ488ggccg8g8"]="Sistema AON|3000|chs-v2-aon-auth.yaml"
  ["cogk4c4s8kgsk4k4s00wskss"]="Citas Almacén|5000|chs-v2-citas-auth.yaml"
  ["css4cosk08k0c40gkgww84go"]="Cuadro de Dirección|3000|chs-v2-dashboard-auth.yaml"
  ["wk8sggsg4koowwccssww4c4s"]="Procesador de Medidas|3000|chs-v2-medidas-auth.yaml"
)

# Elias shares the Citas container — listed separately for Traefik config updates
declare -A ALIASES=(
  ["cogk4c4s8kgsk4k4s00wskss"]="chs-v2-elias-auth.yaml"
)

changes=0

echo "=== CHS Container URL Updater ==="
echo "    $(date -Iseconds)"
echo ""

# ── Helper: read the real HTTPS service ID from Docker labels ──
get_docker_https_service() {
  local container="$1"
  docker inspect "$container" --format '{{json .Config.Labels}}' 2>/dev/null | \
    python3 -c "
import sys, json
labels = json.load(sys.stdin)
for k in labels:
    if k.startswith('traefik.http.services.https-') and 'port' in k:
        print(k.split('.')[3])
        break
" 2>/dev/null
}

# ── Helper: update @docker service refs in a YAML file ──
update_docker_service_ref() {
  local yaml_path="$1"
  local real_service="$2"
  local yaml_name
  yaml_name=$(basename "$yaml_path")

  # Extract current @docker service ID from the YAML
  local current_service
  current_service=$(grep -oP '[a-z0-9-]+@docker' "$yaml_path" 2>/dev/null | head -1 | sed 's/@docker//' || true)

  if [ -z "$current_service" ]; then
    return 0  # no @docker refs in this file, skip
  fi

  if [ "$current_service" = "$real_service" ]; then
    echo "       Traefik @docker OK: $yaml_name"
    return 0
  fi

  sed -i "s/${current_service}@docker/${real_service}@docker/g" "$yaml_path"
  echo "       Traefik @docker UPDATED: $yaml_name ($current_service → $real_service)"
  changes=$((changes + 1))
}

# ── Helper: update loadBalancer URL in a file-provider service ──
update_loadbalancer_url() {
  local yaml_path="$1"
  local prefix="$2"
  local container="$3"
  local port="$4"
  local yaml_name
  yaml_name=$(basename "$yaml_path")

  local new_url="http://${container}:${port}"

  # Check if there's a loadBalancer URL with this prefix
  local current_url
  current_url=$(grep -oP "http://${prefix}[^\"]*" "$yaml_path" 2>/dev/null | head -1 || true)

  if [ -z "$current_url" ]; then
    return 0  # no loadBalancer URL with this prefix, skip
  fi

  if [ "$current_url" = "$new_url" ]; then
    echo "       Traefik loadBalancer OK: $yaml_name"
    return 0
  fi

  sed -i "s|${current_url}|${new_url}|g" "$yaml_path"
  echo "       Traefik loadBalancer UPDATED: $yaml_name ($current_url → $new_url)"
  changes=$((changes + 1))
}

# ── Helper: send webhook alert ──
send_alert() {
  local message="$1"
  local webhook_url="${ALERT_WEBHOOK_URL:-}"
  if [ -n "$webhook_url" ]; then
    curl -sf -X POST "$webhook_url" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"⚠️ CHS Container Alert: ${message}\"}" \
      >/dev/null 2>&1 || true
  fi
}

# ── Duplicate container cleanup ──
echo "--- Checking for duplicate containers ---"
duplicates_found=0
for prefix in "${!APPS[@]}"; do
  IFS='|' read -r app_name _port _file <<< "${APPS[$prefix]}"
  running=$(docker ps --format "{{.Names}}" | grep "^${prefix}" || true)
  count=$(echo "$running" | grep -c . || true)

  if [ "$count" -gt 1 ]; then
    duplicates_found=$((duplicates_found + 1))

    # Find the newest container by creation timestamp
    newest=""
    newest_ts="0"
    while IFS= read -r cname; do
      ts=$(docker inspect --format '{{.Created}}' "$cname" 2>/dev/null || true)
      if [[ "$ts" > "$newest_ts" ]]; then
        newest_ts="$ts"
        newest="$cname"
      fi
    done <<< "$running"

    echo "[CLEANUP] $app_name — $count running, keeping newest: $newest (created $newest_ts)"

    # Stop and remove all containers that are NOT the newest
    while IFS= read -r cname; do
      if [ "$cname" != "$newest" ]; then
        old_ts=$(docker inspect --format '{{.Created}}' "$cname" 2>/dev/null || true)
        docker stop "$cname" >/dev/null 2>&1 || true
        docker rm "$cname" >/dev/null 2>&1 || true
        echo "       [AUTO-CLEANUP] Removed old container $cname (created $old_ts)"
        msg="Removed duplicate $cname ($app_name), keeping $newest"
        send_alert "$msg"
        changes=$((changes + 1))
      fi
    done <<< "$running"
  fi
done
if [ "$duplicates_found" -eq 0 ]; then
  echo "       No duplicates found"
fi
echo ""

# ── Main loop ──
for prefix in "${!APPS[@]}"; do
  IFS='|' read -r app_name port traefik_file <<< "${APPS[$prefix]}"

  container=$(docker ps --format "{{.Names}}" | grep "^${prefix}" | head -1 || true)

  if [ -z "$container" ]; then
    echo "[SKIP] $app_name — no container with prefix $prefix"
    echo ""
    continue
  fi

  echo "[OK]   $app_name — $container"

  # ── 1. Update DB internal_url ──
  new_url="http://${container}:${port}"
  current_url=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT internal_url FROM app_instances WHERE internal_url LIKE 'http://${prefix}%' LIMIT 1;" \
    2>/dev/null | tr -d '[:space:]')

  if [ "$current_url" = "$new_url" ]; then
    echo "       DB OK: $new_url"
  elif [ -n "$current_url" ]; then
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
      "UPDATE app_instances SET internal_url = '${new_url}' WHERE internal_url LIKE 'http://${prefix}%';" \
      >/dev/null 2>&1
    echo "       DB UPDATED: $current_url → $new_url"
    changes=$((changes + 1))
  else
    echo "       DB: no matching row for prefix $prefix"
  fi

  # ── 2. Update Traefik config ──
  config_path="${TRAEFIK_DIR}/${traefik_file}"
  if [ ! -f "$config_path" ]; then
    echo "       Traefik config not found: $traefik_file"
    echo ""
    continue
  fi

  # Read real HTTPS service ID from Docker labels
  real_service=$(get_docker_https_service "$container")

  if [ -n "$real_service" ]; then
    # Pattern 1: @docker service references
    update_docker_service_ref "$config_path" "$real_service"
  fi

  # Pattern 2: loadBalancer URLs (for file-provider services like Medidas)
  update_loadbalancer_url "$config_path" "$prefix" "$container" "$port"

  # ── 3. Update alias configs (e.g. Elias → Citas container) ──
  if [ -n "${ALIASES[$prefix]+x}" ]; then
    alias_file="${TRAEFIK_DIR}/${ALIASES[$prefix]}"
    if [ -f "$alias_file" ]; then
      if [ -n "$real_service" ]; then
        update_docker_service_ref "$alias_file" "$real_service"
      fi
      update_loadbalancer_url "$alias_file" "$prefix" "$container" "$port"
    fi
  fi

  echo ""
done

if [ "$changes" -gt 0 ]; then
  echo "Done. $changes change(s) applied. Traefik auto-reloads within ~2s."
else
  echo "Done. Everything up to date."
fi
