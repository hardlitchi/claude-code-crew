import React, { useEffect, useRef, useState } from 'react';
import { Box, Fab } from '@mui/material';
import { Keyboard } from '@mui/icons-material';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Socket } from 'socket.io-client';
import { Session } from '../../../shared/types';
import useBreakpoint from '../hooks/useBreakpoint';
import useSwipeGesture from '../hooks/useSwipeGesture';
import TerminalInputHelper from './TerminalInputHelper';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  session: Session;
  socket: Socket;
}

const TerminalView: React.FC<TerminalViewProps> = ({ session, socket }) => {
  const { isMobile, isTablet } = useBreakpoint();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [inputHelperVisible, setInputHelperVisible] = useState(false);

  // スワイプジェスチャーの設定
  const { attachListeners } = useSwipeGesture({
    onSwipeUp: () => {
      if (isMobile && xtermRef.current) {
        // 上スワイプで入力ヘルパーを表示
        setInputHelperVisible(true);
      }
    },
    onSwipeDown: () => {
      if (isMobile && inputHelperVisible) {
        // 下スワイプで入力ヘルパーを非表示
        setInputHelperVisible(false);
      }
    },
    minDistance: 30,
  });

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // レスポンシブフォントサイズ
    const fontSize = isMobile ? 12 : isTablet ? 13 : 14;
    
    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
      // モバイル向け設定
      scrollback: isMobile ? 1000 : 3000, // スクロールバック履歴を制限
      fastScrollModifier: 'alt',
      // タッチスクロールの改善
      macOptionIsMeta: true,
      allowTransparency: false,
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#0a0a0a',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal in the DOM
    term.open(terminalRef.current);
    fitAddon.fit();
    
    // モバイルでスワイプジェスチャーを有効化
    if (isMobile && terminalRef.current) {
      attachListeners(terminalRef.current);
    }

    // Store references
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    term.onData((data) => {
      socket.emit('session:input', { sessionId: session.id, input: data });
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      socket.emit('session:resize', { sessionId: session.id, cols, rows });
    });

    // Handle window resize with debounce for better performance
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // モバイル向けオリエンテーション変更対応
    if (isMobile) {
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        }, 100);
      });
    }

    // Socket event handlers
    const handleOutput = ({ sessionId, data }: { sessionId: string; data: string }) => {
      if (sessionId === session.id) {
        term.write(data);
      }
    };

    const handleRestore = ({ sessionId, history }: { sessionId: string; history: string }) => {
      if (sessionId === session.id) {
        // 現在のスクロール位置を保存
        const scrollTop = term.buffer.active.viewportY;
        term.clear();
        term.write(history);
        // スクロール位置を復元（可能な場合）
        if (scrollTop > 0 && term.buffer.active.length > scrollTop) {
          term.scrollToLine(Math.min(scrollTop, term.buffer.active.length - term.rows));
        }
      }
    };

    // セッション復旧ハンドリング
    const handleRestarted = ({ id }: { id: string }) => {
      if (id === session.id) {
        term.clear();
        term.write('\x1b[32m\r\n\u30bb\u30c3\u30b7\u30e7\u30f3\u304c\u5fa9\u65e7\u3055\u308c\u307e\u3057\u305f\u3002\u7d99\u7d9a\u3057\u3066\u4f5c\u696d\u3067\u304d\u307e\u3059\u3002\r\n\x1b[0m');
      }
    };
    
    // セッション切断ハンドリング
    const handleDisconnected = ({ id }: { id: string }) => {
      if (id === session.id) {
        term.write('\x1b[31m\r\n\u30bb\u30c3\u30b7\u30e7\u30f3\u304c\u5207\u65ad\u3055\u308c\u307e\u3057\u305f\u3002\u518d\u63a5\u7d9a\u3092\u8a66\u307f\u3066\u3044\u307e\u3059...\r\n\x1b[0m');
      }
    };

    socket.on('session:output', handleOutput);
    socket.on('session:restore', handleRestore);
    socket.on('session:restarted', handleRestarted);
    socket.on('session:disconnected', handleDisconnected);

    // Request session restore if reconnecting
    socket.emit('session:restore', session.id);

    // Cleanup
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (isMobile) {
        window.removeEventListener('orientationchange', handleResize);
      }
      socket.off('session:output', handleOutput);
      socket.off('session:restore', handleRestore);
      socket.off('session:restarted', handleRestarted);
      socket.off('session:disconnected', handleDisconnected);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [session.id, socket, isMobile, attachListeners]);
  
  // 入力ヘルパーからのキー入力処理
  const handleInputHelperKeyPress = (key: string) => {
    if (xtermRef.current) {
      socket.emit('session:input', { sessionId: session.id, input: key });
    }
  };

  // Handle session changes
  useEffect(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [session]);

  return (
    <Box sx={{ 
      position: 'relative', 
      flexGrow: 1, 
      minWidth: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box
        ref={terminalRef}
        sx={{
          flexGrow: 1,
          padding: isMobile ? 0.5 : 1,
          backgroundColor: '#0a0a0a',
          height: '100%',
          width: '100%',
          minWidth: 0, // flex要素の最小幅を0に設定
          // タッチスクロール最適化
          overflowX: 'auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          '& .xterm': {
            padding: isMobile ? '4px' : '8px',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          },
          '& .xterm-viewport': {
            backgroundColor: 'transparent !important',
            touchAction: 'pan-y',
            width: '100%',
            overflow: 'hidden',
          },
          '& .xterm-screen': {
            WebkitTapHighlightColor: 'transparent',
            WebkitUserSelect: 'text',
            userSelect: 'text',
            width: '100%',
            overflow: 'hidden',
          },
          // モバイル時の横スクロール調整
          ...(isMobile && {
            '& .xterm-helpers textarea': {
              // 仮想キーボード対応
              fontSize: '16px', // ズームを防ぐ
            },
          }),
        }}
      />
      
      {isMobile && (
        <>
          {/* 入力ヘルパー表示ボタン */}
          <Fab
            size="small"
            color="primary"
            onClick={() => setInputHelperVisible(!inputHelperVisible)}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 999,
            }}
          >
            <Keyboard />
          </Fab>
          
          {/* ターミナル入力ヘルパー */}
          <TerminalInputHelper
            visible={inputHelperVisible}
            onKeyPress={handleInputHelperKeyPress}
            onClose={() => setInputHelperVisible(false)}
          />
        </>
      )}
    </Box>
  );
};

export default TerminalView;