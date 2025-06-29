import { spawn, IPty } from 'node-pty-prebuilt-multiarch';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, accessSync, constants } from 'fs';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { Session, SessionState } from '../../../shared/types.js';
import { SessionPersistenceService } from './sessionPersistence.js';
import { v4 as uuidv4 } from 'uuid';

interface InternalSession extends Session {
  process: IPty;
  output: string[];
  outputHistory: Buffer[];
  isActive: boolean;
  restartCount: number;
  lastActivityTime: number;
  connectedClients: Set<string>;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, InternalSession> = new Map();
  private waitingWithBottomBorder: Map<string, boolean> = new Map();
  private busyTimers: Map<string, NodeJS.Timeout> = new Map();
  private persistenceService: SessionPersistenceService;
  private autosaveInterval: NodeJS.Timeout | null = null;
  private maxRestartAttempts: number = 3;
  public clientSessions: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.persistenceService = new SessionPersistenceService();
    this.startAutosave();
    this.restorePersistedSessions();
  }

  private stripAnsi(str: string): string {
    return str
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[PX^_].*?\x1b\\/g, '')
      .replace(/\x1b\[\?[0-9;]*[hl]/g, '')
      .replace(/\x1b[>=]/g, '')
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
      .replace(/\r/g, '')
      .replace(/^[0-9;]+m/gm, '')
      .replace(/[0-9]+;[0-9]+;[0-9;]+m/g, '');
  }

  private includesPromptBoxBottomBorder(str: string): boolean {
    const patterns = [
      /└─+┘/,
      /╰─+╯/,
      /┗━+┛/,
      /╚═+╝/,
    ];
    return patterns.some(pattern => pattern.test(str));
  }

  private detectSessionState(
    cleanData: string,
    currentState: SessionState,
    sessionId: string,
  ): SessionState {
    const hasBottomBorder = this.includesPromptBoxBottomBorder(cleanData);
    const hasWaitingPrompt =
      cleanData.includes('│ Do you want') ||
      cleanData.includes('│ Would you like');
    const wasWaitingWithBottomBorder =
      this.waitingWithBottomBorder.get(sessionId) || false;
    const hasEscToInterrupt = cleanData
      .toLowerCase()
      .includes('esc to interrupt');

    let newState = currentState;

    if (hasWaitingPrompt) {
      newState = 'waiting_input';
      if (hasBottomBorder) {
        this.waitingWithBottomBorder.set(sessionId, true);
      } else {
        this.waitingWithBottomBorder.set(sessionId, false);
      }
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (
      currentState === 'waiting_input' &&
      hasBottomBorder &&
      !hasWaitingPrompt &&
      !wasWaitingWithBottomBorder
    ) {
      newState = 'waiting_input';
      this.waitingWithBottomBorder.set(sessionId, true);
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (hasEscToInterrupt) {
      newState = 'busy';
      this.waitingWithBottomBorder.set(sessionId, false);
      const existingTimer = this.busyTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionId);
      }
    } else if (currentState === 'busy' && !hasEscToInterrupt) {
      if (!this.busyTimers.has(sessionId)) {
        const timer = setTimeout(() => {
          const session = this.sessions.get(sessionId);
          if (session && session.state === 'busy') {
            session.state = 'idle';
            this.emit('sessionStateChanged', session);
          }
          this.busyTimers.delete(sessionId);
        }, 500);
        this.busyTimers.set(sessionId, timer);
      }
      newState = 'busy';
    }

    return newState;
  }

  createSession(worktreePath: string, repositoryId: string): Session {
    const sessionKey = `${repositoryId}:${worktreePath}`;
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      return this.toPublicSession(existing);
    }

    const id = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const claudeArgs = process.env['CC_CLAUDE_ARGS']
      ? process.env['CC_CLAUDE_ARGS'].split(' ')
      : [];

    // Ensure working directory exists
    if (!existsSync(worktreePath)) {
      try {
        // Check if parent directory is writable
        const parentDir = dirname(worktreePath);
        try {
          accessSync(parentDir, constants.W_OK);
        } catch (accessError) {
          console.error(`Parent directory ${parentDir} is not writable:`, accessError);
          throw new Error(`Cannot create working directory: parent directory ${parentDir} is not writable`);
        }
        
        mkdirSync(worktreePath, { recursive: true });
        console.log(`Created directory: ${worktreePath}`);
      } catch (error) {
        console.error(`Failed to create directory ${worktreePath}:`, error);
        throw new Error(`Cannot create working directory: ${worktreePath}`);
      }
    }

    // Configure git safe directory for this specific path
    try {
      execSync(`git config --global --add safe.directory "${worktreePath}"`, { stdio: 'ignore' });
      console.log(`Added safe directory: ${worktreePath}`);
    } catch (error) {
      console.warn(`Failed to add safe directory ${worktreePath}:`, error);
    }

    let ptyProcess: IPty;
    try {
      ptyProcess = spawn('claude', claudeArgs, {
        name: 'xterm-color',
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
        cwd: worktreePath,
        env: process.env as { [key: string]: string },
      });
    } catch (error) {
      console.error(`Failed to spawn Claude CLI:`, error);
      console.error(`Command: claude ${claudeArgs.join(' ')}`);
      console.error(`Working directory: ${worktreePath}`);
      throw new Error(`Failed to start Claude CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const persistentId = uuidv4();
    const session: InternalSession = {
      id,
      persistentId,
      worktreePath,
      repositoryId,
      process: ptyProcess,
      state: 'busy',
      output: [],
      outputHistory: [],
      lastActivity: new Date(),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
      restartCount: 0,
      lastActivityTime: Date.now(),
      connectedClients: new Set(),
    };

    this.setupProcessHandlers(session);
    this.sessions.set(sessionKey, session);
    
    // セッションを永続化
    this.persistenceService.saveSession(
      this.toPublicSession(session),
      session.outputHistory,
      process.env as Record<string, string>
    ).catch(err => console.error('Failed to persist new session:', err));
    
    this.emit('sessionCreated', session);

    return this.toPublicSession(session);
  }

  private setupProcessHandlers(session: InternalSession): void {
    session.process.onData((data: string) => {
      const buffer = Buffer.from(data, 'utf8');
      session.outputHistory.push(buffer);

      const MAX_HISTORY_SIZE = 10 * 1024 * 1024;
      let totalSize = session.outputHistory.reduce(
        (sum, buf) => sum + buf.length,
        0,
      );
      while (totalSize > MAX_HISTORY_SIZE && session.outputHistory.length > 0) {
        const removed = session.outputHistory.shift();
        if (removed) {
          totalSize -= removed.length;
        }
      }

      session.output.push(data);
      if (session.output.length > 100) {
        session.output.shift();
      }

      session.lastActivity = new Date();

      const cleanData = this.stripAnsi(data);

      if (!cleanData.trim()) {
        if (session.isActive) {
          this.emit('sessionData', session, data);
        }
        return;
      }

      const oldState = session.state;
      const newState = this.detectSessionState(
        cleanData,
        oldState,
        `${session.repositoryId}:${session.worktreePath}`,
      );

      if (newState !== oldState) {
        session.state = newState;
        this.emit('sessionStateChanged', session);
        // 状態変更時に永続化
        this.persistenceService.updateSessionState(session.id, newState)
          .catch(err => console.error('Failed to persist state change:', err));
      }

      if (session.isActive) {
        this.emit('sessionData', session, data);
      }
    });

    session.process.onExit(({ exitCode, signal }) => {
      console.log(`Process exited with code ${exitCode}, signal ${signal} for session ${session.worktreePath}`);
      
      // 予期しない終了の場合、復旧を試行
      if (session.restartCount < this.maxRestartAttempts && (exitCode !== 0 || signal)) {
        console.log(`Attempting to restart session ${session.worktreePath}, attempt ${session.restartCount + 1}`);
        this.restartSession(session);
      } else {
        // 復旧失敗またはクライアントが接続していない場合は削除
        if (session.connectedClients.size === 0) {
          console.log(`No clients connected, destroying session ${session.worktreePath}`);
          session.state = 'idle';
          this.emit('sessionStateChanged', session);
          this.destroySession(`${session.repositoryId}:${session.worktreePath}`);
          this.emit('sessionExit', session);
        } else {
          // クライアントが接続している場合は状態を 'disconnected' に変更
          session.state = 'idle';
          this.emit('sessionStateChanged', session);
          this.emit('sessionDisconnected', session);
        }
      }
    });
  }

  getSession(worktreePath: string, repositoryId?: string): InternalSession | undefined {
    if (repositoryId) {
      return this.sessions.get(`${repositoryId}:${worktreePath}`);
    }
    // Backward compatibility: search all sessions
    for (const [key, session] of this.sessions.entries()) {
      if (session.worktreePath === worktreePath) {
        return session;
      }
    }
    return undefined;
  }

  getSessionById(sessionId: string): InternalSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.id === sessionId) {
        return session;
      }
    }
    return undefined;
  }

  setSessionActive(worktreePath: string, active: boolean, repositoryId?: string): void {
    const session = this.getSession(worktreePath, repositoryId);
    if (session) {
      session.isActive = active;

      if (active && session.outputHistory.length > 0) {
        console.log(`Restoring session ${session.id} with ${session.outputHistory.length} history items`);
        this.emit('sessionRestore', session);
      } else if (active) {
        console.log(`Session ${session.id} activated but no history to restore`);
      }
    }
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.process.write(data);
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.process.resize(cols, rows);
    }
  }

  destroySession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      try {
        session.process.kill();
      } catch (_error) {
        // Process might already be dead
      }
      const timer = this.busyTimers.get(sessionKey);
      if (timer) {
        clearTimeout(timer);
        this.busyTimers.delete(sessionKey);
      }
      this.sessions.delete(sessionKey);
      this.waitingWithBottomBorder.delete(session.id);
      // セッションを非アクティブに設定（完全に削除せずに保持）
      this.persistenceService.setSessionActive(session.id, false)
        .catch(err => console.error('Failed to mark session as inactive:', err));
      this.emit('sessionDestroyed', session);
    }
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(session => this.toPublicSession(session));
  }

  private toPublicSession(session: InternalSession): Session {
    return {
      id: session.id,
      persistentId: session.persistentId,
      worktreePath: session.worktreePath,
      repositoryId: session.repositoryId,
      state: session.state,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata,
    };
  }

  destroyAll(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
    }
    for (const sessionKey of this.sessions.keys()) {
      this.destroySession(sessionKey);
    }
  }

  private startAutosave(): void {
    // 30秒ごとにアクティブなセッションを自動保存
    this.autosaveInterval = setInterval(() => {
      this.sessions.forEach((session) => {
        if (session.isActive && session.outputHistory.length > 0) {
          this.persistenceService.saveSession(
            this.toPublicSession(session),
            session.outputHistory
          ).catch(err => console.error('Autosave failed:', err));
        }
      });
    }, 30000);
  }

  private async restorePersistedSessions(): Promise<void> {
    try {
      const persistedSessions = await this.persistenceService.getAllPersistedSessions();
      console.log(`Found ${persistedSessions.length} persisted sessions`);
      
      // 永続化されたセッションの情報をメモリに復元（プロセスは後で必要に応じて再作成）
      for (const persisted of persistedSessions) {
        const sessionKey = `${persisted.repositoryId}:${persisted.worktreePath}`;
        if (!this.sessions.has(sessionKey)) {
          console.log(`Restoring session metadata for ${sessionKey}`);
          // セッションメタデータのみを復元（プロセスは作成しない）
          this.emit('sessionPersistedFound', persisted);
        }
      }
    } catch (error) {
      console.error('Failed to restore persisted sessions:', error);
    }
  }

  async restoreSessionFromPersistence(persistentId: string): Promise<Session | null> {
    try {
      const persisted = await this.persistenceService.loadSessionByPersistentId(persistentId);
      if (!persisted) {
        return null;
      }

      const sessionKey = `${persisted.repositoryId}:${persisted.worktreePath}`;
      const existing = this.sessions.get(sessionKey);
      
      if (existing) {
        // 既存のセッションがある場合は、履歴を復元
        if (persisted.outputHistory && persisted.outputHistory.length > 0) {
          existing.outputHistory = persisted.outputHistory.map(base64 => 
            Buffer.from(base64, 'base64')
          );
          if (existing.isActive) {
            this.emit('sessionRestore', existing);
          }
        }
        return this.toPublicSession(existing);
      } else {
        // 新しいセッションを作成して履歴を復元
        const newSession = this.createSession(persisted.worktreePath, persisted.repositoryId);
        const session = this.sessions.get(sessionKey);
        
        if (session && persisted.outputHistory && persisted.outputHistory.length > 0) {
          session.outputHistory = persisted.outputHistory.map(base64 => 
            Buffer.from(base64, 'base64')
          );
          session.persistentId = persisted.persistentId;
          session.metadata = persisted.metadata;
          
          if (session.isActive) {
            this.emit('sessionRestore', session);
          }
        }
        
        return newSession;
      }
    } catch (error) {
      console.error('Failed to restore session from persistence:', error);
      return null;
    }
  }
  
  // セッション復旧機能
  private async restartSession(session: InternalSession): Promise<void> {
    try {
      session.restartCount++;
      console.log(`Restarting session ${session.worktreePath}, attempt ${session.restartCount}`);
      
      // 既存のプロセスをクリーンアップ
      const sessionKey = `${session.repositoryId}:${session.worktreePath}`;
      const existingTimer = this.busyTimers.get(sessionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.busyTimers.delete(sessionKey);
      }
      
      // 新しいプロセスを起動
      const claudeArgs = this.buildClaudeArgs(session.worktreePath);
      const newProcess = spawn('claude', claudeArgs, {
        name: 'xterm-color',
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
        cwd: session.worktreePath,
        env: process.env as { [key: string]: string },
      });
      
      // プロセスを更新
      session.process = newProcess;
      session.state = 'idle';
      session.lastActivityTime = Date.now();
      
      // イベントリスナーを再設定
      this.setupProcessHandlers(session);
      
      // クライアントに復旧を通知
      this.emit('sessionRestarted', session);
      this.emit('sessionStateChanged', session);
      
      console.log(`Session ${session.worktreePath} restarted successfully`);
    } catch (error) {
      console.error(`Failed to restart session ${session.worktreePath}:`, error);
      // 復旧失敗時はセッションを終了
      this.destroySession(`${session.repositoryId}:${session.worktreePath}`);
    }
  }
  
  // クライアント接続管理
  addClientToSession(sessionKey: string, clientId: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.connectedClients.add(clientId);
      session.lastActivityTime = Date.now();
      console.log(`Client ${clientId} connected to session ${sessionKey}`);
    }
  }
  
  removeClientFromSession(sessionKey: string, clientId: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.connectedClients.delete(clientId);
      console.log(`Client ${clientId} disconnected from session ${sessionKey}`);
      
      // クライアントがいなくなった場合、非アクティブ化
      if (session.connectedClients.size === 0) {
        session.isActive = false;
        console.log(`Session ${sessionKey} set to inactive - no clients connected`);
      }
    }
  }
  
  // Claudeコマンド引数を構築
  private buildClaudeArgs(worktreePath: string): string[] {
    const claudeArgs = [worktreePath];
    
    // 環境変数から追加引数を取得
    const extraArgs = process.env.CC_CLAUDE_ARGS;
    if (extraArgs) {
      claudeArgs.push(...extraArgs.split(' '));
    }
    
    return claudeArgs;
  }

  destroy(): void {
    this.sessions.forEach((session) => {
      try {
        session.process.kill();
      } catch (error) {
        console.warn('Failed to kill session process:', error);
      }
    });

    this.sessions.clear();
    this.waitingWithBottomBorder.clear();
    this.busyTimers.forEach(timer => clearTimeout(timer));
    this.busyTimers.clear();
    this.clientSessions.clear();

    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }
}