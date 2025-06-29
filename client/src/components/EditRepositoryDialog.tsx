import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import axios from 'axios';
import { Repository } from '../../../shared/types';

interface EditRepositoryDialogProps {
  open: boolean;
  onClose: () => void;
  repository: Repository;
  onSuccess?: () => void;
}

const EditRepositoryDialog: React.FC<EditRepositoryDialogProps> = ({
  open,
  onClose,
  repository,
  onSuccess,
}) => {
  const [name, setName] = useState(repository.name);
  const [path, setPath] = useState(repository.path);
  const [description, setDescription] = useState(repository.description || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ダイアログが開かれたときに値をリセット
    if (open) {
      setName(repository.name);
      setPath(repository.path);
      setDescription(repository.description || '');
      setError(null);
    }
  }, [open, repository]);

  const handleUpdate = async () => {
    if (!name || !path) {
      setError('リポジトリ名とパスは必須です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.put(`/api/repositories/${repository.id}`, { 
        name, 
        path, 
        description 
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'リポジトリの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleSelectDirectory = () => {
    // ブラウザでは直接ディレクトリ選択はできないため、
    // 将来的にElectronやTauriなどを使用する場合はここに実装
    setError('パスを手動で入力してください');
  };

  const hasChanges = () => {
    return (
      name !== repository.name ||
      path !== repository.path ||
      description !== (repository.description || '')
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>リポジトリを編集</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="リポジトリ名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder="my-project"
            helperText="表示用の名前"
            disabled={loading}
            required
          />
          <TextField
            label="リポジトリパス"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            fullWidth
            placeholder="/path/to/repository"
            helperText="Gitリポジトリの絶対パス"
            disabled={loading}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleSelectDirectory}
                    edge="end"
                    disabled={loading}
                  >
                    <FolderOpen />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            placeholder="プロジェクトの説明（任意）"
            multiline
            rows={2}
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          disabled={loading || !name || !path || !hasChanges()}
        >
          更新
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditRepositoryDialog;