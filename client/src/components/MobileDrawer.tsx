import React from 'react';
import {
  SwipeableDrawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Box,
  Typography,
  IconButton,
  Toolbar,
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
  Close,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { Repository, Worktree } from '../../../shared/types';

interface MobileDrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  repositories: Repository[];
  selectedRepository: Repository | null;
  worktrees: Worktree[];
  selectedWorktree: Worktree | null;
  onRepositoryChange: (event: SelectChangeEvent<string>) => void;
  onSelectWorktree: (worktree: Worktree) => void;
  onCreateWorktree: () => void;
  onDeleteWorktree: () => void;
  onMergeWorktree: () => void;
  onShowPersistence?: () => void;
  onManageRepositories?: () => void;
  getStatusIcon: (state?: string) => React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  open,
  onOpen,
  onClose,
  repositories,
  selectedRepository,
  worktrees,
  selectedWorktree,
  onRepositoryChange,
  onSelectWorktree,
  onCreateWorktree,
  onDeleteWorktree,
  onMergeWorktree,
  onShowPersistence,
  onManageRepositories,
  getStatusIcon,
}) => {
  return (
    <SwipeableDrawer
      anchor="left"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      disableSwipeToOpen={false}
      sx={{
        '& .MuiDrawer-paper': {
          width: '280px',
          maxWidth: '80vw',
          overflow: 'hidden',
        },
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
        }}
      >
        <Typography variant="h6" noWrap>
          Repositories
        </Typography>
        <IconButton onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </Toolbar>
      
      <Box sx={{ p: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Repository</InputLabel>
          <Select
            value={selectedRepository?.id || ''}
            label="Repository"
            onChange={onRepositoryChange}
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
            {onManageRepositories && (
              <MenuItem value="manage">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOpen fontSize="small" />
                  <Typography>リポジトリを管理</Typography>
                </Box>
              </MenuItem>
            )}
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
      
      <List sx={{ flexGrow: 1, pb: 0 }}>
        {worktrees.map((worktree) => (
          <ListItem key={worktree.path} disablePadding>
            <ListItemButton
              selected={selectedWorktree?.path === worktree.path}
              onClick={() => {
                onSelectWorktree(worktree);
                onClose();
              }}
              sx={{
                minHeight: 56,
                px: 2,
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {worktree.session ? (
                  getStatusIcon(worktree.session.state)
                ) : (
                  <FolderOpen />
                )}
              </ListItemIcon>
              <ListItemText
                primary={worktree.branch}
                secondary={worktree.path}
                primaryTypographyProps={{
                  fontSize: '1rem',
                  fontWeight: selectedWorktree?.path === worktree.path ? 'medium' : 'normal',
                }}
                secondaryTypographyProps={{
                  fontSize: '0.875rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider />
      
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => {
              onCreateWorktree();
              onClose();
            }}
            sx={{ minHeight: 56, px: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Add />
            </ListItemIcon>
            <ListItemText 
              primary="Create Worktree"
              primaryTypographyProps={{ fontSize: '1rem' }}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => {
              onDeleteWorktree();
              onClose();
            }}
            sx={{ minHeight: 56, px: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Delete />
            </ListItemIcon>
            <ListItemText 
              primary="Delete Worktree"
              primaryTypographyProps={{ fontSize: '1rem' }}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => {
              onMergeWorktree();
              onClose();
            }}
            sx={{ minHeight: 56, px: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Merge />
            </ListItemIcon>
            <ListItemText 
              primary="Merge Worktree"
              primaryTypographyProps={{ fontSize: '1rem' }}
            />
          </ListItemButton>
        </ListItem>
        {onShowPersistence && (
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => {
                onShowPersistence();
                onClose();
              }}
              sx={{ minHeight: 56, px: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText 
                primary="保存されたセッション"
                primaryTypographyProps={{ fontSize: '1rem' }}
              />
            </ListItemButton>
          </ListItem>
        )}
      </List>
      
      {/* 底部ナビゲーション分のスペース確保 */}
      <Box sx={{ height: 64 }} />
    </SwipeableDrawer>
  );
};

export default MobileDrawer;