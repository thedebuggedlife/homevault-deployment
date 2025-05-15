#!/bin/bash
set -e

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup process"

# Check if all required environment variables are set
if [ -z "$RESTIC_REPOSITORY" ]; then
    log "Error: RESTIC_REPOSITORY environment variable not set"
    exit 1
fi

if [ -z "$RESTIC_PASSWORD" ] && [ -z "$RESTIC_PASSWORD_FILE" ]; then
    log "Error: Either RESTIC_PASSWORD or RESTIC_PASSWORD_FILE must be set"
    exit 1
fi

# Source directories (use a default if not provided)
BACKUP_PATHS=${BACKUP_PATHS:-"/data"}
log "Backup paths: $BACKUP_PATHS"

# Backup options
RESTIC_OPTS=${RESTIC_OPTS:-"--verbose"}
log "Using restic options: $RESTIC_OPTS"

# Parse retention policy
if [ -n "${RETENTION_POLICY:-}" ]; then
    log "Parsing retention policy: $RETENTION_POLICY"
    RETENTION_ARGS=""
    
    # Extract hours
    if [[ $RETENTION_POLICY =~ ([0-9]+)h ]]; then
        HOURS="${BASH_REMATCH[1]}"
        RETENTION_ARGS="$RETENTION_ARGS --keep-hourly $HOURS"
        log "Will keep $HOURS hourly snapshots"
    fi
    
    # Extract days
    if [[ $RETENTION_POLICY =~ ([0-9]+)d ]]; then
        DAYS="${BASH_REMATCH[1]}"
        RETENTION_ARGS="$RETENTION_ARGS --keep-daily $DAYS"
        log "Will keep $DAYS daily snapshots"
    fi
    
    # Extract weeks
    if [[ $RETENTION_POLICY =~ ([0-9]+)w ]]; then
        WEEKS="${BASH_REMATCH[1]}"
        RETENTION_ARGS="$RETENTION_ARGS --keep-weekly $WEEKS"
        log "Will keep $WEEKS weekly snapshots"
    fi
    
    # Extract months
    if [[ $RETENTION_POLICY =~ ([0-9]+)m ]]; then
        MONTHS="${BASH_REMATCH[1]}"
        RETENTION_ARGS="$RETENTION_ARGS --keep-monthly $MONTHS"
        log "Will keep $MONTHS monthly snapshots"
    fi
    
    # Extract years
    if [[ $RETENTION_POLICY =~ ([0-9]+)y ]]; then
        YEARS="${BASH_REMATCH[1]}"
        RETENTION_ARGS="$RETENTION_ARGS --keep-yearly $YEARS"
        log "Will keep $YEARS yearly snapshots"
    fi
    
    # If no valid formats were found, use default
    if [ -z "$RETENTION_ARGS" ]; then
        log "No valid retention policy found, using default"
        RETENTION_ARGS="--keep-daily 7 --keep-weekly 4 --keep-monthly 6"
    fi
else
    # Default retention policy
    RETENTION_ARGS="--keep-daily 7 --keep-weekly 4 --keep-monthly 6"
    log "Using default retention policy: $RETENTION_ARGS"
fi

# Initialize variables
SNAPSHOT_CREATED=false
CONTAINERS_STOPPED=false

# Check if Docker is available when needed
if [ "${USE_DOCKER:-false}" = "true" ]; then
    # Check if docker command is available
    if ! command -v docker >/dev/null 2>&1; then
        log "Error: Docker operations requested but Docker CLI not available"
        exit 1
    fi
    
    # Check if docker socket is accessible
    if [ ! -S "/var/run/docker.sock" ]; then
        log "Error: Docker operations requested but Docker socket not found"
        exit 1
    fi
    
    log "Docker is available for container operations"
    
    # Check Docker Compose requirements if needed
    if [ -n "$DOCKER_COMPOSE_PROJECT" ] || [ -n "$DOCKER_COMPOSE_SERVICES" ]; then
        # Check if docker compose command is available
        if ! docker compose version >/dev/null 2>&1; then
            log "Error: Docker Compose operations requested but Docker Compose not available"
            exit 1
        fi
        
        # Ensure both project and services are specified
        if [ -z "$DOCKER_COMPOSE_PROJECT" ]; then
            log "Error: DOCKER_COMPOSE_SERVICES specified but DOCKER_COMPOSE_PROJECT is missing"
            exit 1
        fi
        
        if [ -z "$DOCKER_COMPOSE_SERVICES" ]; then
            log "Error: DOCKER_COMPOSE_PROJECT specified but DOCKER_COMPOSE_SERVICES is missing"
            exit 1
        fi
        
        log "Docker Compose is available for service operations"
    elif [ -z "$STOP_CONTAINERS" ]; then
        log "Error: USE_DOCKER is true but neither STOP_CONTAINERS nor Docker Compose services are specified"
        exit 1
    fi
