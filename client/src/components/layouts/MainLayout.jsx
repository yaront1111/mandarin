import React from 'react';
import Navigation from './Navigation';

export default function MainLayout({ children }) {
  return (
    <div>
      <Navigation />
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  );
}
