import React, { useState } from 'react';
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

interface AddRepositoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddRepositoryDialog: React.FC<AddRepositoryDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name || !path) {
      setError('リポジトリ名とパスは必須です');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/repositories', { name, path, description });
      setName('');
      setPath('');
      setDescription('');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'リポジトリの追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setPath('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  const handleSelectDirectory = () => {
    // ブラウザでは直接ディレクトリ選択はできないため、
    // 将来的にElectronやTauriなどを使用する場合はここに実装
    // 現時点では手動入力のみ
    setError('パスを手動で入力してください');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>新規リポジトリを追加</DialogTitle>
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
          onClick={handleAdd}
          variant="contained"
          disabled={loading || !name || !path}
        >
          追加
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRepositoryDialog;