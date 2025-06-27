import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Paper,
  Slide,
  IconButton,
} from '@mui/material';
import {
  KeyboardArrowUp,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close,
} from '@mui/icons-material';

interface TerminalInputHelperProps {
  visible: boolean;
  onKeyPress: (key: string) => void;
  onClose: () => void;
}

const TerminalInputHelper: React.FC<TerminalInputHelperProps> = ({
  visible,
  onKeyPress,
  onClose,
}) => {
  const handleKeyPress = (key: string) => {
    onKeyPress(key);
  };

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Paper
        sx={{
          position: 'fixed',
          bottom: 64, // 底部ナビゲーションの上
          left: 8,
          right: 8,
          p: 2,
          zIndex: 1000,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Box sx={{ fontSize: '0.875rem', fontWeight: 'medium' }}>
            ターミナル操作
          </Box>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 方向キー */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => handleKeyPress('\x1b[A')}
                startIcon={<KeyboardArrowUp />}
              >
                ↑
              </Button>
            </ButtonGroup>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => handleKeyPress('\x1b[D')}
                startIcon={<KeyboardArrowLeft />}
              >
                ←
              </Button>
              <Button
                onClick={() => handleKeyPress('\x1b[C')}
                startIcon={<KeyboardArrowRight />}
              >
                →
              </Button>
            </ButtonGroup>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => handleKeyPress('\x1b[B')}
                startIcon={<KeyboardArrowDown />}
              >
                ↓
              </Button>
            </ButtonGroup>
          </Box>
          
          {/* 特殊キー */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\x03')}
            >
              Ctrl+C
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\x1b')}
            >
              Esc
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\t')}
            >
              Tab
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\r')}
            >
              Enter
            </Button>
          </Box>
          
          {/* よく使うコマンド */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('ls\r')}
            >
              ls
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('clear\r')}
            >
              clear
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('cd ..\r')}
            >
              cd ..
            </Button>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default TerminalInputHelper;