import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { 
  FaUsers, FaChartLine, FaImage, FaUserShield, FaCog, 
  FaClipboardList, FaBell, FaCalendarAlt, FaTachometerAlt,
  FaSignOutAlt, FaUserCog, FaKey, FaSun, FaMoon
} from 'react-icons/fa';
import { adminService } from '../services';
import { useAuth } from '../context';
import '../styles/admin.css';

// Import all admin components from index
import {
  AdminOverview,
  AdminUserManagement,
  AdminContentModeration,
  AdminSubscriptions,
  AdminSettings,
  AdminAuditLogs,
  AdminCommunications,
  AdminReports
} from '../components/Admin';

const Admin = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Extract the active section from URL
    const path = location.pathname;
    const section = path.split('/admin/')[1] || 'overview';
    setActiveSection(section);

    // Check if user prefers dark mode
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('adminDashboardTheme');
    setIsDarkMode(savedTheme === 'dark' || (!savedTheme && prefersDark));
    
    // Apply theme to body 
    document.body.classList.toggle('admin-dark-mode', isDarkMode);

    // Check if sidebar was collapsed previously
    const sidebarState = localStorage.getItem('adminSidebarState');
    setIsCollapsed(sidebarState === 'collapsed');

    // Fetch overview stats on initial load
    const fetchStats = async () => {
      try {
        const response = await adminService.getOverviewStats();
        if (response.success) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Setup interval to refresh stats every 5 minutes
    const statsInterval = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => {
      clearInterval(statsInterval);
      document.body.classList.remove('admin-dark-mode');
    };
  }, [location.pathname, isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('adminDashboardTheme', newMode ? 'dark' : 'light');
    document.body.classList.toggle('admin-dark-mode', newMode);
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('adminSidebarState', newState ? 'collapsed' : 'expanded');
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  // Close mobile menu when a link is clicked
  const handleNavClick = () => {
    if (showMobileMenu) {
      setShowMobileMenu(false);
    }
  };

  // Handle admin logout
  const handleLogout = () => {
    logout();
  };

  // Debug user role information
  import('../debug-middleware').then(module => {
    module.logUserRoleToConsole(user);
  });

  // Check if the current user has admin permissions
  if (user?.role !== 'admin' && !user?.roles?.includes('admin')) {
    console.log('Access denied: User does not have admin role');
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={`admin-dashboard ${isDarkMode ? 'dark' : 'light'} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile menu toggle */}
      <button 
        className={`admin-mobile-menu-toggle ${showMobileMenu ? 'active' : ''}`} 
        onClick={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Admin sidebar */}
      <aside className={`admin-sidebar ${showMobileMenu ? 'mobile-visible' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <FaTachometerAlt />
            {!isCollapsed && <h2>Admin Dashboard</h2>}
          </div>
          
          <button 
            className="admin-sidebar-toggle" 
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="toggle-icon">{isCollapsed ? '»' : '«'}</span>
          </button>
        </div>

        {!isCollapsed && (
          <div className="admin-user-info">
            <div className="admin-user-avatar">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt={user.nickname || 'Admin'} />
              ) : (
                <div className="admin-user-initials">
                  {(user?.nickname || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="admin-user-details">
              <p className="admin-user-name">{user?.nickname || user?.name || 'Admin'}</p>
              <p className="admin-user-email">{user?.email}</p>
            </div>
          </div>
        )}

        <nav className="admin-nav">
          <NavLink 
            to="/admin" 
            end 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Overview"
          >
            <FaChartLine /> {!isCollapsed && <span>Overview</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/users" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="User Management"
          >
            <FaUsers /> {!isCollapsed && <span>User Management</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/moderation" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Content Moderation"
          >
            <FaImage /> {!isCollapsed && <span>Content Moderation</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/reports" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Reports"
          >
            <FaClipboardList /> {!isCollapsed && <span>Reports</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/subscriptions" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Subscriptions"
          >
            <FaCalendarAlt /> {!isCollapsed && <span>Subscriptions</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/communications" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Communications"
          >
            <FaBell /> {!isCollapsed && <span>Communications</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/settings" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Settings"
          >
            <FaCog /> {!isCollapsed && <span>Settings</span>}
          </NavLink>
          
          <NavLink 
            to="/admin/logs" 
            className={({ isActive }) => isActive ? 'admin-nav-item active' : 'admin-nav-item'} 
            onClick={handleNavClick}
            title="Audit Logs"
          >
            <FaUserShield /> {!isCollapsed && <span>Audit Logs</span>}
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <button 
            className="admin-theme-toggle" 
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
            {!isCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          
          <button 
            className="admin-logout" 
            onClick={handleLogout}
            title="Logout"
          >
            <FaSignOutAlt />
            {!isCollapsed && <span>Logout</span>}
          </button>
          
          <NavLink 
            to="/dashboard" 
            className="admin-back-to-site"
            title="Back to Dashboard"
          >
            <FaUserCog />
            {!isCollapsed && <span>Back to Site</span>}
          </NavLink>
        </div>
      </aside>

      {/* Admin content area */}
      <main className={`admin-content ${isCollapsed ? 'expanded' : ''}`}>
        <div className="admin-content-header">
          <h1 className="admin-page-title">
            {activeSection === '' || activeSection === 'overview' ? 'Dashboard Overview' : 
             activeSection === 'users' ? 'User Management' :
             activeSection === 'moderation' ? 'Content Moderation' :
             activeSection === 'reports' ? 'Reports Management' :
             activeSection === 'subscriptions' ? 'Subscription Management' :
             activeSection === 'communications' ? 'Communications' :
             activeSection === 'settings' ? 'System Settings' :
             activeSection === 'logs' ? 'Audit Logs' : 'Admin Dashboard'}
          </h1>
          
          <div className="admin-header-actions">
            <span className="admin-server-status">Server Status: <span className="status-indicator online"></span> Online</span>
            
            <div className="admin-user-dropdown">
              <div className="admin-user-info-mini">
                <div className="admin-user-avatar-mini">
                  {user?.profilePicture ? (
                    <img src={user.profilePicture} alt={user.nickname || 'Admin'} />
                  ) : (
                    <div className="admin-user-initials">
                      {(user?.nickname || user?.email || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span>{user?.nickname || 'Admin'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="admin-content-wrapper">
          <Routes>
            <Route path="/" element={<AdminOverview stats={stats} loading={loading} />} />
            <Route path="/users" element={<AdminUserManagement />} />
            <Route path="/moderation" element={<AdminContentModeration />} />
            <Route path="/reports" element={<AdminReports />} />
            <Route path="/subscriptions" element={<AdminSubscriptions />} />
            <Route path="/communications" element={<AdminCommunications />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/logs" element={<AdminAuditLogs />} />
          </Routes>
        </div>
        
        <footer className="admin-footer">
          <div>© {new Date().getFullYear()} Admin Dashboard</div>
          <div>Version 1.0.0</div>
        </footer>
      </main>
    </div>
  );
};

export default Admin;