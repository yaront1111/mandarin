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
    # Try saving as www-data if possible, otherwise as current user
    if id "www-data" &>/dev/null; then
        sudo -u www-data pm2 save 2>/dev/null || log "Could not backup PM2 configuration as www-data"
    else
        pm2 save 2>/dev/null || log "Could not backup PM2 configuration as current user"
    fi


    log "Backup completed successfully"
}

# Update from git repository
update_from_git() {
    log "Updating from git repository..."

    # If this is a git repository, pull the latest changes
    if [ -d "$APP_DIR/.git" ]; then
        log "Found git repository at $APP_DIR, pulling latest changes..."
        cd "$APP_DIR"
        # Use stash and pull to handle potential local changes
        git stash push --include-untracked || log "WARNING: Failed to stash local changes"
        git pull || {
            log "ERROR: Failed to pull from git repository. Attempting stash pop."
            git stash pop || log "WARNING: Failed to pop stash after failed pull."
            exit 1
        }
        git stash pop || log "NOTE: No stash entries to pop or potential conflict."
    else
        log "WARNING: $APP_DIR is not a git repository. Skipping git update."
    fi
}

# Build and deploy client
deploy_client() {
    log "Deploying client application..."

    if [ ! -d "$CLIENT_DIR" ]; then
        log "ERROR: Client directory $CLIENT_DIR not found!"
        exit 1
    fi
    cd "$CLIENT_DIR"

    # Install dependencies
    log "Installing client dependencies..."
    npm ci || {
      log "npm ci failed, attempting npm install..."
      npm install || {
          log "ERROR: Failed to install client dependencies"
          exit 1
      }
    }

    # Build the client application
    log "Building client application..."
    npm run build || {
        log "ERROR: Client build failed"
        exit 1
    }

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

    if [ ! -d "$SERVER_DIR" ]; then
        log "ERROR: Server directory $SERVER_DIR not found!"
        exit 1
    fi
    cd "$SERVER_DIR"

    # Install server dependencies
    log "Installing server dependencies..."
    npm ci || {
      log "npm ci failed, attempting npm install..."
      npm install || {
          log "ERROR: Failed to install server dependencies"
          exit 1
      }
    }

    # Ensure production environment settings are available
    log "Setting up production environment..."
    if [ -f ".env.production" ]; then
        log "Found .env.production file, copying to .env for production use"
        cp ".env.production" ".env"
        
        # Set appropriate permissions if www-data exists
        if id "www-data" &>/dev/null; then
            chown www-data:www-data ".env"
            chown www-data:www-data ".env.production"
            chmod 640 ".env"
            chmod 640 ".env.production"
        else
            log "WARNING: www-data user not found, cannot set specific permissions for .env files"
        fi
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

    # Set appropriate permissions if www-data exists
    if id "www-data" &>/dev/null; then
        log "Setting ownership to www-data for uploads and logs directories..."
        chown -R www-data:www-data "$SERVER_DIR/uploads"
        chmod -R 750 "$SERVER_DIR/uploads" # Restrict permissions slightly more
        chown -R www-data:www-data "$SERVER_DIR/logs"
        chmod -R 750 "$SERVER_DIR/logs" # Restrict permissions slightly more
    else
         log "WARNING: www-data user not found, cannot set specific ownership for uploads and logs directories."
    fi

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
        if [ ! -L "/etc/nginx/sites-enabled/mandarin" ]; then # Check if it's specifically a symlink
            log "Creating symlink in sites-enabled directory..."
             # Remove potentially existing regular file before creating symlink
            rm -f "/etc/nginx/sites-enabled/mandarin"
            ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/mandarin" || log "WARNING: Failed to create symlink in sites-enabled"
        else
             log "Symlink /etc/nginx/sites-enabled/mandarin already exists."
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
        sleep 2 # Give time for port to free up
    fi

    # Define log paths
    local PM2_LOG_OUT="$SERVER_DIR/logs/pm2-$PM2_APP_NAME-out.log"
    local PM2_LOG_ERR="$SERVER_DIR/logs/pm2-$PM2_APP_NAME-err.log"

    # Make sure www-data user exists and has proper permissions
    if id "www-data" &>/dev/null; then
        # Make sure the server directory is owned by www-data (already done in deploy_server, but double-check)
        log "Verifying ownership for server directory..."
        chown -R www-data:www-data "$SERVER_DIR"

        # Check if PM2 is installed for www-data
        if ! sudo -u www-data command -v pm2 &> /dev/null; then
            log "Installing PM2 globally (might require sudo password if not already done)..."
            # This usually needs to be done by root, not sudo -u www-data
            if ! command -v pm2 &> /dev/null; then
                 npm install pm2 -g || { log "ERROR: Failed to install PM2 globally"; exit 1; }
            else
                 log "PM2 already installed globally."
            fi
            # No guarantee www-data can use it immediately, but let's try
        fi

        # Force delete PM2 process if it exists but isn't running properly
        log "Checking PM2 process status for $PM2_APP_NAME..."
        if sudo -u www-data pm2 list | grep -qw "$PM2_APP_NAME"; then
            log "Found existing PM2 process $PM2_APP_NAME, deleting it for a clean start..."
            sudo -u www-data pm2 delete "$PM2_APP_NAME" || log "WARNING: Failed to delete existing PM2 process $PM2_APP_NAME"
            sleep 1
        fi

        # Clean up PM2 logs before starting
        log "Cleaning PM2 logs..."
        sudo -u www-data pm2 flush || log "WARNING: Failed to flush PM2 logs as www-data"

        # Start a fresh PM2 process
        log "Creating new PM2 process as www-data..."
        cd "$SERVER_DIR"
        if [ -f "$SERVER_DIR/server.js" ]; then
            log "Starting server.js with PM2..."
            # --- MODIFIED LINE --- Use logs directory and separate error log
            sudo -u www-data NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                --time --output "$PM2_LOG_OUT" --error "$PM2_LOG_ERR" --log-date-format "YYYY-MM-DD HH:mm:ss Z" --max-memory-restart 512M || {
                log "ERROR: Failed to create PM2 process on first attempt, trying alternative method (using node)..."
                # --- MODIFIED LINE --- Use logs directory and separate error log
                sudo -u www-data NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                    --time --output "$PM2_LOG_OUT" --error "$PM2_LOG_ERR" --log-date-format "YYYY-MM-DD HH:mm:ss Z" --max-memory-restart 512M --interpreter node || {
                    log "ERROR: All attempts to start PM2 process as www-data failed"
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
            log "ERROR: PM2 process $PM2_APP_NAME was started but is not showing as online. Check logs:"
            log "Output Log ($PM2_LOG_OUT):"
            tail -n 20 "$PM2_LOG_OUT" | tee -a "$LOG_FILE"
            log "Error Log ($PM2_LOG_ERR):"
            tail -n 20 "$PM2_LOG_ERR" | tee -a "$LOG_FILE"
            log "PM2 Daemon Log:"
            sudo -u www-data pm2 logs --lines 20 --nostream # Check system PM2 logs too
            return 1
        fi

        # Save PM2 configuration to survive system restarts
        log "Saving PM2 process list for www-data..."
        sudo -u www-data pm2 save || log "WARNING: Failed to save PM2 configuration for www-data"

        # Setup PM2 to start on system boot if not already configured
        # This command usually generates another command to be run as root
        log "Generating PM2 startup script command (run this command as root if needed)..."
        sudo -u www-data pm2 startup | tee -a "$LOG_FILE" || log "WARNING: Could not configure PM2 startup for www-data. Manual configuration may be required."

        log "Server started successfully as www-data user"

    else
        log "ERROR: www-data user not found. Using current user instead. NOTE: This might cause permission issues!"

        # Check if PM2 is installed globally
        if ! command -v pm2 &> /dev/null; then
            log "Installing PM2 globally..."
            npm install -g pm2 || { log "ERROR: Failed to install PM2 globally"; exit 1; }
        fi

        # Force delete PM2 process if it exists but isn't running properly
        log "Checking PM2 process status for $PM2_APP_NAME..."
        if pm2 list | grep -qw "$PM2_APP_NAME"; then
            log "Found existing PM2 process $PM2_APP_NAME, deleting it for a clean start..."
            pm2 delete "$PM2_APP_NAME" || log "WARNING: Failed to delete existing PM2 process $PM2_APP_NAME"
            sleep 1
        fi

        # Clean up PM2 logs before starting
        log "Cleaning PM2 logs..."
        pm2 flush || log "WARNING: Failed to flush PM2 logs"

        # Start a fresh PM2 process
        log "Creating new PM2 process as current user..."
        cd "$SERVER_DIR"
        if [ -f "$SERVER_DIR/server.js" ]; then
            log "Starting server.js with PM2..."
             # --- MODIFIED LINE --- Use logs directory and separate error log
            NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                --time --output "$PM2_LOG_OUT" --error "$PM2_LOG_ERR" --log-date-format "YYYY-MM-DD HH:mm:ss Z" --max-memory-restart 512M || {
                log "ERROR: Failed to create PM2 process on first attempt, trying alternative method (using node)..."
                # --- MODIFIED LINE --- Use logs directory and separate error log
                NODE_ENV=production pm2 start server.js --name "$PM2_APP_NAME" \
                    --time --output "$PM2_LOG_OUT" --error "$PM2_LOG_ERR" --log-date-format "YYYY-MM-DD HH:mm:ss Z" --max-memory-restart 512M --interpreter node || {
                    log "ERROR: All attempts to start PM2 process as current user failed"
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
            log "ERROR: PM2 process $PM2_APP_NAME was started but is not showing as online. Check logs:"
            log "Output Log ($PM2_LOG_OUT):"
            tail -n 20 "$PM2_LOG_OUT" | tee -a "$LOG_FILE"
            log "Error Log ($PM2_LOG_ERR):"
            tail -n 20 "$PM2_LOG_ERR" | tee -a "$LOG_FILE"
            log "PM2 Daemon Log:"
            pm2 logs --lines 20 --nostream # Check system PM2 logs too
            return 1
        fi

        # Save PM2 configuration to survive system restarts
        log "Saving PM2 process list for current user..."
        pm2 save || log "WARNING: Failed to save PM2 configuration for current user"

        # Setup PM2 to start on system boot if not already configured
        log "Generating PM2 startup script command (run this command as root if needed)..."
        pm2 startup | tee -a "$LOG_FILE" || log "WARNING: Could not configure PM2 startup for current user. Manual configuration may be required."
        log "Server started successfully as current user (NOT RECOMMENDED for production)"
    fi

    # Verify that the server is actually listening on port 5000
    log "Verifying server is listening on port 5000..."
    sleep 5 # Give server a bit more time to bind
    if lsof -i :5000 -sTCP:LISTEN -t > /dev/null ; then
        log "Server successfully listening on port 5000"
    else
        log "ERROR: Server is not listening on port 5000. Check application logs again."
        # Display logs again just in case
        if id "www-data" &>/dev/null; then
             sudo -u www-data pm2 logs --lines 50 "$PM2_APP_NAME" --nostream
        else
             pm2 logs --lines 50 "$PM2_APP_NAME" --nostream
        fi
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
            log "Nginx reloaded successfully."
        else
             log "Nginx restarted successfully using 'service'."
        fi
    else
         log "Nginx restarted successfully using 'systemctl'."
    fi


    # Verify Nginx is running
    log "Verifying Nginx is running..."
    if ! pgrep -x "nginx" > /dev/null; then
        log "ERROR: Nginx does not appear to be running after restart/reload! Check Nginx logs."
        tail -n 20 /var/log/nginx/error.log | tee -a "$LOG_FILE"
        exit 1
    fi

    # Check if sites-enabled/default conflicts with our site
    if [ -f "/etc/nginx/sites-enabled/default" ] && [ -L "/etc/nginx/sites-enabled/mandarin" ]; then
        log "WARNING: Both default and mandarin sites are enabled. This might cause port conflicts or unexpected behavior."
        log "Consider running: sudo rm /etc/nginx/sites-enabled/default"
    fi

    log "Nginx service check completed."
}

# Main deployment process
main() {
    log "=== STARTING DEPLOYMENT PROCESS ==="

    # Perform backup first
    backup_current

    # Update from git
    update_from_git

    # Deploy client and server (installs dependencies, builds client, sets permissions)
    deploy_client
    deploy_server

    # Update Nginx configuration if provided
    update_nginx_config

    # Setup TURN server if script exists
    setup_turn_server

    # Start or restart the server using PM2
    start_server || {
        log "CRITICAL: Server failed to start. Deployment halted before Nginx restart."
        exit 1
    }

    # Check port 5000 again to make sure server is still running before restarting Nginx
    if ! lsof -i :5000 -sTCP:LISTEN -t > /dev/null ; then
        log "ERROR: Server started but is not listening on port 5000 before Nginx restart. Trying one more start..."
        start_server || {
            log "CRITICAL: Server failed to start even after retry. Deployment halted."
            exit 1
        }
    fi

    # Restart Nginx (only after server is confirmed running)
    restart_nginx

    # Final verification check
    log "Performing final verification checks..."

    # Check server status via PM2
    local pm2_user_cmd=""
    if id "www-data" &>/dev/null; then
        pm2_user_cmd="sudo -u www-data"
    fi
    if ! $pm2_user_cmd pm2 list | grep -q "$PM2_APP_NAME.*online"; then
         log "WARNING: PM2 does not show $PM2_APP_NAME as online after deployment."
    else
         log "VERIFICATION: PM2 shows $PM2_APP_NAME as online."
    fi

    # Check server listening port
    if ! lsof -i :5000 -sTCP:LISTEN -t > /dev/null ; then
        log "WARNING: Server does not appear to be listening on port 5000 after deployment."
    else
        log "VERIFICATION: Server is listening on port 5000."
    fi

    # Check Nginx status
    if ! pgrep -x "nginx" > /dev/null; then
        log "WARNING: Nginx does not appear to be running after deployment."
    else
        log "VERIFICATION: Nginx process is running."
    fi

    # Try a simple curl to test the Socket.IO endpoint via localhost
    if command -v curl &> /dev/null; then
        log "Testing internal Socket.IO endpoint (localhost:5000)..."
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/socket.io/)
        if [[ "$http_code" == "200" || "$http_code" == "400" ]]; then # 400 is expected for base socket.io/ without transport
            log "VERIFICATION: Internal Socket.IO endpoint is responding (HTTP $http_code)."
        else
            log "WARNING: Internal Socket.IO endpoint test failed (HTTP $http_code). This might require manual investigation."
        fi
    else
         log "WARNING: curl command not found, skipping Socket.IO endpoint test."
    fi

    log "=== DEPLOYMENT COMPLETED ==="
    log "Review logs above for any WARNINGS or ERRORS."
    log "Deployment Log: $LOG_FILE"
    log "PM2 App Logs: $PM2_LOG_OUT and $PM2_LOG_ERR"
    log "NOTE: If issues persist, check:"
    log "  1. Firewall rules (ufw status, iptables -L)"
    log "  2. Nginx error logs (/var/log/nginx/error.log)"
    log "  3. Application logs ($PM2_LOG_ERR)"
    log "  4. Run '$pm2_user_cmd pm2 logs $PM2_APP_NAME' for real-time logs."
}

# Execute main function
main

exit 0
