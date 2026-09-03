#!/bin/bash
# Restore a media tarball to a scratch directory and list files.
# Usage: restore-media.sh /opt/prudentgabriel/backups/media-staging-YYYYMMDDThhmmssZ.tar.gz
set -euo pipefail
ARCHIVE=${1:?usage: restore-media.sh <media-*.tar.gz>}
SCRATCH=${2:-/tmp/prudentgabriel-media-restore}
rm -rf "$SCRATCH"
mkdir -p "$SCRATCH"
tar -xzf "$ARCHIVE" -C "$SCRATCH"
echo "restored to $SCRATCH"
find "$SCRATCH" -type f | head -20
echo "file count: $(find "$SCRATCH" -type f | wc -l)"
# Leave scratch in place for inspection. Caller deletes.
