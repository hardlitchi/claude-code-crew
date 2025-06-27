import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdirSync } from 'fs';

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
  output_data: Buffer;
  sequence_number: number;
  created_at: string;
}

export interface SessionEnvRecord {
  id: number;
  session_id: string;
  key: string;
  value: string;
}

export class SessionDatabase {
  private db: Database.Database;
  private static instance: SessionDatabase;

  private constructor(dbPath: string) {
    // データベースディレクトリの作成
    const dbDir = join(process.cwd(), 'data');
    mkdirSync(dbDir, { recursive: true });

    const fullPath = join(dbDir, dbPath);
    this.db = new Database(fullPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
  }

  static getInstance(dbPath: string = 'sessions.db'): SessionDatabase {
    if (!SessionDatabase.instance) {
      SessionDatabase.instance = new SessionDatabase(dbPath);
    }
    return SessionDatabase.instance;
  }

  private initializeSchema(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  // セッション操作
  createSession(session: Omit<SessionRecord, 'id' | 'created_at' | 'updated_at' | 'last_activity'>): SessionRecord {
    const id = `${session.repository_id}:${session.worktree_path}`;
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, persistent_id, repository_id, worktree_path, state, metadata, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, session.persistent_id, session.repository_id, session.worktree_path, 
             session.state, session.metadata, session.is_active);
    
    return this.getSession(id)!;
  }

  getSession(id: string): SessionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as SessionRecord | undefined || null;
  }

  getSessionByPersistentId(persistentId: string): SessionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE persistent_id = ?');
    return stmt.get(persistentId) as SessionRecord | undefined || null;
  }

  getAllSessions(): SessionRecord[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all() as SessionRecord[];
  }

  updateSession(id: string, updates: Partial<SessionRecord>): void {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`);
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const values = Object.values(updates).filter((_, index) => 
      Object.keys(updates)[index] !== 'id'
    );
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
  }

  deleteSession(id: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }

  // セッション履歴操作
  addSessionHistory(sessionId: string, outputData: Buffer, sequenceNumber: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO session_history (session_id, output_data, sequence_number)
      VALUES (?, ?, ?)
    `);
    stmt.run(sessionId, outputData, sequenceNumber);
  }

  getSessionHistory(sessionId: string, limit?: number): SessionHistoryRecord[] {
    const query = limit 
      ? 'SELECT * FROM session_history WHERE session_id = ? ORDER BY sequence_number DESC LIMIT ?'
      : 'SELECT * FROM session_history WHERE session_id = ? ORDER BY sequence_number DESC';
    
    const stmt = this.db.prepare(query);
    const results = limit ? stmt.all(sessionId, limit) : stmt.all(sessionId);
    return results as SessionHistoryRecord[];
  }

  clearOldHistory(sessionId: string, keepCount: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM session_history 
      WHERE session_id = ? AND id NOT IN (
        SELECT id FROM session_history 
        WHERE session_id = ? 
        ORDER BY sequence_number DESC 
        LIMIT ?
      )
    `);
    stmt.run(sessionId, sessionId, keepCount);
  }

  // 環境変数操作
  setSessionEnv(sessionId: string, key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_env (session_id, key, value)
      VALUES (?, ?, ?)
    `);
    stmt.run(sessionId, key, value);
  }

  getSessionEnv(sessionId: string): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM session_env WHERE session_id = ?');
    const rows = stmt.all(sessionId) as Array<{ key: string; value: string }>;
    
    const env: Record<string, string> = {};
    rows.forEach(row => {
      env[row.key] = row.value;
    });
    return env;
  }

  // トランザクション
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}