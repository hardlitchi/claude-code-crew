import { Server, Socket } from 'socket.io';
import { SessionManager, NotificationEvent } from '../services/sessionManager.js';
import { WorktreeService } from '../services/worktreeService.js';
import { RepositoryService } from '../services/repositoryService.js';
import { Session, Worktree } from '../../../shared/types.js';

export async function setupWebSocket(io: Server, sessionManager: SessionManager) {
  const repositoryService = new RepositoryService();
  await repositoryService.initialize();
  const worktreeService = new WorktreeService(repositoryService);

  // Update worktrees with session info
  const getWorktreesWithSessions = (repositoryId?: string): Worktree[] => {
    if (repositoryId) {
      const worktrees = worktreeService.getWorktrees(repositoryId);
      const sessions = sessionManager.getAllSessions();
      
      return worktrees.map(worktree => {
        const session = sessions.find(s => 
          s.worktreePath === worktree.path && 
          s.repositoryId === worktree.repositoryId
        );
        return {
          ...worktree,
          session: session || undefined,
        };
      });
    }
    
    // Get all worktrees from all repositories
    const allWorktrees: Worktree[] = [];
    const repositories = repositoryService.getAllRepositories();
    
    for (const repo of repositories) {
      const worktrees = worktreeService.getWorktrees(repo.id);
      allWorktrees.push(...worktrees);
    }
    
    const sessions = sessionManager.getAllSessions();
    console.log(`[WebSocket] Getting worktrees with sessions: ${allWorktrees.length} worktrees, ${sessions.length} sessions`);
    
    return allWorktrees.map(worktree => {
      const session = sessions.find(s => 
        s.worktreePath === worktree.path && 
        s.repositoryId === worktree.repositoryId
      );
      return {
        ...worktree,
        session: session || undefined,
      };
    });
  };

  // Session manager event handlers
  sessionManager.on('sessionCreated', (session: Session) => {
    io.emit('session:created', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionData', (session: Session, data: string) => {
    io.emit('session:output', { sessionId: session.id, data });
  });

  sessionManager.on('sessionStateChanged', (session: Session) => {
    io.emit('session:stateChanged', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionDestroyed', (session: Session) => {
    io.emit('session:destroyed', session.id);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  sessionManager.on('sessionRestore', (session: any) => {
    if (session.outputHistory && session.outputHistory.length > 0) {
      const history = session.outputHistory
        .map((buf: Buffer) => buf.toString('utf8'))
        .join('');
      console.log(`Sending restore data for session ${session.id}, history length: ${history.length} characters`);
      io.emit('session:restore', { sessionId: session.id, history });
    } else {
      console.log(`No history available for session ${session.id}`);
    }
  });

  // セッション復旧イベント
  sessionManager.on('sessionRestarted', (session: Session) => {
    console.log(`Session restarted: ${session.id}`);
    io.emit('session:restarted', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  // セッション切断イベント
  sessionManager.on('sessionDisconnected', (session: Session) => {
    console.log(`Session disconnected: ${session.id}`);
    io.emit('session:disconnected', session);
    io.emit('worktrees:updated', getWorktreesWithSessions());
  });

  // 通知イベント
  sessionManager.on('notification', (event: NotificationEvent) => {
    console.log(`Notification event: ${event.sessionId} ${event.fromState} -> ${event.toState}`);
    io.emit('notification:show', event);
  });

  // Socket connection handler
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    socket.emit('worktrees:updated', getWorktreesWithSessions());
    socket.emit('repositories:updated', repositoryService.getAllRepositories());

    // Handle session creation
    socket.on('session:create', ({ worktreePath, repositoryId }: { worktreePath: string; repositoryId?: string }) => {
      try {
        const repoId = repositoryId || repositoryService.getDefaultRepositoryId();
        if (!repoId) {
          throw new Error('No repository specified and no default repository available');
        }
        const session = sessionManager.createSession(worktreePath, repoId);
        sessionManager.setSessionActive(worktreePath, true, repoId);
        
        // クライアントをセッションに登録
        const sessionKey = `${repoId}:${worktreePath}`;
        sessionManager.addClientToSession(sessionKey, socket.id);
        
        // クライアントのセッション管理
        if (!sessionManager.clientSessions?.has(socket.id)) {
          sessionManager.clientSessions?.set(socket.id, new Set());
        }
        sessionManager.clientSessions?.get(socket.id)?.add(sessionKey);
      } catch (error) {
        console.error('Failed to create session:', error);
        socket.emit('error', { 
          message: error instanceof Error ? error.message : 'Failed to create session' 
        });
      }
    });

    // Handle session input
    socket.on('session:input', ({ sessionId, input }) => {
      try {
        sessionManager.writeToSession(sessionId, input);
      } catch (error) {
        console.error('Failed to write to session:', error);
      }
    });

    // Handle session resize
    socket.on('session:resize', ({ sessionId, cols, rows }) => {
      try {
        sessionManager.resizeSession(sessionId, cols, rows);
      } catch (error) {
        console.error('Failed to resize session:', error);
      }
    });

    // Handle client-requested session restore
    socket.on('session:restore', (sessionId: string) => {
      try {
        const session = sessionManager.getSessionById(sessionId);
        if (session && session.outputHistory && session.outputHistory.length > 0) {
          const history = session.outputHistory
            .map((buf: Buffer) => buf.toString('utf8'))
            .join('');
          console.log(`Restoring session ${sessionId} with ${history.length} characters of history`);
          socket.emit('session:restore', { sessionId: session.id, history });
        } else {
          console.log(`No history available for session ${sessionId}`);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    });

    // Handle session activation (switching between existing sessions)
    socket.on('session:setActive', ({ worktreePath, repositoryId }: { worktreePath: string; repositoryId?: string }) => {
      try {
        const sessions = sessionManager.getAllSessions();
        
        // Deactivate all sessions first
        sessions.forEach(session => {
          sessionManager.setSessionActive(session.worktreePath, false, session.repositoryId);
        });
        
        // Activate the selected session (this will automatically emit sessionRestore)
        console.log(`Setting session active for worktree: ${worktreePath}, repository: ${repositoryId}`);
        sessionManager.setSessionActive(worktreePath, true, repositoryId);
      } catch (error) {
        console.error('Failed to set session active:', error);
        socket.emit('error', { 
          message: error instanceof Error ? error.message : 'Failed to activate session' 
        });
      }
    });

    // Handle session destruction
    socket.on('session:destroy', (sessionId: string) => {
      try {
        const sessions = sessionManager.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          sessionManager.destroySession(`${session.repositoryId}:${session.worktreePath}`);
        }
      } catch (error) {
        console.error('Failed to destroy session:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // クライアントが接続していたセッションから削除
      const clientSessions = sessionManager.clientSessions?.get(socket.id);
      if (clientSessions) {
        clientSessions.forEach(sessionKey => {
          sessionManager.removeClientFromSession(sessionKey, socket.id);
        });
        sessionManager.clientSessions?.delete(socket.id);
      }
    });
  });

  // Cleanup on server shutdown
  process.on('SIGINT', () => {
    sessionManager.destroyAll();
    process.exit();
  });

  process.on('SIGTERM', () => {
    sessionManager.destroyAll();
    process.exit();
  });
}