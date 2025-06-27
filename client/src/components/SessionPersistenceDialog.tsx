import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { SessionPersistenceData } from '../../../shared/types';
import { sessionsApi } from '../api/sessions';

interface SessionPersistenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSessionRestored: () => void;
}

export const SessionPersistenceDialog: React.FC<SessionPersistenceDialogProps> = ({
  open,
  onClose,
  onSessionRestored,
}) => {
  const [sessions, setSessions] = useState<SessionPersistenceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadPersistedSessions();
    }
  }, [open]);

  const loadPersistedSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sessionsApi.getPersistedSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '永続化されたセッションの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (persistentId: string) => {
    setRestoringId(persistentId);
    try {
      await sessionsApi.restoreSession(persistentId);
      onSessionRestored();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッションの復元に失敗しました');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('このセッションを完全に削除しますか？')) {
      return;
    }

    try {
      await sessionsApi.deleteSession(sessionId);
      await loadPersistedSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッションの削除に失敗しました');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'idle':
        return 'default';
      case 'busy':
        return 'warning';
      case 'waiting_input':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'idle':
        return 'アイドル';
      case 'busy':
        return '処理中';
      case 'waiting_input':
        return '入力待機';
      default:
        return state;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <StorageIcon />
          <Typography variant="h6">永続化されたセッション</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography color="text.secondary" align="center" py={4}>
            永続化されたセッションがありません
          </Typography>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem
                key={session.persistentId}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">
                        {session.worktreePath}
                      </Typography>
                      <Chip
                        size="small"
                        label={getStateLabel(session.state)}
                        color={getStateColor(session.state) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        リポジトリ: {session.repositoryId}
                      </Typography>
                      {session.metadata?.lastCommand && (
                        <Typography variant="body2" color="text.secondary">
                          最後のコマンド: {session.metadata.lastCommand}
                        </Typography>
                      )}
                      <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(session.metadata?.updatedAt || '')}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="セッションを復元">
                    <IconButton
                      edge="end"
                      color="primary"
                      onClick={() => handleRestore(session.persistentId)}
                      disabled={restoringId === session.persistentId}
                      sx={{ mr: 1 }}
                    >
                      {restoringId === session.persistentId ? (
                        <CircularProgress size={24} />
                      ) : (
                        <RestoreIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="セッションを削除">
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleDelete(session.persistentId)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};