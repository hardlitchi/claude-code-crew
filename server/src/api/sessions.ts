import { Router } from 'express';
import { SessionManager } from '../services/sessionManager.js';
import { SessionPersistenceService } from '../services/sessionPersistence.js';

export function createSessionsRouter(sessionManager: SessionManager): Router {
  const router = Router();
  const persistenceService = new SessionPersistenceService();

  // 永続化されたセッション一覧を取得
  router.get('/persisted', async (req, res) => {
    try {
      const sessions = await persistenceService.getAllPersistedSessions();
      res.json({ success: true, sessions });
    } catch (error) {
      console.error('Failed to get persisted sessions:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve persisted sessions' 
      });
    }
  });

  // 永続化IDでセッションを復元
  router.post('/restore/:persistentId', async (req, res) => {
    try {
      const { persistentId } = req.params;
      const session = await sessionManager.restoreSessionFromPersistence(persistentId);
      
      if (session) {
        res.json({ success: true, session });
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Session not found' 
        });
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to restore session' 
      });
    }
  });

  // セッションメタデータを更新
  router.patch('/:sessionId/metadata', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { metadata } = req.body;
      
      await persistenceService.updateSessionMetadata(sessionId, metadata);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update session metadata:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update session metadata' 
      });
    }
  });

  // セッションを削除（永続化データも削除）
  router.delete('/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      await persistenceService.deleteSession(sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete session:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete session' 
      });
    }
  });

  return router;
}