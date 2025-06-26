# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Crew is a web-based interface for managing multiple Claude Code sessions across Git worktrees. It provides browser-based terminal emulation, real-time session management, and Git worktree operations through a React frontend and Node.js backend.

## Common Commands

### Development
- `./start.sh` - Start development environment (installs dependencies if needed)
- `pnpm run dev` - Start development mode with hot reload
- `pnpm run build` - Build both client and server for production
- `pnpm run start` - Start production server

### Testing
- `pnpm run test` - Run tests in watch mode across all packages
- `pnpm run test:run` - Run tests once across all packages
- `pnpm run test:coverage` - Run tests with coverage report
- `pnpm run typecheck` - Run TypeScript type checking across all packages

### Package-specific commands
- Client: `cd client && pnpm run dev` - Start client development server
- Server: `cd server && pnpm run dev` - Start server development with tsx watch

## Architecture

This is a monorepo with three main packages:

### `/server` - Backend (Node.js + Express + Socket.io)
- **Entry point**: `src/index.ts`
- **Core services**:
  - `services/sessionManager.ts` - Manages Claude Code PTY sessions, state detection, and terminal history
  - `services/worktreeService.ts` - Git worktree operations (create, delete, merge, list)
- **WebSocket handlers**: `websocket/index.ts` - Real-time terminal communication
- **REST API**: `api/index.ts` - HTTP endpoints for worktree operations

### `/client` - Frontend (React + TypeScript + Material-UI)
- **Entry point**: `src/main.tsx`
- **Core components**:
  - `components/TerminalView.tsx` - xterm.js terminal emulation
  - `components/CreateWorktreeDialog.tsx` - Worktree creation UI
  - `components/DeleteWorktreeDialog.tsx` - Worktree deletion UI
  - `components/MergeWorktreeDialog.tsx` - Worktree merging UI
- **Main page**: `pages/SessionManager.tsx` - Primary application interface

### `/shared` - Shared TypeScript types
- `types.ts` - Common interfaces used by both client and server

## Key Technical Details

### Session State Detection
The SessionManager detects Claude Code session states by parsing terminal output:
- **busy**: Claude is actively processing (looks for "Esc to interrupt")
- **waiting_input**: Claude is waiting for user input (looks for prompt box patterns)
- **idle**: Claude is ready for new commands

### Communication Architecture
- **WebSocket**: Real-time terminal I/O and session state updates
- **REST API**: Worktree management operations
- **Single-port design**: Both API and web UI served on same port (default 3001)

### Environment Variables
- `PORT`: Server port (default: 3001)
- `WORK_DIR`: Working directory (default: current directory)
- `CC_CLAUDE_ARGS`: Additional arguments passed to Claude Code sessions

## Development Notes

- Uses `pnpm` as package manager with workspace configuration
- Frontend built with Vite for fast development
- Backend uses `tsx` for TypeScript execution in development
- Terminal emulation via `xterm.js` with fit and web-links addons
- PTY management via `node-pty-prebuilt-multiarch`
- Testing with Vitest and React Testing Library

## Prerequisites for Development

- Node.js 18+
- pnpm package manager
- Claude Code CLI must be installed and available in PATH
- Git repository (the tool manages Git worktrees)