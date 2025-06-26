#!/bin/bash
# Wrapper script for Claude CLI to work around env -S issue in Alpine Linux

exec node --no-warnings --enable-source-maps /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"