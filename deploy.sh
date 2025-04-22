#!/bin/bash
# Flirtss.com Deployment Script
# This script updates and deploys both client and server components
# Run as sudo or with sufficient permissions

# Exit immediately on error
set -e

# Configuration Variables
APP_DIR="/var/www/mandarin"
CLIENT_DIR="$APP_DIR/client"
SERVER_DIR="$APP_DIR/server"
LOG_FILE="/var/log/flirtss-deployment.log"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/www/backups/mandarin_$DATE_TAG"
PM2_APP_NAME="flirtss-server"
NGINX_CONF="/etc/nginx/sites-available/mandarin"
GITHUB_REPO="https://github.com/yourusername/mandarin.git"  # Update with your actual repo URL

# Function for logging
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# Create log directory if it doesn't exist
mkdir -p $(dirname "$LOG_FILE")
touch "$LOG_FILE"

log "Starting deployment process for Flirtss.com"
log "Creating backup directory at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Check if we're running with sufficient permissions
if [ "$EUID" -ne 0 ]; then
    log "WARNING: This script is not running as root. Some operations may fail."
    log "Consider running with sudo."
fi

# Create backup of current deployment
backup_current() {
    log "Backing up current deployment..."
    
    # Backup client
    if [ -d "$CLIENT_DIR" ]; then
        mkdir -p "$BACKUP_DIR/client"
        cp -r "$CLIENT_DIR/dist" "$BACKUP_DIR/client/" 2>/dev/null || log "No client dist directory to backup"
        cp "$CLIENT_DIR/package.json" "$BACKUP_DIR/client/" 2>/dev/null || log "No client package.json to backup"
    else
        log "No client directory found at $CLIENT_DIR"
    fi
    
    # Backup server
    if [ -d "$SERVER_DIR" ]; then
        mkdir -p "$BACKUP_DIR/server"
        cp -r "$SERVER_DIR/uploads" "$BACKUP_DIR/server/" 2>/dev/null || log "No uploads directory to backup"
        cp "$SERVER_DIR/package.json" "$BACKUP_DIR/server/" 2>/dev/null || log "No server package.json to backup"
        cp "$SERVER_DIR/config.js" "$BACKUP_DIR/server/" 2>/dev/null || log "No server config.js to backup"
    else
        log "No server directory found at $SERVER_DIR"
    fi
    
    # Backup Nginx configuration
    if [ -f "$NGINX_CONF" ]; then
        cp "$NGINX_CONF" "$BACKUP_DIR/" 2>/dev/null || log "Could not backup Nginx config"
    fi
    
    # Backup PM2 configuration if exists
    pm2 save 2>/dev/null || log "Could not backup PM2 configuration"
    
    log "Backup completed successfully"
}

# Update from git repository
update_from_git() {
    log "Updating from git repository..."
    
    # If this is a git repository, pull the latest changes
    if [ -d "$APP_DIR/.git" ]; then
        log "Found git repository at $APP_DIR, pulling latest changes..."
        cd "$APP_DIR"
        git pull || log "WARNING: Failed to pull from git repository"
    else
        log "WARNING: $APP_DIR is not a git repository. Skipping git update."
    fi
}

# Build and deploy client
deploy_client() {
    log "Deploying client application..."
    
    cd "$CLIENT_DIR"
    
    # Install dependencies
    log "Installing client dependencies..."
    npm ci || npm install
    
    # Build the client application
    log "Building client application..."
    npm run build
    
    # Ensure the dist directory exists
    if [ ! -d "$CLIENT_DIR/dist" ]; then
        log "ERROR: Build failed - dist directory not created"
        exit 1
    fi
    
    log "Client deployed successfully"
}

# Deploy server
deploy_server() {
    log "Deploying server application..."
    
    cd "$SERVER_DIR"
    
    # Install server dependencies
    log "Installing server dependencies..."
    npm ci || npm install
    
    # Ensure production environment settings are available
    log "Setting up production environment..."
    if [ -f ".env.production" ]; then
        log "Found .env.production file, using it for production settings"
        # Set appropriate permissions
        chown www-data:www-data ".env.production"
        chmod 640 ".env.production"
    else
        log "WARNING: No .env.production file found, production settings may be incomplete"
    fi
    
    # Ensure uploads directory exists with proper permissions
    log "Ensuring uploads directory exists with proper permissions..."
    mkdir -p "$SERVER_DIR/uploads/images"
    mkdir -p "$SERVER_DIR/uploads/videos"
    mkdir -p "$SERVER_DIR/uploads/profiles"
    mkdir -p "$SERVER_DIR/uploads/stories"
    mkdir -p "$SERVER_DIR/uploads/messages"
    mkdir -p "$SERVER_DIR/uploads/photos"
    mkdir -p "$SERVER_DIR/uploads/temp"
    mkdir -p "$SERVER_DIR/uploads/deleted"
    
    # Create logs directory for PM2
    log "Creating logs directory for PM2..."
    mkdir -p "$SERVER_DIR/logs"
    
    # Set appropriate permissions
    chown -R www-data:www-data "$SERVER_DIR/uploads"
    chmod -R 755 "$SERVER_DIR/uploads"
    chown -R www-data:www-data "$SERVER_DIR/logs"
    chmod -R 755 "$SERVER_DIR/logs"
    
    log "Server deployed successfully"
}

# Update Nginx configuration
update_nginx_config() {
    log "Updating Nginx configuration..."
    
    # Check if nginx-mandarin.conf exists in the app directory
    if [ -f "$APP_DIR/nginx-mandarin.conf" ]; then
        log "Found nginx-mandarin.conf in $APP_DIR, using it..."
        
        # Create backup of current Nginx configuration
        if [ -f "$NGINX_CONF" ]; then
            log "Backing up existing Nginx configuration..."
            cp "$NGINX_CONF" "${NGINX_CONF}.backup-${DATE_TAG}" || log "WARNING: Failed to backup Nginx configuration"
        fi
        
        # Copy new configuration to Nginx directory
        log "Copying new Nginx configuration..."
        cp "$APP_DIR/nginx-mandarin.conf" "$NGINX_CONF" || {
            log "ERROR: Failed to copy Nginx configuration"
            return 1
        }
        
        # Make sure Nginx can read the file
        chmod 644 "$NGINX_CONF" || log "WARNING: Failed to set permissions on Nginx configuration"
        
        # Check if sites-enabled symlink exists
        if [ ! -e "/etc/nginx/sites-enabled/mandarin" ]; then
            log "Creating symlink in sites-enabled directory..."
            ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/mandarin" || log "WARNING: Failed to create symlink in sites-enabled"
        fi
        
        log "Nginx configuration updated successfully"
    else
        log "WARNING: nginx-mandarin.conf not found in $APP_DIR. Skipping Nginx configuration update."
    fi
}

# Configure and start TURN server
setup_turn_server() {
    log "Setting up TURN server..."
    
    # Check if TURN.sh exists and is executable
    if [ -f "$SERVER_DIR/TURN.sh" ]; then
        chmod +x "$SERVER_DIR/TURN.sh"
        
        # Execute TURN server setup script in non-interactive mode
        log "Running TURN server setup script in non-interactive mode..."
        DEBIAN_FRONTEND=noninteractive "$SERVER_DIR/TURN.sh" > /var/log/turn_setup.log 2>&1 || log "WARNING: TURN server setup script encountered an error"
        log "TURN server setup completed. See /var/log/turn_setup.log for details."
    else
        log "WARNING: TURN server setup script not found at $SERVER_DIR/TURN.sh"
    fi
}

