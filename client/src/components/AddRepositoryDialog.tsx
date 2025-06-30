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
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Typography,
} from '@mui/material';
import { FolderOpen, GitHub, Link } from '@mui/icons-material';
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
  const [mode, setMode] = useState<'local' | 'url'>('local');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);

  const handleAdd = async () => {
    if (mode === 'local') {
      if (!name || !path) {
        setError('リポジトリ名とパスは必須です');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await axios.post('/api/repositories', { name, path, description });
        resetForm();
        onClose();
        onSuccess?.();
      } catch (err: any) {
        setError(err.response?.data?.error || 'リポジトリの追加に失敗しました');
      } finally {
        setLoading(false);
      }
    } else {
      if (!url) {
        setError('リポジトリURLは必須です');
        return;
      }

      setLoading(true);
      setCloning(true);
      setError(null);

      try {
        const response = await axios.post('/api/repositories/clone', { url, name, description });
        console.log('Clone response:', response.data);
        resetForm();
        onClose();
        onSuccess?.();
      } catch (err: any) {
        setError(err.response?.data?.error || 'リポジトリのクローンに失敗しました');
      } finally {
        setLoading(false);
        setCloning(false);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setPath('');
    setUrl('');
    setDescription('');
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'local' | 'url' | null) => {
    if (newMode !== null) {
      setMode(newMode);
      setError(null);
    }
  };

  const validateUrl = (url: string): boolean => {
    const githubPattern = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(\.git)?$/;
    const gitlabPattern = /^https?:\/\/gitlab\.com\/([\w.-]+)\/([\w.-]+)(\.git)?$/;
    const sshGithubPattern = /^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/;
    const sshGitlabPattern = /^git@gitlab\.com:([\w.-]+)\/([\w.-]+)\.git$/;
    
    return githubPattern.test(url) || gitlabPattern.test(url) || 
           sshGithubPattern.test(url) || sshGitlabPattern.test(url);
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
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            fullWidth
            disabled={loading}
          >
            <ToggleButton value="local">
              <FolderOpen sx={{ mr: 1 }} />
              ローカルリポジトリ
            </ToggleButton>
            <ToggleButton value="url">
              <Link sx={{ mr: 1 }} />
              URLからクローン
            </ToggleButton>
          </ToggleButtonGroup>

          {error && <Alert severity="error">{error}</Alert>}

          {cloning && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                リポジトリをクローンしています...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {mode === 'local' ? (
            <>
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
            </>
          ) : (
            <>
              <TextField
                label="リポジトリURL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                placeholder="https://github.com/username/repository.git"
                helperText="GitHub/GitLabのリポジトリURL"
                disabled={loading}
                required
                error={!!url && !validateUrl(url)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <GitHub />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="リポジトリ名（任意）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                placeholder="my-project"
                helperText="空欄の場合はURLから自動生成されます"
                disabled={loading}
              />
            </>
          )}

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
          disabled={
            loading ||
            (mode === 'local' && (!name || !path)) ||
            (mode === 'url' && !url)
          }
        >
          {mode === 'local' ? '追加' : 'クローン'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRepositoryDialog;