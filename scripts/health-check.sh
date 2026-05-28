#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# PhD ERP — Container Health Monitor
# Usage: ./scripts/health-check.sh [--watch]
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.yml"

WATCH="${1:-}"

check_all() {
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo " PhD ERP — Container Health  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "══════════════════════════════════════════════════════"

    SERVICES=(
        mysql redis
        student-backend admin-backend supervisor-backend center-backend
        notification-service
        student-ui admin-ui supervisor-ui center-ui
        nginx backup
    )

    ALL_OK=1
    for svc in "${SERVICES[@]}"; do
        STATE=$($COMPOSE ps --format "{{.State}}" "$svc" 2>/dev/null || echo "missing")
        HEALTH=$($COMPOSE ps --format "{{.Health}}" "$svc" 2>/dev/null || echo "")

        if [[ "$STATE" == "running" ]]; then
            if [[ -z "$HEALTH" || "$HEALTH" == "healthy" ]]; then
                printf "  ✅  %-30s %s\n" "$svc" "${HEALTH:-running}"
            elif [[ "$HEALTH" == "starting" ]]; then
                printf "  🔄  %-30s starting\n" "$svc"
            else
                printf "  ❌  %-30s %s\n" "$svc" "${HEALTH:-unhealthy}"
                ALL_OK=0
            fi
        else
            printf "  💀  %-30s %s\n" "$svc" "$STATE"
            ALL_OK=0
        fi
    done

    echo ""
    # Disk usage
    echo " Volumes:"
    docker volume ls --filter "name=phd_" --format "  {{.Name}}" 2>/dev/null | while read vol; do
        SIZE=$(docker run --rm -v "${vol}:/data" alpine sh -c "du -sh /data 2>/dev/null | cut -f1" 2>/dev/null || echo "?")
        printf "  %-35s %s\n" "$vol" "$SIZE"
    done

    echo ""
    # Container resource usage
    echo " Resource Usage:"
    docker stats --no-stream --format "  {{.Name}}\t CPU: {{.CPUPerc}}\t RAM: {{.MemUsage}}" \
        $(docker ps --filter "name=phd_" --format "{{.Names}}" | tr '\n' ' ') 2>/dev/null || true

    echo "══════════════════════════════════════════════════════"
    [[ $ALL_OK -eq 1 ]] && echo " Overall: ✅ All services healthy" || echo " Overall: ❌ Some services need attention"
    echo "══════════════════════════════════════════════════════"
}

if [[ "$WATCH" == "--watch" ]]; then
    while true; do
        clear
        check_all
        sleep 10
    done
else
    check_all
fi
