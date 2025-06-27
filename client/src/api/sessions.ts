import { SessionPersistenceData, Session } from '../../../shared/types';

const API_BASE = '/api/sessions';

export const sessionsApi = {
  // 永続化されたセッション一覧を取得
  async getPersistedSessions(): Promise<SessionPersistenceData[]> {
    const response = await fetch(`${API_BASE}/persisted`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get persisted sessions');
    }
    
    return data.sessions;
  },

  // セッションを復元
  async restoreSession(persistentId: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/restore/${persistentId}`, {
      method: 'POST',
    });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to restore session');
    }
    
    return data.session;
  },

  // セッションメタデータを更新
  async updateSessionMetadata(sessionId: string, metadata: Record<string, any>): Promise<void> {
    const response = await fetch(`${API_BASE}/${sessionId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update session metadata');
    }
  },

  // セッションを削除
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${sessionId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete session');
    }
  },
};