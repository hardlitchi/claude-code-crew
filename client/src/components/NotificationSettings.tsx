import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';

interface NotificationSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: {
    enabled: boolean;
    sound: boolean;
    desktopNotifications: boolean;
  };
  permission: NotificationPermission;
  onSettingsChange: (settings: any) => void;
  onRequestPermission: () => Promise<boolean>;
}

export function NotificationSettings({
  open,
  onClose,
  settings,
  permission,
  onSettingsChange,
  onRequestPermission,
}: NotificationSettingsProps) {
  const handlePermissionRequest = async () => {
    await onRequestPermission();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <NotificationsIcon />
          <Typography variant="h6">通知設定</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {permission === 'denied' && (
            <Alert severity="warning">
              ブラウザの通知が拒否されています。ブラウザの設定から許可してください。
            </Alert>
          )}
          
          {permission === 'default' && (
            <Alert 
              severity="info" 
              action={
                <Button color="inherit" size="small" onClick={handlePermissionRequest}>
                  許可
                </Button>
              }
            >
              デスクトップ通知を使用するには許可が必要です。
            </Alert>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => onSettingsChange({ enabled: e.target.checked })}
              />
            }
            label="通知を有効にする"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.sound}
                onChange={(e) => onSettingsChange({ sound: e.target.checked })}
                disabled={!settings.enabled}
              />
            }
            label="音声通知"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.desktopNotifications}
                onChange={(e) => onSettingsChange({ desktopNotifications: e.target.checked })}
                disabled={!settings.enabled || permission !== 'granted'}
              />
            }
            label="デスクトップ通知"
          />

          <Typography variant="body2" color="text.secondary">
            Claudeセッションが「待機中」または「入力待ち」になったときに通知します。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}