# Start or restart the server with PM2
start_server() {
    log "Starting server with PM2..."
    
    # Check for existing processes - optionally kill all existing ones for clean start
    log "Checking for existing Node.js processes on port 5000..."
    local EXISTING_PID=$(lsof -t -i:5000)
    if [ -n "$EXISTING_PID" ]; then
        log "Found existing process(es) on port 5000: $EXISTING_PID, killing..."
        kill -9 $EXISTING_PID || log "WARNING: Failed to kill existing process"
    fi
    
    # Make sure www-data user exists and has proper permissions
    if id "www-data" &>/dev/null; then
        # Make sure the server directory is owned by www-data
        log "Setting proper ownership for server directory..."
        chown -R www-data:www-data "$SERVER_DIR"
        
        # Check if PM2 is installed
        if ! sudo -u www-data command -v pm2 &> /dev/null; then
            log "Installing PM2 globally for www-data..."
            sudo npm install pm2 -g
        fi
        
        # Force delete PM2 process if it exists but isn't running properly
        log "Checking PM2 process status..."
        if sudo -u www-data pm2 list | grep -q "$PM2_APP_NAME"; then
            log "Found existing PM2 process, deleting it for a clean start..."
            sudo -u www-data pm2 delete "$PM2_APP_NAME" || log "WARNING: Failed to delete existing PM2 process"
        fi
        
        # Clean up PM2 logs before starting
        log "Cleaning PM2 logs..."
        sudo -u www-data pm2 flush || log "WARNING: Failed to flush PM2 logs"
        
        # Start a fresh PM2 process
        log "Creating new PM2 process as www-data..."
        cd "$SERVER_DIR"
        if [ -f "$SERVER_DIR/server.js" ]; then
            log "Starting server.js with PM2..."
            sudo -u www-data NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                --time --log /var/log/pm2-flirtss.log --max-memory-restart 512M || {
                log "ERROR: Failed to create PM2 process on first attempt, trying alternative method..."
                sudo -u www-data NODE_ENV=production pm2 start --name "$PM2_APP_NAME" \
                    --time --log /var/log/pm2-flirtss.log --max-memory-restart 512M -- node server.js || {
                    log "ERROR: All attempts to start PM2 process failed"
                    return 1
                }
            }
        else
            log "ERROR: server.js not found at $SERVER_DIR/server.js"
            return 1
        fi
        
        # Verify the server is actually running
        sleep 5
        if ! sudo -u www-data pm2 list | grep -q "$PM2_APP_NAME.*online"; then
            log "ERROR: PM2 process was started but is not showing as online. Check the logs."
            sudo -u www-data pm2 logs --lines 20 "$PM2_APP_NAME"
            return 1
        fi
        
        # Save PM2 configuration to survive system restarts
        sudo -u www-data pm2 save || log "WARNING: Failed to save PM2 configuration"
        
        # Setup PM2 to start on system boot if not already configured
        sudo -u www-data pm2 startup || log "WARNING: Could not configure PM2 startup. Manual configuration may be required."
        
        log "Server started successfully as www-data user"
    else
        log "ERROR: www-data user not found. Using current user instead."
        
        # Check if PM2 is installed
        if ! command -v pm2 &> /dev/null; then
            log "Installing PM2 globally..."
            npm install -g pm2
        fi
        
        # Force delete PM2 process if it exists but isn't running properly
        log "Checking PM2 process status..."
        if pm2 list | grep -q "$PM2_APP_NAME"; then
            log "Found existing PM2 process, deleting it for a clean start..."
            pm2 delete "$PM2_APP_NAME" || log "WARNING: Failed to delete existing PM2 process"
        fi
        
        # Clean up PM2 logs before starting
        log "Cleaning PM2 logs..."
        pm2 flush || log "WARNING: Failed to flush PM2 logs"
        
        # Start a fresh PM2 process
        log "Creating new PM2 process..."
        cd "$SERVER_DIR"
        if [ -f "$SERVER_DIR/server.js" ]; then
            log "Starting server.js with PM2..."
            NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                --time --log /var/log/pm2-flirtss.log --max-memory-restart 512M || {
                log "ERROR: Failed to create PM2 process on first attempt, trying alternative method..."
                NODE_ENV=production pm2 start --name "$PM2_APP_NAME" \
                    --time --log /var/log/pm2-flirtss.log --max-memory-restart 512M -- node server.js || {
                    log "ERROR: All attempts to start PM2 process failed"
                    return 1
                }
            }
        else
            log "ERROR: server.js not found at $SERVER_DIR/server.js"
            return 1
        fi
        
        # Verify the server is actually running
        sleep 5
        if ! pm2 list | grep -q "$PM2_APP_NAME.*online"; then
            log "ERROR: PM2 process was started but is not showing as online. Check the logs."
            pm2 logs --lines 20 "$PM2_APP_NAME"
            return 1
        fi
        
        # Save PM2 configuration to survive system restarts
        pm2 save || log "WARNING: Failed to save PM2 configuration"
        
        # Setup PM2 to start on system boot if not already configured
        pm2 startup || log "WARNING: Could not configure PM2 startup. Manual configuration may be required."
    fi
    
    # Verify that the server is actually listening on port 5000
    log "Verifying server is listening on port 5000..."
    sleep 5
    if lsof -t -i:5000 > /dev/null; then
        log "Server successfully listening on port 5000"
    else
        log "ERROR: Server is not listening on port 5000. Check logs for details."
        return 1
    fi
}

