#!/bin/bash

# Configure git to trust all directories
git config --global --add safe.directory '*'

# Fix ownership of workspace directory if it exists and is owned by different user
if [ -d "/app/workspace" ]; then
    # Check if current user can access the workspace
    if [ ! -w "/app/workspace" ]; then
        echo "Warning: Workspace directory is not writable by current user"
    fi
    
    # Add specific safe directory for common workspace paths
    for dir in /app/workspace/*; do
        if [ -d "$dir" ] && [ -d "$dir/.git" ]; then
            echo "Adding safe directory: $dir"
            git config --global --add safe.directory "$dir" || true
        fi
    done
fi

# Check if Claude CLI is available
echo "Checking Claude CLI availability..."
if command -v claude &> /dev/null; then
    echo "Claude CLI found at: $(which claude)"
    echo "Claude CLI version:"
    claude --version || echo "Failed to get Claude version"
else
    echo "ERROR: Claude CLI not found!"
    echo "PATH: $PATH"
fi

# Start the application
exec "$@"