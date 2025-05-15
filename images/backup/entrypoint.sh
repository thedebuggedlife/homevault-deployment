#!/bin/bash
set -e

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Initializing container"

# Create hooks directory if it doesn't exist
mkdir -p /hooks

# Set up cron job based on CRON_SCHEDULE
if [ -n "$CRON_SCHEDULE" ]; then
    log "Setting up cron schedule: $CRON_SCHEDULE"
    echo "$CRON_SCHEDULE /backup-scripts/backup.sh 2>&1 | tee -a /proc/1/fd/1" > /etc/crontabs/root
else
    log "Using default cron schedule: 0 2 * * * (2 AM daily)"
    echo "0 2 * * * /backup-scripts/backup.sh 2>&1 | tee -a /proc/1/fd/1" > /etc/crontabs/root
fi

# Run backup immediately if requested
if [ "${RUN_ON_STARTUP:-false}" = "true" ]; then
    log "RUN_ON_STARTUP is enabled, running backup now"
    /backup-scripts/backup.sh
fi

# Start cron daemon in foreground
log "Starting crond in foreground"
exec crond -f -d 8 -l 2