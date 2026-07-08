#!/usr/bin/env bash
set -euo pipefail
IMAGE="chat-ai:latest"
podman build -t "$IMAGE" .
podman run -d \
  --name chat-ai \
  -p 3000:3000 \
  --restart always \
  "$IMAGE"
