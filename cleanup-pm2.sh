#!/bin/bash
# PM2 Cleanup Script
# This script removes all PM2 instances and ensures a clean state
# Run with appropriate permissions (sudo may be required for root processes)

# Exit immediately on error
set -e

# Log file
LOG_FILE="/var/log/mandarin-cleanup.log"

# Function for logging
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# Create log file if it doesn't exist
mkdir -p $(dirname "$LOG_FILE")
touch "$LOG_FILE"

log "Starting PM2 cleanup process..."

# Check if we're running with sufficient permissions
if [ "$EUID" -ne 0 ]; then
    log "WARNING: This script is not running as root. Some operations may fail."
    log "Consider running with sudo for complete cleanup."
fi

# Function to clean up PM2 for a specific user
cleanup_pm2_for_user() {
    local user=$1
    
    log "Cleaning up PM2 instances for user: $user"
    
    # Check if user exists
    if ! id "$user" &>/dev/null; then
        log "User $user does not exist, skipping."
        return
    fi
    
    # Function to run command as specified user
    run_as_user() {
        local cmd="$1"
        
        if [ "$(whoami)" = "$user" ]; then
            # If current user is the target user, run directly
            eval "$cmd"
        else
            # Otherwise use sudo to run as specified user
            sudo -u "$user" bash -c "$cmd"
        fi
    }
    
    # Check if PM2 is installed for this user
    if ! run_as_user "command -v pm2 &>/dev/null"; then
        log "PM2 not installed for user $user, skipping."
        return
    fi
    
    # Get the list of PM2 processes for this user
    local processes=$(run_as_user "pm2 list --no-color | grep -v 'id' | awk '{print \$4}'")
    
    if [ -z "$processes" ]; then
        log "No PM2 processes found for user $user."
    else
        for process in $processes; do
            if [ "$process" != "┼" ] && [ "$process" != "│" ] && [ -n "$process" ]; then
                log "Stopping and removing PM2 process: $process"
                run_as_user "pm2 stop $process" || log "WARNING: Failed to stop $process"
                run_as_user "pm2 delete $process" || log "WARNING: Failed to delete $process"
            fi
        done
    fi
    
    # Save the empty process list
    run_as_user "pm2 save --force" || log "WARNING: Failed to save PM2 process list for $user"
    
    log "PM2 cleanup completed for user $user."
}

# Clean up for root
log "Starting cleanup for root user..."
if [ "$EUID" -eq 0 ]; then
    cleanup_pm2_for_user "root"
else
    log "Script not running as root. To clean up root PM2 processes, run with sudo."
fi

# Clean up for current user
log "Starting cleanup for current user: $(whoami)..."
cleanup_pm2_for_user "$(whoami)"

# Clean up for www-data
log "Starting cleanup for www-data user..."
cleanup_pm2_for_user "www-data"

# Clean up for sysadmin (if exists)
log "Starting cleanup for sysadmin user..."
cleanup_pm2_for_user "sysadmin"

log "PM2 cleanup process completed."

# Setup for www-data (optional)
if [ "$EUID" -eq 0 ]; then
    log "Setting up PM2 for www-data user..."
    
    # Ensure proper ownership of application directory
    APP_DIR="/var/www/mandarin"
    if [ -d "$APP_DIR" ]; then
        log "Setting proper ownership for $APP_DIR"
        chown -R www-data:www-data "$APP_DIR"
    else
        log "WARNING: $APP_DIR directory not found."
    fi
    
    # Install PM2 for www-data if needed
    if ! sudo -u www-data command -v pm2 &>/dev/null; then
        log "Installing PM2 for www-data user..."
        sudo -u www-data npm install -g pm2
    fi
    
    log "PM2 setup for www-data completed."
else
    log "Not running as root. Skipping PM2 setup for www-data."
fi

log "Cleanup script execution completed."
echo ""
echo "==========================================================="
echo "PM2 cleanup completed. To start your server correctly, run:"
echo "sudo -u www-data pm2 start /var/www/mandarin/server/server.js --name flirtss-server"
echo "sudo -u www-data pm2 save"
echo "sudo -u www-data pm2 startup"
echo "Then restart Nginx: sudo systemctl restart nginx"
echo "==========================================================="