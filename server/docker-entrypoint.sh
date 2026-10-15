#!/bin/sh
# Starts the app as the unprivileged node user. When the container starts as root (the default),
# the data directory is first handed to that user: Docker creates missing bind-mounted host
# directories as root, which node could not write to.
set -e

if [ "$(id -u)" = 0 ]; then
  mkdir -p "$DATA_DIR"
  # Only what node doesn't own already, so restarts stay fast; fails on e.g. root-squashed NFS
  if ! find "$DATA_DIR" ! -user node -exec chown node:node {} + 2>/dev/null; then
    echo "Warning: could not give the node user (uid 1000) ownership of $DATA_DIR; make it writable for that user" >&2
  fi
  exec su-exec node "$@"
fi

exec "$@"
