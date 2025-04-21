#!/bin/bash
# TURN Server Setup Script
# This script sets up coturn as a TURN/STUN server on Ubuntu/Debian
# Usage: chmod +x setup-turn-server.sh && sudo ./setup-turn-server.sh yourdomain.com yourusername yourpassword

# Exit on any error
set -e

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

# Get parameters or use defaults
DOMAIN=${1:-$(hostname -f)}
TURN_USERNAME=${2:-turnuser}
TURN_PASSWORD=${3:-$(openssl rand -hex 16)}
EXTERNAL_IP=$(curl -s https://api.ipify.org)

echo "Setting up TURN/STUN server on: $DOMAIN"
echo "External IP detected as: $EXTERNAL_IP"
echo "TURN username: $TURN_USERNAME"
echo "TURN password: $TURN_PASSWORD"
echo ""
echo "Installation beginning immediately... (non-interactive mode)"

# Update system
echo "Updating system packages..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -qq -y

# Install coturn
echo "Installing coturn..."
DEBIAN_FRONTEND=noninteractive apt-get install -qq -y coturn

# Backup original config
cp /etc/turnserver.conf /etc/turnserver.conf.backup

# Configure coturn
echo "Configuring coturn..."
cat > /etc/turnserver.conf << EOF
# TURN server configuration
listening-port=3478
tls-listening-port=5349

# Specify the public-facing IP address of the server
external-ip=$EXTERNAL_IP

# Allow connections from any realm
realm=$DOMAIN

# Authentication
lt-cred-mech
user=$TURN_USERNAME:$TURN_PASSWORD

# Use fingerprint in TURN messages
fingerprint

# Bandwidth limitation
total-quota=100
bps-capacity=0
stale-nonce=600

# Set client-facing log level
verbose

# Rotate log files daily
log-file=/var/log/turnserver.log
no-stdout-log

# TLS configuration (optional)
# cert=/etc/ssl/certs/your-certificate.crt
# pkey=/etc/ssl/private/your-private-key.key

# For security, don't use default ports for STUN/TURN
#alternate-port=20000
#min-port=20001
#max-port=29999
EOF

# Enable coturn as a service
echo "Enabling coturn service..."
sed -i 's/TURNSERVER_ENABLED=0/TURNSERVER_ENABLED=1/g' /etc/default/coturn

# Configure firewall if it's UFW
if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    ufw allow 3478/tcp
    ufw allow 3478/udp
    ufw allow 5349/tcp
    ufw allow 5349/udp

    # UDP port range if you uncomment the alternate port settings above
    # ufw allow 20000:29999/udp
fi

# Restart coturn service
echo "Starting coturn service..."
systemctl restart coturn
systemctl enable coturn
systemctl status coturn --no-pager

echo ""
echo "========================================================"
echo "TURN/STUN Server setup complete!"
echo "Server: $DOMAIN"
echo "Username: $TURN_USERNAME"
echo "Password: $TURN_PASSWORD"
echo ""
echo "TURN server URL: turn:$DOMAIN:3478"
echo "TURN TLS URL: turns:$DOMAIN:5349"
echo "STUN server URL: stun:$DOMAIN:3478"
echo ""
echo "For your WebRTC application, use the following configuration:"
echo "----------------------------------------"
echo "const ICE_SERVERS = ["
echo "  { urls: 'stun:$DOMAIN:3478' },"
echo "  { "
echo "    urls: 'turn:$DOMAIN:3478',"
echo "    username: '$TURN_USERNAME',"
echo "    credential: '$TURN_PASSWORD'"
echo "  },"
echo "  { "
echo "    urls: 'turns:$DOMAIN:5349',"
echo "    username: '$TURN_USERNAME',"
echo "    credential: '$TURN_PASSWORD'"
echo "  }"
echo "];"
echo "----------------------------------------"
echo "Save these credentials in a secure location!"
echo "========================================================"
