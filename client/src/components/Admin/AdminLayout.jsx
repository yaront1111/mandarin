import React from 'react';
import '../../styles/admin.css';

/**
 * AdminLayout - Provides consistent layout and styling for admin components
 */
const AdminLayout = ({ children, title }) => {
  return (
    <div className="admin-component">
      {title && <h1 className="admin-component-title">{title}</h1>}
      {children}
    </div>
  );
};

export default AdminLayout;