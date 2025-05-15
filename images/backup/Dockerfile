FROM ghcr.io/restic/restic:0.18

# Install cron, LVM tools, and other dependencies
RUN apk add --no-cache \
    dcron \
    lvm2 \
    tzdata \
    bash \
    docker-cli \
    tini

# Create directories for our scripts and logs
RUN mkdir -p /backup-scripts /var/log

# Copy our backup script
COPY backup.sh /backup-scripts/backup.sh

# Make it executable
RUN chmod +x /backup-scripts/backup.sh

# Create an entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set up a volume for the crontab
VOLUME /etc/crontabs

# Use tini as the entry point to properly handle signals and child processes
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]