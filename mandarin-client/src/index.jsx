// src/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoutes from './routes';
import { AppProvider } from './context/AppContext';
import './styles/globals.css';
import './styles/theme.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <AppProvider>
    <AppRoutes />
  </AppProvider>
);