# Check and restart Nginx
restart_nginx() {
    log "Checking Nginx configuration and restarting..."
    
    # Test Nginx configuration with detailed errors
    nginx -t 2>&1 | tee -a "$LOG_FILE" || {
        log "ERROR: Nginx configuration test failed"
        # Check if there's a backup of the Nginx config, and restore it if available
        local latest_backup=$(ls -t ${NGINX_CONF}.backup-* 2>/dev/null | head -1)
        if [ -n "$latest_backup" ]; then
            log "RECOVERY: Restoring previous working Nginx configuration from $latest_backup"
            cp "$latest_backup" "$NGINX_CONF" || log "CRITICAL: Failed to restore Nginx backup!"
            
            # Test the restored configuration
            if ! nginx -t 2>&1 | tee -a "$LOG_FILE"; then
                log "CRITICAL: Restored Nginx configuration also failed! Manual intervention required."
                exit 1
            fi
            
            log "RECOVERY: Restored Nginx configuration passed the test. Proceeding with restart."
        else
            log "CRITICAL: No Nginx configuration backup found. Manual intervention required."
            exit 1
        fi
    }
    
    # Restart Nginx with additional attempt to reload if restart fails
    log "Restarting Nginx..."
    if ! systemctl restart nginx 2>&1 | tee -a "$LOG_FILE"; then
        log "WARNING: systemctl restart nginx failed, trying service nginx restart..."
        if ! service nginx restart 2>&1 | tee -a "$LOG_FILE"; then
            log "WARNING: service nginx restart failed, trying nginx -s reload..."
            if ! nginx -s reload 2>&1 | tee -a "$LOG_FILE"; then
                log "ERROR: All attempts to restart Nginx failed. Check Nginx logs for details."
                log "NGINX ERROR LOG TAIL:"
                tail -n 20 /var/log/nginx/error.log | tee -a "$LOG_FILE"
                exit 1
            fi
        fi
    fi
    
    # Verify Nginx is running
    log "Verifying Nginx is running..."
    if ! pgrep -x "nginx" > /dev/null; then
        log "ERROR: Nginx does not appear to be running after restart! Check Nginx logs."
        exit 1
    fi
    
    # Check if sites-enabled/default conflicts with our site
    if [ -f "/etc/nginx/sites-enabled/default" ] && [ -f "/etc/nginx/sites-enabled/mandarin" ]; then
        log "WARNING: Both default and mandarin sites are enabled. This might cause port conflicts."
        log "Consider running: sudo rm /etc/nginx/sites-enabled/default"
    fi
    
    log "Nginx restarted successfully"
}

# Main deployment process
main() {
    log "=== STARTING DEPLOYMENT PROCESS ==="
    
    # Perform backup first
    backup_current
    
    # Update from git
    update_from_git
    
    # Deploy client and server
    deploy_client
    deploy_server
    
    # Update Nginx configuration (add this new step)
    update_nginx_config
    
    # Setup TURN server
    setup_turn_server
    
    # Start or restart the server
    start_server
    
    # Check port 5000 again to make sure server is still running
    if ! lsof -t -i:5000 > /dev/null; then
        log "ERROR: Server is not running on port 5000 after startup. Trying to restart..."
        start_server || {
            log "CRITICAL: Server failed to start even after retry. Deployment halted."
            exit 1
        }
    fi
    
    # Restart Nginx (only after server is confirmed running)
    restart_nginx
    
    # Final verification check
    log "Performing final verification checks..."
    
    # Check server status
    if ! lsof -t -i:5000 > /dev/null; then
        log "WARNING: Server does not appear to be running on port 5000 after deployment."
    else
        log "VERIFICATION: Server is running on port 5000."
    fi
    
    # Check Nginx status
    if ! pgrep -x "nginx" > /dev/null; then
        log "WARNING: Nginx does not appear to be running after deployment."
    else
        log "VERIFICATION: Nginx is running."
    fi
    
    # Try a simple curl to test the Socket.IO endpoint
    if command -v curl &> /dev/null; then
        log "Testing Socket.IO endpoint..."
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/socket.io/ | grep -q "20[0-9]"; then
            log "VERIFICATION: Socket.IO endpoint is accessible."
        else
            log "WARNING: Socket.IO endpoint test failed. This might require manual investigation."
        fi
    fi
    
    log "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
    log "NOTE: If Socket.IO is still not working, try:"
    log "  1. Check that port 5000 is not blocked by a firewall"
    log "  2. Verify Nginx is properly forwarding requests to localhost:5000"
    log "  3. Check server logs: pm2 logs $PM2_APP_NAME"
}

# Execute main function
main

exit 0