fi

CONTAINERS_STOPPED=false

# Handle Docker Compose services if specified
if [ "${USE_DOCKER:-false}" = "true" ] && [ -n "$DOCKER_COMPOSE_PROJECT" ] && [ -n "$DOCKER_COMPOSE_SERVICES" ]; then
    log "Using Docker Compose to manage services"
    
    # Prepare docker compose command
    COMPOSE_CMD="docker compose -p $DOCKER_COMPOSE_PROJECT"
    
    log "Docker Compose command: $COMPOSE_CMD"
    log "Stopping services: $DOCKER_COMPOSE_SERVICES"
    
    if $COMPOSE_CMD stop $DOCKER_COMPOSE_SERVICES; then
        log "Successfully stopped Docker Compose services"
        CONTAINERS_STOPPED=true
    else
        log "Error: Failed to stop Docker Compose services"
        exit 1
    fi
# Handle individual containers if specified
elif [ "${USE_DOCKER:-false}" = "true" ] && [ -n "$STOP_CONTAINERS" ]; then
    log "Stopping individual containers: $STOP_CONTAINERS"
    
    for container in $STOP_CONTAINERS; do
        log "Stopping container: $container"
        if docker stop "$container"; then
            log "Container $container stopped successfully"
        else
            log "Error: Failed to stop container $container"
            exit 1
        fi
    done
    
    CONTAINERS_STOPPED=true
fi

# LVM Snapshot configuration
if [ "${USE_LVM_SNAPSHOT:-false}" = "true" ]; then
    LVM_VOLUME_GROUP=${LVM_VOLUME_GROUP:-""}
    LVM_LOGICAL_VOLUME=${LVM_LOGICAL_VOLUME:-""}
    LVM_SNAPSHOT_SIZE=${LVM_SNAPSHOT_SIZE:-"2G"}
    LVM_SNAPSHOT_NAME=${LVM_SNAPSHOT_NAME:-"restic_snapshot"}
    LVM_MOUNT_PATH=${LVM_MOUNT_PATH:-"/mnt/snapshot"}

    if [ -n "$LVM_VOLUME_GROUP" ] && [ -n "$LVM_LOGICAL_VOLUME" ]; then
        if ! command -v lvcreate >/dev/null 2>&1; then
            log "Error: lvcreate command not found. Please install LVM tools in the container."
            exit 1
        fi

        log "Creating LVM snapshot of $LVM_VOLUME_GROUP/$LVM_LOGICAL_VOLUME with size $LVM_SNAPSHOT_SIZE"
        
        # Create the snapshot
        if ! lvcreate -L "$LVM_SNAPSHOT_SIZE" -s -n "$LVM_SNAPSHOT_NAME" "/dev/$LVM_VOLUME_GROUP/$LVM_LOGICAL_VOLUME"; then
            log "Error: Failed to create LVM snapshot"
            
            # Restart containers if they were stopped
            if [ "$CONTAINERS_STOPPED" = "true" ]; then
                for container in $STOP_CONTAINERS; do
                    log "Restarting container: $container"
                    docker start "$container" || log "Warning: Failed to restart container $container"
                done
            fi
            
            exit 1
        fi
        SNAPSHOT_CREATED=true
        
        # Create mount point if it doesn't exist
        mkdir -p "$LVM_MOUNT_PATH"
        
        # Mount the snapshot
        log "Mounting LVM snapshot to $LVM_MOUNT_PATH"
        if ! mount "/dev/$LVM_VOLUME_GROUP/$LVM_SNAPSHOT_NAME" "$LVM_MOUNT_PATH"; then
            log "Error: Failed to mount LVM snapshot"
            
            # Clean up the snapshot
            lvremove -f "/dev/$LVM_VOLUME_GROUP/$LVM_SNAPSHOT_NAME"
            
            # Restart containers if they were stopped
            if [ "$CONTAINERS_STOPPED" = "true" ]; then
                for container in $STOP_CONTAINERS; do
                    log "Restarting container: $container"
                    docker start "$container" || log "Warning: Failed to restart container $container"
                done
            fi
            
            exit 1
        fi
        
        # Update the backup path to use the snapshot
        if [ "${REPLACE_BACKUP_PATH:-true}" = "true" ]; then
            BACKUP_PATHS="$LVM_MOUNT_PATH"
            log "Updated backup path to use snapshot: $BACKUP_PATHS"
        else
            log "Using original backup paths with snapshot available at $LVM_MOUNT_PATH"
        fi
    else
        log "Error: LVM_VOLUME_GROUP and LVM_LOGICAL_VOLUME must be set when USE_LVM_SNAPSHOT is true"
        exit 1
    fi
