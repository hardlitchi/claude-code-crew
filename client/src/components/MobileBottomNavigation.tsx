import React from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
} from '@mui/material';
import {
  FolderOpen,
  Add,
  Settings,
  Terminal,
} from '@mui/icons-material';

interface MobileBottomNavigationProps {
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
  sessionCount?: number;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  value,
  onChange,
  sessionCount = 0,
}) => {
  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderTop: 1,
        borderColor: 'divider',
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={onChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '8px 12px',
          },
        }}
      >
        <BottomNavigationAction 
          label="ワークツリー" 
          icon={<FolderOpen />} 
        />
        <BottomNavigationAction 
          label="作成" 
          icon={<Add />} 
        />
        <BottomNavigationAction 
          label="ターミナル" 
          icon={
            <Badge badgeContent={sessionCount} color="primary">
              <Terminal />
            </Badge>
          } 
        />
        <BottomNavigationAction 
          label="設定" 
          icon={<Settings />} 
        />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNavigation;