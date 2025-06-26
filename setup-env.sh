#!/bin/bash

# Generate .env file with current user's UID/GID
cat > .env << EOF
# Port for the application
PORT=3001

# Working directory inside container
WORK_DIR=/app/workspace

# Host directory to mount as workspace
HOST_WORK_DIR=./workspace

# User ID for file permissions (current user)
USER_ID=$(id -u)

# Group ID for file permissions (current user)
GROUP_ID=$(id -g)

# Additional arguments for Claude Code sessions
CC_CLAUDE_ARGS=
EOF

echo "Created .env file with:"
echo "USER_ID=$(id -u)"
echo "GROUP_ID=$(id -g)"
echo ""
echo "Now you can run: docker compose up"