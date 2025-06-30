import { useEffect, useRef, useState } from 'react';
import { NotificationEvent } from '../../../shared/types';

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktopNotifications: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  sound: true,
  desktopNotifications: true,
};

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 通知音を事前に読み込み
    audioRef.current = new Audio('data:audio/wav;base64,UklGRhIFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoFAACCAHsAeQCAAGcAZgBfAGAAYgBhAGEAYgBkAGcAawBsAG0AcgB5AHoAeAB5AHgAeAB4AHgAegB8AH0AfQB+AHsAeQB5AHgAeAB4AHgAeAB9AIEAhACKAJEAlgCXAJsAn');
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('ブラウザが通知をサポートしていません');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }

    return false;
  };

  const showNotification = (event: NotificationEvent) => {
    if (!settings.enabled) return;

    // 音声通知
    if (settings.sound && audioRef.current) {
      audioRef.current.play().catch(err => console.warn('音声再生エラー:', err));
    }

    // デスクトップ通知
    if (settings.desktopNotifications && permission === 'granted') {
      const title = event.toState === 'idle' 
        ? 'Claudeが待機状態になりました' 
        : 'Claudeが入力を待っています';
      
      const body = `ワークツリー: ${event.worktreePath}`;
      
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: event.sessionId,
          requireInteraction: false,
        });
      } catch (err) {
        console.error('通知表示エラー:', err);
      }
    }
  };

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
  };

  return {
    settings,
    permission,
    requestPermission,
    showNotification,
    updateSettings,
  };
}