import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export const useBreakpoint = () => {
  const theme = useTheme();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('tablet'));
  const isTablet = useMediaQuery(theme.breakpoints.between('tablet', 'desktop'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('desktop'));
  
  const isMobileOrTablet = useMediaQuery(theme.breakpoints.down('desktop'));
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isMobileOrTablet,
    // ブレークポイント値を直接取得
    breakpoints: {
      mobile: theme.breakpoints.values.mobile,
      tablet: theme.breakpoints.values.tablet,
      desktop: theme.breakpoints.values.desktop,
    },
  };
};

export default useBreakpoint;