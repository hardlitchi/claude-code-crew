import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface SessionRecord {
  id: string;
  persistent_id: string;
  repository_id: string;
  worktree_path: string;
  state: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
  metadata: string;
  is_active: number;
}

export interface SessionHistoryRecord {
  id: number;
  session_id: string;
  output_data: string; // Base64 encoded
  sequence_number: number;
  created_at: string;
}

export interface SessionEnvRecord {
  id: number;
  session_id: string;
  key: string;
  value: string;
}

interface FileStorageData {
  sessions: SessionRecord[];
  history: SessionHistoryRecord[];
  environment: SessionEnvRecord[];
  nextHistoryId: number;
  nextEnvId: number;
}

export class FileSessionDatabase {
  private dataPath: string;
  private data!: FileStorageData;
  private static instance: FileSessionDatabase;

  private constructor(dataFile: string = 'sessions.json') {
    const dataDir = join(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });
    
    this.dataPath = join(dataDir, dataFile);
    this.loadData();
  }

  static getInstance(dataFile: string = 'sessions.json'): FileSessionDatabase {
    if (!FileSessionDatabase.instance) {
      FileSessionDatabase.instance = new FileSessionDatabase(dataFile);
    }
    return FileSessionDatabase.instance;
  }

  private loadData(): void {
    if (existsSync(this.dataPath)) {
      try {
        const fileContent = readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(fileContent);
      } catch (error) {
        console.warn('Failed to load session data, using defaults:', error);
        this.data = this.getDefaultData();
      }
    } else {
      this.data = this.getDefaultData();
    }
  }

  private getDefaultData(): FileStorageData {
    return {
      sessions: [],
      history: [],
      environment: [],
      nextHistoryId: 1,
      nextEnvId: 1,
    };
  }

  private saveData(): void {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  // セッション操作
  createSession(session: Omit<SessionRecord, 'id' | 'created_at' | 'updated_at' | 'last_activity'>): SessionRecord {
    const id = `${session.repository_id}:${session.worktree_path}`;
    const now = new Date().toISOString();
    
    const newSession: SessionRecord = {
      ...session,
      id,
      created_at: now,
      updated_at: now,
      last_activity: now,
    };

    // 既存セッションを削除
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.data.sessions.push(newSession);
    this.saveData();
    
    return newSession;
  }

  getSession(id: string): SessionRecord | null {
    return this.data.sessions.find(s => s.id === id) || null;
  }

  getSessionByPersistentId(persistentId: string): SessionRecord | null {
    return this.data.sessions.find(s => s.persistent_id === persistentId) || null;
  }

  getAllSessions(): SessionRecord[] {
    return [...this.data.sessions].sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  updateSession(id: string, updates: Partial<SessionRecord>): void {
    const sessionIndex = this.data.sessions.findIndex(s => s.id === id);
    if (sessionIndex >= 0) {
      this.data.sessions[sessionIndex] = {
        ...this.data.sessions[sessionIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this.saveData();
    }
  }

  deleteSession(id: string): void {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.data.history = this.data.history.filter(h => h.session_id !== id);
    this.data.environment = this.data.environment.filter(e => e.session_id !== id);
    this.saveData();
  }

  // セッション履歴操作
  addSessionHistory(sessionId: string, outputData: Buffer, sequenceNumber: number): void {
    const newHistory: SessionHistoryRecord = {
      id: this.data.nextHistoryId++,
      session_id: sessionId,
      output_data: outputData.toString('base64'),
      sequence_number: sequenceNumber,
      created_at: new Date().toISOString(),
    };

    this.data.history.push(newHistory);
    this.saveData();
  }

  getSessionHistory(sessionId: string, limit?: number): SessionHistoryRecord[] {
    let history = this.data.history
      .filter(h => h.session_id === sessionId)
      .sort((a, b) => b.sequence_number - a.sequence_number);

    if (limit) {
      history = history.slice(0, limit);
    }

    return history;
  }

  clearOldHistory(sessionId: string, keepCount: number): void {
    const sessionHistory = this.data.history
      .filter(h => h.session_id === sessionId)
      .sort((a, b) => b.sequence_number - a.sequence_number);

    const toKeep = sessionHistory.slice(0, keepCount);
    const keepIds = toKeep.map(h => h.id);

    this.data.history = this.data.history.filter(h => 
      h.session_id !== sessionId || keepIds.includes(h.id)
    );
    this.saveData();
  }

  // 環境変数操作
  setSessionEnv(sessionId: string, key: string, value: string): void {
    // 既存の同じキーを削除
    this.data.environment = this.data.environment.filter(e => 
      !(e.session_id === sessionId && e.key === key)
    );

    // 新しい値を追加
    this.data.environment.push({
      id: this.data.nextEnvId++,
      session_id: sessionId,
      key,
      value,
    });
    
    this.saveData();
  }

  getSessionEnv(sessionId: string): Record<string, string> {
    const envVars = this.data.environment.filter(e => e.session_id === sessionId);
    const result: Record<string, string> = {};
    
    envVars.forEach(env => {
      result[env.key] = env.value;
    });
    
    return result;
  }

  // トランザクション（ファイルベースなので単純な実装）
  transaction<T>(fn: () => T): T {
    return fn();
  }

  close(): void {
    // ファイルベースなので特に何もしない
  }
}