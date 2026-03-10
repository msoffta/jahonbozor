#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="${1}"
EMAIL="${2}"

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Please provide domain name${NC}"
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: Please provide your email address${NC}"
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

echo -e "${YELLOW}=== Certbot SSL Setup ===${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Create directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p certs certbot/www

# Start nginx and certbot services
echo -e "${YELLOW}Starting nginx and certbot containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d nginx certbot

# Wait for nginx to start
echo -e "${YELLOW}Waiting for nginx to start...${NC}"
sleep 5

# Request certificate
echo -e "${YELLOW}Requesting SSL certificate from Let's Encrypt...${NC}"
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$DOMAIN"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Certificate obtained successfully!${NC}"

    # Reload nginx to use new certificate
    echo -e "${YELLOW}Reloading nginx...${NC}"
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

    echo ""
    echo -e "${GREEN}=== SSL Setup Complete ===${NC}"
    echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
    echo "Auto-renewal: Certbot container will check twice daily"
    echo ""
    echo "Verify certificate:"
    echo "  curl -vI https://$DOMAIN 2>&1 | grep -i 'expire'"
else
    echo -e "${RED}Failed to obtain certificate${NC}"
    echo "Check logs: docker-compose -f docker-compose.prod.yml logs certbot"
    exit 1
fi
