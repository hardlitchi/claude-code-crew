# Claude Code Crew - アーキテクチャ図

## システム全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Crew                             │
│                   (Single Port: 3001)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────────────────┐
        │                  User Browser                         │
        │  ┌─────────────────────────────────────────────────┐  │
        │  │              React Frontend                     │  │
        │  │  • SessionManager.tsx (Main UI)                │  │
        │  │  • TerminalView.tsx (xterm.js)                 │  │
        │  │  • Worktree Dialogs                           │  │
        │  └─────────────────────────────────────────────────┘  │
        └───────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │   WebSocket  │        │   REST API   │
            │ (Real-time)  │        │   (HTTP)     │
            └──────────────┘        └──────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
        ┌───────────────────────────────────────────────────────┐
        │              Node.js Backend Server                  │
        │                                                       │
        │  ┌─────────────────┐    ┌─────────────────────────┐  │
        │  │  SessionManager │    │    WorktreeService      │  │
        │  │                 │    │                         │  │
        │  │ • PTY管理       │    │ • Git操作               │  │
        │  │ • 状態検出      │    │ • Worktree作成/削除     │  │
        │  │ • 履歴管理      │    │ • ブランチマージ        │  │
        │  └─────────────────┘    └─────────────────────────┘  │
        └───────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────────────────┐
        │                   System Layer                        │
        │                                                       │
        │  ┌─────────────────┐    ┌─────────────────────────┐  │
        │  │   Claude Code   │    │      Git Worktrees      │  │
        │  │   Sessions      │    │                         │  │
        │  │                 │    │  ┌─────┐  ┌─────┐      │  │
        │  │  ┌───────────┐  │    │  │ WT1 │  │ WT2 │ ...  │  │
        │  │  │ PTY Process│  │    │  │main │  │feat │      │  │
        │  │  │ (Terminal) │  │    │  └─────┘  └─────┘      │  │
        │  │  └───────────┘  │    │                         │  │
        │  └─────────────────┘    └─────────────────────────┘  │
        └───────────────────────────────────────────────────────┘
```

## ネットワーク通信フロー

```
Browser                    Server                     System
   │                         │                          │
   │──── HTTP GET / ─────────▶│                          │
   │◀─── Static Files ───────│                          │
   │                         │                          │
   │──── WebSocket Connect ──▶│                          │
   │◀─── Connection OK ──────│                          │
   │                         │                          │
   │──── session:create ─────▶│                          │
   │                         │──── spawn claude ──────▶│
   │                         │◀─── PTY created ────────│
   │◀─── session:created ────│                          │
   │                         │                          │
   │──── session:input ──────▶│                          │
   │                         │──── write to PTY ──────▶│
   │                         │◀─── output data ────────│
   │◀─── session:output ─────│                          │
   │                         │                          │
   │──── REST API calls ─────▶│                          │
   │     (worktree ops)      │──── git commands ──────▶│
   │◀─── JSON response ──────│◀─── results ────────────│
```

## データフロー詳細

```
┌─────────────────────────────────────────────────────────────────┐
│                      Session Management                         │
└─────────────────────────────────────────────────────────────────┘

  Terminal Input           State Detection           Output Processing
       │                       │                           │
       ▼                       ▼                           ▼
┌─────────────┐         ┌─────────────┐           ┌─────────────┐
│ User Types  │         │ Parse ANSI  │           │ Buffer      │
│ Commands    │────────▶│ Look for    │──────────▶│ Management  │
│ in Browser  │         │ Patterns    │           │ & History   │
└─────────────┘         └─────────────┘           └─────────────┘
       │                       │                           │
       ▼                       ▼                           ▼
┌─────────────┐         ┌─────────────┐           ┌─────────────┐
│ WebSocket   │         │ Update      │           │ Emit to     │
│ to Server   │         │ Session     │           │ Active      │
│             │         │ State       │           │ Clients     │
└─────────────┘         └─────────────┘           └─────────────┘
       │                       │                           │
       ▼                       ▼                           ▼
┌─────────────┐         ┌─────────────┐           ┌─────────────┐
│ Write to    │         │ • busy      │           │ xterm.js    │
│ PTY Process │         │ • waiting   │           │ Renders     │
│             │         │ • idle      │           │ Output      │
└─────────────┘         └─────────────┘           └─────────────┘
```

## コンポーネント関係図

```
Frontend Components:
┌─────────────────────────────────────────────────────────────────┐
│                      SessionManager                             │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │   Sidebar       │    │          Main Content Area          │ │
│  │                 │    │                                     │ │
│  │ ┌─────────────┐ │    │  ┌─────────────────────────────────┐│ │
│  │ │ Worktree    │ │    │  │        TerminalView            ││ │
│  │ │ List        │ │    │  │                                ││ │
│  │ │             │ │    │  │  ┌─────────────────────────────┐││ │
│  │ │ • main      │ │    │  │  │       xterm.js              │││ │
│  │ │ • feature-1 │ │    │  │  │     Terminal Display       │││ │
│  │ │ • feature-2 │ │    │  │  └─────────────────────────────┘││ │
│  │ │             │ │    │  └─────────────────────────────────┘│ │
│  │ └─────────────┘ │    │                                     │ │
│  │                 │    │  ┌─────────────────────────────────┐│ │
│  │ ┌─────────────┐ │    │  │         Action Buttons         ││ │
│  │ │ Session     │ │    │  │  • Create Worktree             ││ │
│  │ │ Status      │ │    │  │  • Delete Worktree             ││ │
│  │ │ Indicators  │ │    │  │  • Merge Worktree              ││ │
│  │ └─────────────┘ │    │  └─────────────────────────────────┘│ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Backend Services:
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Server                            │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │   HTTP Router   │    │        Socket.io Handler           │ │
│  │                 │    │                                     │ │
│  │ GET /           │    │  session:create                     │ │
│  │ GET /api/*      │    │  session:input                      │ │
│  │ POST /api/*     │    │  session:resize                     │ │
│  │ DELETE /api/*   │    │  session:destroy                    │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│           │                              │                      │
│           └──────────────┬───────────────┘                      │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Service Layer                                │ │
│  │                                                             │ │
│  │  ┌─────────────────┐              ┌─────────────────────┐  │ │
│  │  │ SessionManager  │              │  WorktreeService    │  │ │
│  │  │                 │              │                     │  │ │
│  │  │ • createSession │              │ • getWorktrees      │  │ │
│  │  │ • destroySession│              │ • createWorktree    │  │ │
│  │  │ • writeToSession│              │ • deleteWorktree    │  │ │
│  │  │ • detectState   │              │ • mergeWorktree     │  │ │
│  │  └─────────────────┘              └─────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 状態管理フロー

```
Session State Detection:
┌─────────────────────────────────────────────────────────────────┐
│              PTY Output Analysis                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   Strip ANSI Codes  │
                    │   Clean Text Data   │
                    └─────────────────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────────┐
         │              Pattern Matching                    │
         └──────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    BUSY     │         │   WAITING   │         │    IDLE     │
│             │         │             │         │             │
│ "Esc to     │         │ "Do you     │         │ Ready for   │
│ interrupt"  │         │ want..."    │         │ commands    │
│             │         │ Bottom      │         │             │
│             │         │ border      │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   Emit State Change │
                    │   to WebSocket      │
                    │   Clients           │
                    └─────────────────────┘
```
