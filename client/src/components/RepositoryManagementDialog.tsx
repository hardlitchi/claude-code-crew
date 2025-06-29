import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  Folder,
  Close,
} from '@mui/icons-material';
import axios from 'axios';
import { Repository } from '../../../shared/types';
import AddRepositoryDialog from './AddRepositoryDialog';
import EditRepositoryDialog from './EditRepositoryDialog';

interface RepositoryManagementDialogProps {
  open: boolean;
  onClose: () => void;
  repositories: Repository[];
  selectedRepository: Repository | null;
  onRepositorySelect?: (repository: Repository) => void;
}

const RepositoryManagementDialog: React.FC<RepositoryManagementDialogProps> = ({
  open,
  onClose,
  repositories,
  selectedRepository,
  onRepositorySelect,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [repositoryToDelete, setRepositoryToDelete] = useState<Repository | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [repositoryToEdit, setRepositoryToEdit] = useState<Repository | null>(null);

  const handleDelete = async () => {
    if (!repositoryToDelete) return;

    setLoading(true);
    setError(null);

    try {
      await axios.delete(`/api/repositories/${repositoryToDelete.id}`);
      setDeleteConfirmOpen(false);
      setRepositoryToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'リポジトリの削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (repository: Repository) => {
    setRepositoryToEdit(repository);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (repository: Repository) => {
    setRepositoryToDelete(repository);
    setDeleteConfirmOpen(true);
  };

  const isDefaultRepository = (repo: Repository) => repo.id === 'default';

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">リポジトリ管理</Typography>
            <IconButton edge="end" onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setAddDialogOpen(true)}
              fullWidth
            >
              新規リポジトリを追加
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {repositories.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="text.secondary">
                リポジトリがありません
              </Typography>
            </Box>
          ) : (
            <List>
              {repositories.map((repo, index) => (
                <React.Fragment key={repo.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    button
                    selected={selectedRepository?.id === repo.id}
                    onClick={() => onRepositorySelect?.(repo)}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Folder fontSize="small" />
                          <Typography variant="subtitle1">
                            {repo.name}
                            {isDefaultRepository(repo) && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 1, color: 'text.secondary' }}
                              >
                                (デフォルト)
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {repo.path}
                          </Typography>
                          {repo.description && (
                            <Typography variant="body2" color="text.secondary">
                              {repo.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {repo.worktrees?.length || 0} ワークツリー
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="編集">
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(repo);
                          }}
                          disabled={isDefaultRepository(repo)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="削除">
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(repo);
                          }}
                          disabled={isDefaultRepository(repo) || repositories.length === 1}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>リポジトリを削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{repositoryToDelete?.name}」を削除してもよろしいですか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。関連するワークツリーセッションは終了されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={16} />}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* リポジトリ追加ダイアログ */}
      <AddRepositoryDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => setAddDialogOpen(false)}
      />

      {/* リポジトリ編集ダイアログ */}
      {repositoryToEdit && (
        <EditRepositoryDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setRepositoryToEdit(null);
          }}
          repository={repositoryToEdit}
          onSuccess={() => {
            setEditDialogOpen(false);
            setRepositoryToEdit(null);
          }}
        />
      )}
    </>
  );
};

export default RepositoryManagementDialog;