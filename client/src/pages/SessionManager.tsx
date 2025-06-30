import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  IconButton,
} from '@mui/material';
import {
  FolderOpen,
  Add,
  Delete,
  Merge,
  Terminal,
  Circle,
  Menu as MenuIcon,
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { Worktree, Session, Repository, NotificationEvent } from '../../../shared/types';
import TerminalView from '../components/TerminalView';
import CreateWorktreeDialog from '../components/CreateWorktreeDialog';
import DeleteWorktreeDialog from '../components/DeleteWorktreeDialog';
import MergeWorktreeDialog from '../components/MergeWorktreeDialog';
import { SessionPersistenceDialog } from '../components/SessionPersistenceDialog';
import MobileBottomNavigation from '../components/MobileBottomNavigation';
import MobileDrawer from '../components/MobileDrawer';
import useBreakpoint from '../hooks/useBreakpoint';
import AddRepositoryDialog from '../components/AddRepositoryDialog';
import RepositoryManagementDialog from '../components/RepositoryManagementDialog';
import { NotificationSettings } from '../components/NotificationSettings';
import { useNotifications } from '../hooks/useNotifications';

const drawerWidth = 300;

const SessionManager: React.FC = () => {
  const { isMobile, isMobileOrTablet } = useBreakpoint();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedWorktree, setSelectedWorktree] = useState<Worktree | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [persistenceDialogOpen, setPersistenceDialogOpen] = useState(false);
  const [addRepositoryDialogOpen, setAddRepositoryDialogOpen] = useState(false);
  const [repositoryManagementDialogOpen, setRepositoryManagementDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileNavValue, setMobileNavValue] = useState(0);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const notifications = useNotifications();

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    // Load initial repositories
    fetch('/api/repositories')
      .then(res => res.json())
      .then((data: Repository[]) => {
        setRepositories(data);
        // Auto-select first repository if none selected
        if (!selectedRepository && data.length > 0) {
          setSelectedRepository(data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch repositories:', err));


    newSocket.on('repositories:updated', (updatedRepositories: Repository[]) => {
      console.log('[Client] Received repositories:updated event with', updatedRepositories.length, 'repositories');
      setRepositories([...updatedRepositories]);
      // Auto-select first repository if none selected
      if (!selectedRepository && updatedRepositories.length > 0) {
        setSelectedRepository(updatedRepositories[0]);
      }
    });

    newSocket.on('session:created', (session: Session) => {
      setActiveSession(session);
    });

    newSocket.on('session:stateChanged', (session: Session) => {
      setActiveSession(prevSession => {
        if (prevSession && session.id === prevSession.id) {
          return session;
        }
        return prevSession;
      });
    });

    newSocket.on('session:destroyed', (sessionId: string) => {
      setActiveSession(prevSession => {
        if (prevSession && sessionId === prevSession.id) {
          return null;
        }
        return prevSession;
      });
    });

    newSocket.on('notification:show', (event: NotificationEvent) => {
      notifications.showNotification(event);
    });

    return () => {
      newSocket.close();
    };
  }, []); // Empty dependency array - only run once

  // Separate effect to handle worktrees:updated events with current selectedRepository
  useEffect(() => {
    if (!socket) return;

    const handleWorktreesUpdated = (updatedWorktrees: Worktree[]) => {
      console.log('[Client] Received worktrees:updated event with', updatedWorktrees.length, 'worktrees');
      // Filter worktrees for current repository and update directly
      if (selectedRepository) {
        const filteredWorktrees = updatedWorktrees.filter(w => w.repositoryId === selectedRepository.id);
        setWorktrees(filteredWorktrees);
      }
    };

    socket.on('worktrees:updated', handleWorktreesUpdated);

    return () => {
      socket.off('worktrees:updated', handleWorktreesUpdated);
    };
  }, [socket, selectedRepository]);

  // Function to fetch worktrees for current repository
  const fetchWorktrees = React.useCallback(() => {
    if (selectedRepository && socket) {
      console.log('[Client] Fetching worktrees for repository:', selectedRepository.name, selectedRepository.id);
      const url = `/api/worktrees?repositoryId=${selectedRepository.id}`;
      console.log('[Client] Fetching worktrees from:', url);
      fetch(url)
        .then(res => {
          console.log('[Client] Worktree fetch response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('[Client] Worktree fetch success, received:', data);
          setWorktrees(data);
        })
        .catch(err => {
          console.error('[Client] Failed to fetch worktrees:', err);
          setWorktrees([]); // Reset worktrees on error
        });
    } else {
      console.log('[Client] No repository selected or no socket, clearing worktrees');
      setWorktrees([]);
    }
  }, [selectedRepository, socket]);

  // Effect to filter worktrees when repository changes
  useEffect(() => {
    fetchWorktrees();
  }, [fetchWorktrees]);


  // Separate effect to update worktree when worktrees change
  useEffect(() => {
    if (selectedWorktree && worktrees.length > 0) {
      const updated = worktrees.find(w => 
        w.path === selectedWorktree.path && 
        w.repositoryId === selectedWorktree.repositoryId
      );
      if (updated) {
        setSelectedWorktree(updated);
        if (updated.session) {
          setActiveSession(updated.session);
        }
      }
    }
  }, [worktrees, selectedWorktree]);

  const handleRepositoryChange = (event: SelectChangeEvent<string>) => {
    const repositoryId = event.target.value;
    if (repositoryId === 'add-new') {
      setAddRepositoryDialogOpen(true);
      return;
    }
    if (repositoryId === 'manage') {
      setRepositoryManagementDialogOpen(true);
      return;
    }
    const repository = repositories.find(r => r.id === repositoryId);
    if (repository) {
      setSelectedRepository(repository);
      setSelectedWorktree(null);
      setActiveSession(null);
    }
  };

  const handleSelectWorktree = (worktree: Worktree) => {
    setSelectedWorktree(worktree);

    if (!worktree.session && socket) {
      // Create a new session for this worktree
      socket.emit('session:create', { worktreePath: worktree.path, repositoryId: worktree.repositoryId });
    } else if (worktree.session && socket) {
      // Activate existing session on server and client
      socket.emit('session:setActive', { worktreePath: worktree.path, repositoryId: worktree.repositoryId });
      setActiveSession(worktree.session);
    }
  };

  const getStatusColor = (state?: string) => {
    switch (state) {
      case 'busy':
        return 'warning';
      case 'waiting_input':
        return 'info';
      case 'idle':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (state?: string) => {
    const color = getStatusColor(state);
    const statusText = state ? state.replace('_', ' ') : '';

    return (
      <Tooltip title={statusText}>
        <Circle
          sx={{
            fontSize: 20,
            color: `${color}.main`,
          }}
        />
      </Tooltip>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        sx={{
          width: isMobileOrTablet ? '100%' : `calc(100% - ${drawerWidth}px)`,
          ml: isMobileOrTablet ? 0 : `${drawerWidth}px`,
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          {isMobileOrTablet && (
            <IconButton
              edge="start"
              sx={{ mr: 2 }}
              onClick={() => setMobileDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Terminal sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {selectedWorktree ? selectedWorktree.branch : 'Claude Code Crew'}
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setNotificationSettingsOpen(true)}
            sx={{ mr: 1 }}
          >
            <NotificationsIcon />
          </IconButton>
          {activeSession && (
            <Chip
              label={activeSession.state.replace('_', ' ')}
              color={getStatusColor(activeSession.state)}
              size="small"
            />
          )}
        </Toolbar>
      </AppBar>
      {!isMobileOrTablet && (
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="permanent"
          anchor="left"
        >
        <Toolbar>
          <Typography variant="h6" noWrap>
            Repositories
          </Typography>
        </Toolbar>
        <Box sx={{ p: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Repository</InputLabel>
            <Select
              value={selectedRepository?.id || ''}
              label="Repository"
              onChange={handleRepositoryChange}
            >
              {repositories.map((repo) => (
                <MenuItem key={repo.id} value={repo.id}>
                  {repo.name}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value="add-new">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Add fontSize="small" />
                  <Typography>新規リポジトリを追加</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="manage">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOpen fontSize="small" />
                  <Typography>リポジトリを管理</Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Worktrees
          </Typography>
        </Box>
        <Divider />
        <List>
          {worktrees.map((worktree) => (
            <ListItem key={worktree.path} disablePadding>
              <ListItemButton
                selected={selectedWorktree?.path === worktree.path}
                onClick={() => handleSelectWorktree(worktree)}
              >
                <ListItemIcon>
                  {worktree.session ? (
                    getStatusIcon(worktree.session.state)
                  ) : (
                    <FolderOpen />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={worktree.branch}
                  secondary={worktree.path}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setCreateDialogOpen(true)}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary="Create Worktree" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setDeleteDialogOpen(true)}>
              <ListItemIcon>
                <Delete />
              </ListItemIcon>
              <ListItemText primary="Delete Worktree" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setMergeDialogOpen(true)}>
              <ListItemIcon>
                <Merge />
              </ListItemIcon>
              <ListItemText primary="Merge Worktree" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setPersistenceDialogOpen(true)}>
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText primary="保存されたセッション" />
            </ListItemButton>
          </ListItem>
        </List>
        </Drawer>
      )}
      
      {isMobileOrTablet && (
        <MobileDrawer
          open={mobileDrawerOpen}
          onOpen={() => setMobileDrawerOpen(true)}
          onClose={() => setMobileDrawerOpen(false)}
          repositories={repositories}
          selectedRepository={selectedRepository}
          worktrees={worktrees}
          selectedWorktree={selectedWorktree}
          onRepositoryChange={handleRepositoryChange}
          onSelectWorktree={handleSelectWorktree}
          onCreateWorktree={() => setCreateDialogOpen(true)}
          onDeleteWorktree={() => setDeleteDialogOpen(true)}
          onMergeWorktree={() => setMergeDialogOpen(true)}
          onShowPersistence={() => setPersistenceDialogOpen(true)}
          onManageRepositories={() => setRepositoryManagementDialogOpen(true)}
          getStatusIcon={getStatusIcon}
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          pb: isMobile ? 8 : 0, // 底部ナビゲーション分のパディング
          minWidth: 0, // flex要素の最小幅を0に設定
          overflow: 'hidden', // はみ出し防止
        }}
      >
        <Toolbar />
        {activeSession && socket ? (
          <TerminalView
            session={activeSession}
            socket={socket}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h5" color="textSecondary">
              Select a worktree to start a Claude Code session
            </Typography>
          </Box>
        )}
      </Box>

      <CreateWorktreeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        repositoryId={selectedRepository?.id}
      />
      <DeleteWorktreeDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        worktrees={worktrees}
        repositoryId={selectedRepository?.id}
      />
      <MergeWorktreeDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        worktrees={worktrees}
        repositoryId={selectedRepository?.id}
      />
      <SessionPersistenceDialog
        open={persistenceDialogOpen}
        onClose={() => setPersistenceDialogOpen(false)}
        onSessionRestored={() => {
          // ワークツリー一覧を再読み込み
          if (selectedRepository) {
            fetch(`/api/worktrees?repositoryId=${selectedRepository.id}`)
              .then(res => res.json())
              .then(setWorktrees)
              .catch(err => console.error('Failed to fetch worktrees:', err));
          }
        }}
      />
      <AddRepositoryDialog
        open={addRepositoryDialogOpen}
        onClose={() => setAddRepositoryDialogOpen(false)}
        onSuccess={() => {
          // リポジトリ一覧を再読み込み
          fetch('/api/repositories')
            .then(res => res.json())
            .then((data: Repository[]) => {
              setRepositories(data);
            })
            .catch(err => console.error('Failed to fetch repositories:', err));
        }}
      />
      
      <RepositoryManagementDialog
        open={repositoryManagementDialogOpen}
        onClose={() => setRepositoryManagementDialogOpen(false)}
        repositories={repositories}
        selectedRepository={selectedRepository}
      />
      
      <NotificationSettings
        open={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
        settings={notifications.settings}
        permission={notifications.permission}
        onSettingsChange={notifications.updateSettings}
        onRequestPermission={notifications.requestPermission}
      />
      
      {isMobile && (
        <MobileBottomNavigation
          value={mobileNavValue}
          onChange={(_event, newValue) => {
            setMobileNavValue(newValue);
            if (newValue === 0) {
              setMobileDrawerOpen(true);
            } else if (newValue === 1) {
              setCreateDialogOpen(true);
            }
          }}
          sessionCount={activeSession ? 1 : 0}
        />
      )}
    </Box>
  );
};

export default SessionManager;