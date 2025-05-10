#!/bin/bash
# Script to restart nginx and socket.io server after configuration changes

# Ensure script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

echo "=== Restarting Mandarin Socket.IO Service ==="

# Stop the Node.js socket server
echo "Stopping Node.js server..."
pm2 stop server || true

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "Nginx configuration test failed. Please fix the errors and try again."
    exit 1
fi

# Restart nginx
echo "Restarting nginx..."
systemctl restart nginx

# Start the Node.js server
echo "Starting Node.js server..."
cd /var/www/mandarin/server && pm2 start server.js

# Check status
echo "=== Service Status ==="
echo "Nginx status:"
systemctl status nginx --no-pager -l | head -20
echo "PM2 status:"
pm2 status server

echo "=== Verification ==="
echo "Testing socket.io endpoint..."
curl -I http://localhost:5000/socket.io/
echo ""
echo "Socket service restart completed."