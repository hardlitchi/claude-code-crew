FROM node:18-alpine

# Install git and other necessary tools including GitHub CLI and build dependencies for native modules
RUN apk add --no-cache git openssh-client curl bash coreutils github-cli \
    python3 make g++ sqlite-dev

# Install pnpm
RUN npm install -g pnpm

# Install Claude CLI (claude-code)
RUN npm install -g @anthropic-ai/claude-code

# Copy and install Claude wrapper script
COPY claude-wrapper.sh /usr/local/bin/claude-wrapper
RUN chmod +x /usr/local/bin/claude-wrapper && \
    rm -f /usr/local/bin/claude && \
    ln -s /usr/local/bin/claude-wrapper /usr/local/bin/claude

# Create app directory
WORKDIR /app

# Create user (use existing node user if possible)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Copy and set up entrypoint (as root)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create workspace directory and set permissions
RUN mkdir -p /app/workspace && \
    chown -R node:node /app && \
    chmod 755 /app/workspace && \
    chmod 775 /app/workspace

# Switch to node user
USER node

# Configure git to trust mounted directories (build time)
RUN git config --global --add safe.directory '*'

# Expose port
EXPOSE 3001

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
CMD ["pnpm", "run", "start"]