import React from 'react';
import { Navbar } from '../components';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <Navbar />
      <div className="not-found-container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist.</p>
        <a href="/dashboard" className="btn btn-primary">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
