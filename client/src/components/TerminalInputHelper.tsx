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
          bottom: 64,
          left: 8,
          right: 8,
          p: 2,
          zIndex: 1000,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 3,
          maxWidth: 'calc(100vw - 16px)',
          overflow: 'visible',
          border: '1px solid',
          borderColor: 'divider',
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
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            flexWrap: 'wrap', 
            mt: 1,
            maxWidth: '100%',
            overflow: 'hidden',
          }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\x03')}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              Ctrl+C
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\x1b')}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              Esc
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\t')}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              Tab
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleKeyPress('\r')}
              sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
            >
              Enter
            </Button>
          </Box>
          
          {/* よく使うコマンド */}
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            flexWrap: 'wrap', 
            mt: 1,
            maxWidth: '100%',
            overflow: 'hidden',
          }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('ls\r')}
              sx={{ minWidth: 'auto' }}
            >
              ls
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('clear\r')}
              sx={{ minWidth: 'auto' }}
            >
              clear
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleKeyPress('cd ..\r')}
              sx={{ minWidth: 'auto' }}
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