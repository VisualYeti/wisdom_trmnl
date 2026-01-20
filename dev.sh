#!/bin/bash

IMAGE_NAME="trmnlp-custom"

# Handle --rebuild flag
if [ "$1" = "--rebuild" ]; then
    echo "Rebuilding Docker image..."
    docker rmi "$IMAGE_NAME" &>/dev/null
    docker build -t "$IMAGE_NAME" .
elif ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building Docker image..."
    docker build -t "$IMAGE_NAME" .
fi

# Stop any existing container using port 4567
docker ps -q --filter "publish=4567" | xargs -r docker stop &>/dev/null

# Start the container
echo ""
echo "Starting TRMNL preview server..."
echo "Open http://localhost:4567 in your browser"
echo ""
docker run --rm \
    --publish 4567:4567 \
    --volume "$(pwd):/plugin" \
    "$IMAGE_NAME" serve
