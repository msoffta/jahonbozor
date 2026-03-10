#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Renewing SSL certificates...${NC}"

# Renew certificates
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Reload nginx
echo -e "${YELLOW}Reloading nginx...${NC}"
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo -e "${GREEN}Certificate renewal completed!${NC}"
