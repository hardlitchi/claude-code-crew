import { v4 as uuidv4 } from 'uuid';
import { FileSessionDatabase as SessionDatabase, SessionRecord } from '../database/fileStorage.js';
import { Session, SessionPersistenceData } from '../../../shared/types';

export class SessionPersistenceService {
  private db: SessionDatabase;
  private sequenceNumbers: Map<string, number> = new Map();

  constructor() {
    this.db = SessionDatabase.getInstance();
  }

  /**
   * セッションを永続化ストレージに保存
   */
  async saveSession(
    session: Session,
    outputHistory?: Buffer[],
    environment?: Record<string, string>
  ): Promise<void> {
    const persistentId = session.persistentId || uuidv4();
    const sessionId = session.id;

    await this.db.transaction(() => {
      // セッションメタデータの保存
      const existingSession = this.db.getSession(sessionId);
      
      if (existingSession) {
        // 既存セッションの更新
        this.db.updateSession(sessionId, {
          state: session.state,
          last_activity: session.lastActivity.toISOString(),
          metadata: JSON.stringify(session.metadata || {}),
        });
      } else {
        // 新規セッションの作成
        this.db.createSession({
          persistent_id: persistentId,
          repository_id: session.repositoryId,
          worktree_path: session.worktreePath,
          state: session.state,
          metadata: JSON.stringify(session.metadata || {}),
          is_active: 1,
        });
      }

      // 出力履歴の保存
      if (outputHistory && outputHistory.length > 0) {
        const currentSeq = this.sequenceNumbers.get(sessionId) || 0;
        
        outputHistory.forEach((buffer, index) => {
          const sequenceNumber = currentSeq + index + 1;
          this.db.addSessionHistory(sessionId, buffer, sequenceNumber);
        });

        this.sequenceNumbers.set(sessionId, currentSeq + outputHistory.length);
        
        // 古い履歴の削除（最新100件のみ保持）
        this.db.clearOldHistory(sessionId, 100);
      }

      // 環境変数の保存
      if (environment) {
        Object.entries(environment).forEach(([key, value]) => {
          this.db.setSessionEnv(sessionId, key, value);
        });
      }
    });
  }

  /**
   * 永続化されたセッションを取得
   */
  async loadSession(sessionId: string): Promise<SessionPersistenceData | null> {
    const sessionRecord = this.db.getSession(sessionId);
    if (!sessionRecord) {
      return null;
    }

    // 出力履歴の取得
    const historyRecords = this.db.getSessionHistory(sessionId, 100);
    const outputHistory = historyRecords
      .reverse()
      .map(record => record.output_data);

    // 環境変数の取得
    const environment = this.db.getSessionEnv(sessionId);

    return {
      persistentId: sessionRecord.persistent_id,
      repositoryId: sessionRecord.repository_id,
      worktreePath: sessionRecord.worktree_path,
      state: sessionRecord.state,
      metadata: JSON.parse(sessionRecord.metadata),
      outputHistory,
      environment,
    };
  }

  /**
   * 永続化IDでセッションを取得
   */
  async loadSessionByPersistentId(persistentId: string): Promise<SessionPersistenceData | null> {
    const sessionRecord = this.db.getSessionByPersistentId(persistentId);
    if (!sessionRecord) {
      return null;
    }

    return this.loadSession(sessionRecord.id);
  }

  /**
   * すべての永続化されたセッションを取得
   */
  async getAllPersistedSessions(): Promise<SessionPersistenceData[]> {
    const sessions = this.db.getAllSessions();
    const results: SessionPersistenceData[] = [];

    for (const session of sessions) {
      const data = await this.loadSession(session.id);
      if (data) {
        results.push(data);
      }
    }

    return results;
  }

  /**
   * セッションを削除
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.db.deleteSession(sessionId);
    this.sequenceNumbers.delete(sessionId);
  }

  /**
   * セッションの状態を更新
   */
  async updateSessionState(sessionId: string, state: Session['state']): Promise<void> {
    this.db.updateSession(sessionId, { state });
  }

  /**
   * セッションメタデータを更新
   */
  async updateSessionMetadata(sessionId: string, metadata: Record<string, any>): Promise<void> {
    this.db.updateSession(sessionId, { metadata: JSON.stringify(metadata) });
  }

  /**
   * セッションをアクティブ/非アクティブに設定
   */
  async setSessionActive(sessionId: string, isActive: boolean): Promise<void> {
    this.db.updateSession(sessionId, { is_active: isActive ? 1 : 0 });
  }
}