fi

# Execute pre-backup hook if it exists
if [ -f "/hooks/pre-backup.sh" ]; then
    log "Executing pre-backup hook"
    if bash /hooks/pre-backup.sh; then
        log "Pre-backup hook executed successfully"
    else
        log "Warning: Pre-backup hook failed with exit code $?"
    fi
fi

# Initialize the repository if it doesn't exist
if ! restic snapshots &>/dev/null; then
    log "Repository not initialized. Running: restic init"
    restic init
    log "Repository initialized successfully"
fi

# Run the backup
log "Starting backup process: restic backup $RESTIC_OPTS $BACKUP_PATHS"
restic backup $RESTIC_OPTS $BACKUP_PATHS
BACKUP_EXIT_CODE=$?
log "Backup completed with exit code: $BACKUP_EXIT_CODE"

# Clean up LVM snapshot if it was created
if [ "$SNAPSHOT_CREATED" = "true" ]; then
    log "Unmounting LVM snapshot"
    umount "$LVM_MOUNT_PATH" || log "Warning: Failed to unmount snapshot, continuing anyway"
    
    log "Removing LVM snapshot"
    lvremove -f "/dev/$LVM_VOLUME_GROUP/$LVM_SNAPSHOT_NAME" || log "Warning: Failed to remove LVM snapshot"
fi

# Restart containers if they were stopped
if [ "$CONTAINERS_STOPPED" = "true" ]; then
    # If we used Docker Compose to stop services, start them the same way
    if [ -n "$DOCKER_COMPOSE_PROJECT" ] && [ -n "$DOCKER_COMPOSE_SERVICES" ]; then
        log "Restarting Docker Compose services"
        
        if docker compose -p "$DOCKER_COMPOSE_PROJECT" start $DOCKER_COMPOSE_SERVICES; then
            log "Successfully restarted Docker Compose services"
        else
            log "Error: Failed to restart Docker Compose services"
            exit 1
        fi
    # Otherwise, start individual containers
    elif [ -n "$STOP_CONTAINERS" ]; then
        log "Restarting individual containers"
        for container in $STOP_CONTAINERS; do
            log "Starting container: $container"
            if docker start "$container"; then
                log "Container $container started successfully"
            else
                log "Error: Failed to restart container $container"
                exit 1
            fi
        done
    fi
fi

# Execute post-backup hook if it exists
if [ -f "/hooks/post-backup.sh" ]; then
    log "Executing post-backup hook"
    if bash /hooks/post-backup.sh; then
        log "Post-backup hook executed successfully"
    else
        log "Warning: Post-backup hook failed with exit code $?"
    fi
fi

# Exit if backup failed
if [ $BACKUP_EXIT_CODE -ne 0 ]; then
    log "Error: Backup failed with exit code $BACKUP_EXIT_CODE"
    exit $BACKUP_EXIT_CODE
fi

# Run forget and prune if enabled
if [ "${ENABLE_FORGET:-true}" = "true" ]; then
    log "Running forget with policy: $RETENTION_ARGS"
    restic forget $RETENTION_ARGS --prune
    log "Forget and prune completed"
fi

log "Backup process completed successfully"