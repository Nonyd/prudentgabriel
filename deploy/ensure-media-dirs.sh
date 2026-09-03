#!/bin/sh
# Create host media binds for both environments. nextjs in the image is uid 1001.
set -eu
install_dir() {
  dir="$1"
  mkdir -p "$dir/public" "$dir/private"
  chown -R 1001:1001 "$dir"
  chmod 0750 "$dir" "$dir/public" "$dir/private"
}
install_dir /opt/prudentgabriel/media-staging
install_dir /opt/prudentgabriel/media
echo "media dirs ready"
