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
    
    # Check if the app directory exists and is a git repo
    if [ -d "$APP_DIR/.git" ]; then
        cd "$APP_DIR"
        git fetch --all
        git reset --hard origin/main  # Adjust branch name if different
        log "Git repository updated successfully"
    else
        log "Directory is not a git repository. Attempting to clone..."
        mkdir -p "$APP_DIR"
        git clone "$GITHUB_REPO" "$APP_DIR"
        log "Git repository cloned successfully"
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
    
    # Set appropriate permissions
    chown -R www-data:www-data "$SERVER_DIR/uploads"
    chmod -R 755 "$SERVER_DIR/uploads"
    
    log "Server deployed successfully"
}

# Configure and start TURN server
setup_turn_server() {
    log "Setting up TURN server..."
    
    # Check if TURN.sh exists and is executable
    if [ -f "$SERVER_DIR/TURN.sh" ]; then
        chmod +x "$SERVER_DIR/TURN.sh"
        
        # Execute TURN server setup script
        log "Running TURN server setup script..."
        "$SERVER_DIR/TURN.sh" || log "WARNING: TURN server setup script encountered an error"
    else
        log "WARNING: TURN server setup script not found at $SERVER_DIR/TURN.sh"
    fi
}

# Start or restart the server with PM2
start_server() {
    log "Starting server with PM2..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2 globally..."
        npm install -g pm2
    fi
    
    # Check if the app is already running in PM2
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        log "Restarting existing PM2 process..."
        pm2 restart "$PM2_APP_NAME" || log "WARNING: Failed to restart PM2 process"
    else
        log "Creating new PM2 process..."
        cd "$SERVER_DIR"
        pm2 start server.js --name "$PM2_APP_NAME" --time || log "WARNING: Failed to create PM2 process"
    fi
    
    # Save PM2 configuration to survive system restarts
    pm2 save
    
    # Setup PM2 to start on system boot if not already configured
    pm2 startup || log "WARNING: Could not configure PM2 startup. Manual configuration may be required."
}

# Check and restart Nginx
restart_nginx() {
    log "Checking Nginx configuration and restarting..."
    
    # Test Nginx configuration
    nginx -t || {
        log "ERROR: Nginx configuration test failed"
        exit 1
    }
    
    # Restart Nginx
    systemctl restart nginx || service nginx restart || {
        log "ERROR: Failed to restart Nginx"
        exit 1
    }
    
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
    
    # Setup TURN server
    setup_turn_server
    
    # Start or restart the server
    start_server
    
    # Restart Nginx
    restart_nginx
    
    log "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
}

# Execute main function
main

exit 0