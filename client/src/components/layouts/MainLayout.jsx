// src/components/layouts/MainLayout.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Navigation from './Navigation';

const MainLayout = ({ leftSidebar, children, rightSidebar }) => {
  return (
    <div className="flex flex-col h-screen bg-bg-dark">
      <Navigation />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-bg-card border-r border-gray-800 overflow-y-auto">
          {leftSidebar}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        
        <div className="w-80 bg-bg-card border-l border-gray-800 overflow-y-auto">
          {rightSidebar}
        </div>
      </div>
    </div>
  );
};

MainLayout.propTypes = {
  leftSidebar: PropTypes.node,
  children: PropTypes.node,
  rightSidebar: PropTypes.node
};

export default MainLayout;
