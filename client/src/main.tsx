import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import App from './App';

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    background: { default: '#f5f6f8' },
  },
  shape: { borderRadius: 6 },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* The app fills the window exactly; popups positioned off-screen must not make the page scroll */}
      <GlobalStyles styles={{ '@media screen': { 'html, body': { overflow: 'hidden' } } }} />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
