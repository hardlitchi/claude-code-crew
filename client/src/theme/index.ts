import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface BreakpointOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    xl: true;
    mobile: true;
    tablet: true;
    desktop: true;
  }
}

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      mobile: 0,
      sm: 600,
      tablet: 768,
      md: 900,
      lg: 1200,
      desktop: 1024,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          // 全ての要素でボックスサイジングを境界ボックスに設定
          boxSizing: 'border-box',
        },
        html: {
          // HTMLレベルでの横スクロール防止
          overflowX: 'hidden',
          width: '100%',
        },
        body: {
          // タッチデバイス向けのスクロール最適化
          WebkitOverflowScrolling: 'touch',
          // タップハイライトを無効化
          WebkitTapHighlightColor: 'transparent',
          // 横スクロール防止
          overflowX: 'hidden',
          width: '100%',
          margin: 0,
          padding: 0,
        },
        '#root': {
          // Reactルート要素の設定
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          // モバイル向けタッチターゲットサイズ
          minHeight: 44,
          '@media (max-width: 768px)': {
            minHeight: 48,
            fontSize: '1rem',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          // リスト項目のタッチターゲットサイズ
          minHeight: 48,
          '@media (max-width: 768px)': {
            minHeight: 56,
            padding: '8px 16px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // アイコンボタンのタッチターゲットサイズ
          '@media (max-width: 768px)': {
            padding: 12,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          // モバイルでのドロワー調整
          '@media (max-width: 768px)': {
            width: '280px',
            maxWidth: '80vw',
          },
        },
      },
    },
  },
  typography: {
    // ベースフォントサイズ
    fontSize: 14,
  },
  spacing: 8,
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

export default theme;