import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import App from './App';
import { theme } from './theme';

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
