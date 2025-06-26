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
} from '@mui/material';
import {
  FolderOpen,
  Add,
  Delete,
  Merge,
  Terminal,
  Circle,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { Worktree, Session, Repository } from '../../../shared/types';
import TerminalView from '../components/TerminalView';
import CreateWorktreeDialog from '../components/CreateWorktreeDialog';
import DeleteWorktreeDialog from '../components/DeleteWorktreeDialog';
import MergeWorktreeDialog from '../components/MergeWorktreeDialog';

const drawerWidth = 300;

const SessionManager: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedWorktree, setSelectedWorktree] = useState<Worktree | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('worktrees:updated', (updatedWorktrees: Worktree[]) => {
      console.log('[Client] Received worktrees:updated event with', updatedWorktrees.length, 'worktrees');
      // Filter worktrees by selected repository
      const filteredWorktrees = selectedRepository 
        ? updatedWorktrees.filter(w => w.repositoryId === selectedRepository.id)
        : updatedWorktrees;
      setWorktrees([...filteredWorktrees]);
    });

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

    return () => {
      newSocket.close();
    };
  }, []); // Empty dependency array - only run once

  // Effect to filter worktrees when repository changes
  useEffect(() => {
    if (selectedRepository && socket) {
      // Request worktrees for selected repository
      fetch(`/api/worktrees?repositoryId=${selectedRepository.id}`)
        .then(res => res.json())
        .then(data => setWorktrees(data))
        .catch(err => console.error('Failed to fetch worktrees:', err));
    }
  }, [selectedRepository, socket]);

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
    <Box sx={{ display: 'flex', height: '100%' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
      >
        <Toolbar>
          <Terminal sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {selectedWorktree ? selectedWorktree.branch : 'Claude Code Crew'}
          </Typography>
          {activeSession && (
            <Chip
              label={activeSession.state.replace('_', ' ')}
              color={getStatusColor(activeSession.state)}
              size="small"
            />
          )}
        </Toolbar>
      </AppBar>
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
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
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
    </Box>
  );
};

export default SessionManager;