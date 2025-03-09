import React from 'react';
import { Link } from 'react-router-dom';

export default function Navigation() {
  return (
    <nav style={{ backgroundColor: '#eee', padding: '0.5rem', marginBottom: '1rem' }}>
      <Link to="/" style={{ marginRight: '1rem' }}>Home</Link>
      <Link to="/matches" style={{ marginRight: '1rem' }}>Matches</Link>
      <Link to="/profile" style={{ marginRight: '1rem' }}>Profile</Link>
      <Link to="/discover" style={{ marginRight: '1rem' }}>Discover</Link>
      <Link to="/settings">Settings</Link>
    </nav>
  );
}
