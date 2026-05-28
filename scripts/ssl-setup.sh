#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# PhD ERP — SSL Certificate Setup
# Supports:
#   1. Let's Encrypt (production) via Certbot
#   2. Self-signed certificates (development/staging)
#
# Usage:
#   ./scripts/ssl-setup.sh               # Let's Encrypt (if domains resolve)
#   ./scripts/ssl-setup.sh --self-signed  # Self-signed for local/dev
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

log()  { echo -e "\033[1;32m[SSL]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*" >&2; exit 1; }

[[ -f "$PROJECT_DIR/.env" ]] && source "$PROJECT_DIR/.env" || true

SELF_SIGNED=0
[[ "${1:-}" == "--self-signed" ]] && SELF_SIGNED=1

DOMAINS=(
    "student.university.com"
    "admin.university.com"
    "supervisor.university.com"
    "center.university.com"
)
SSL_EMAIL="${SSL_EMAIL:-admin@university.ac.in}"

mkdir -p "$SSL_DIR"

# ── Let's Encrypt via Certbot ─────────────────────────────────────────────────
issue_letsencrypt() {
    local domain="$1"
    log "Issuing Let's Encrypt certificate for $domain..."

    command -v certbot >/dev/null 2>&1 || fail "certbot not installed. Install with: apt install certbot"

    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$SSL_EMAIL" \
        -d "$domain" \
        --cert-path "$SSL_DIR/$domain/fullchain.pem" \
        --key-path  "$SSL_DIR/$domain/privkey.pem"

    mkdir -p "$SSL_DIR/$domain"
    ln -sf "/etc/letsencrypt/live/$domain/fullchain.pem" "$SSL_DIR/$domain/fullchain.pem"
    ln -sf "/etc/letsencrypt/live/$domain/privkey.pem"   "$SSL_DIR/$domain/privkey.pem"
    log "Certificate issued for $domain ✓"
}

# ── Self-signed (development/staging) ────────────────────────────────────────
issue_self_signed() {
    local domain="$1"
    local cert_dir="$SSL_DIR/$domain"
    mkdir -p "$cert_dir"

    log "Generating self-signed certificate for $domain..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$cert_dir/privkey.pem" \
        -out    "$cert_dir/fullchain.pem" \
        -subj   "/C=IN/ST=Tamil Nadu/L=Salem/O=Periyar University/OU=IT/CN=$domain" \
        -extensions v3_ca \
        -addext "subjectAltName=DNS:$domain,DNS:www.$domain" \
        2>/dev/null
    log "Self-signed certificate created for $domain ✓"
}

# ── Default (catch-all) certificate ──────────────────────────────────────────
mkdir -p "$SSL_DIR/default"
if [[ ! -f "$SSL_DIR/default/fullchain.pem" ]]; then
    log "Creating default (catch-all) self-signed certificate..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/default/privkey.pem" \
        -out    "$SSL_DIR/default/fullchain.pem" \
        -subj   "/C=IN/ST=Tamil Nadu/L=Salem/O=Periyar University/CN=default" \
        2>/dev/null
fi

# ── Issue per-domain certs ────────────────────────────────────────────────────
for domain in "${DOMAINS[@]}"; do
    if [[ "$SELF_SIGNED" -eq 1 ]]; then
        issue_self_signed "$domain"
    else
        # Check if domain resolves to this server
        CURRENT_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
        DOMAIN_IP=$(dig +short "$domain" 2>/dev/null | tail -1 || echo "unresolved")
        if [[ "$DOMAIN_IP" == "$CURRENT_IP" ]]; then
            issue_letsencrypt "$domain"
        else
            warn "Domain $domain resolves to $DOMAIN_IP (server is $CURRENT_IP)"
            warn "Falling back to self-signed for $domain"
            issue_self_signed "$domain"
        fi
    fi
done

# ── Auto-renewal cron ─────────────────────────────────────────────────────────
if [[ "$SELF_SIGNED" -eq 0 ]] && command -v certbot >/dev/null 2>&1; then
    log "Installing certbot auto-renewal cron..."
    (crontab -l 2>/dev/null; echo "0 0 * * * certbot renew --quiet && docker exec phd_nginx nginx -s reload") | crontab -
    log "Auto-renewal cron installed ✓"
fi

log "SSL setup complete. Certificates are in: $SSL_DIR"
log "Now restart nginx: docker compose restart nginx"
