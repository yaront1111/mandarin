import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import AdminLayout from './AdminLayout';
import adminService from '../../services/AdminService';

const AdminAuditLogs = () => {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [sortOrder, setSortOrder] = useState('timestamp_desc');
  
  // Fetch audit logs from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Prepare API query parameters
        const params = {
          page: currentPage,
          limit: 15,
          sort: sortOrder
        };
        
        // Add filters to params if they're set
        if (actionFilter !== 'all') {
          params.action = actionFilter;
        }
        
        if (userFilter) {
          params.user = userFilter;
        }
        
        if (dateRange.from) {
          params.startDate = dateRange.from;
        }
        
        if (dateRange.to) {
          params.endDate = dateRange.to;
        }
        
        // Call the API
        const response = await adminService.getAuditLogs(params);
        
        if (response.success) {
          setAuditLogs(response.data || []);
          setTotalLogs(response.pagination?.total || 0);
          setTotalPages(response.pagination?.totalPages || 1);
        } else {
          console.error('Failed to fetch audit logs:', response.error);
          // Fallback to empty data if API fails
          setAuditLogs([]);
          setTotalLogs(0);
          setTotalPages(1);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        // Handle error state
        setAuditLogs([]);
        setTotalLogs(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [actionFilter, userFilter, dateRange, sortOrder, currentPage]);
  
  const handleActionFilterChange = (e) => {
    setActionFilter(e.target.value);
    setCurrentPage(1);
  };
  
  const handleUserFilterChange = (e) => {
    setUserFilter(e.target.value);
    setCurrentPage(1);
  };
  
  const handleDateFromChange = (e) => {
    setDateRange(prev => ({ ...prev, from: e.target.value }));
    setCurrentPage(1);
  };
  
  const handleDateToChange = (e) => {
    setDateRange(prev => ({ ...prev, to: e.target.value }));
    setCurrentPage(1);
  };
  
  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1);
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };
  
  const getActionLabel = (action) => {
    const parts = action.split('.');
    if (parts.length !== 2) return action;
    
    const [module, operation] = parts;
    
    const moduleLabels = {
      user: 'User',
      content: 'Content',
      report: 'Report',
      settings: 'Settings',
      subscription: 'Subscription',
      admin: 'Admin',
      system: 'System'
    };
    
    const operationLabels = {
      create: 'Created',
      update: 'Updated',
      delete: 'Deleted',
      login: 'Logged in',
      verify: 'Verified',
      suspend: 'Suspended',
      approve: 'Approved',
      reject: 'Rejected',
      resolve: 'Resolved',
      dismiss: 'Dismissed',
      cancel: 'Cancelled',
      backup: 'Backup',
      restore: 'Restore'
    };
    
    return `${moduleLabels[module] || module} ${operationLabels[operation] || operation}`;
  };
  
  const getActionClass = (action) => {
    const parts = action.split('.');
    if (parts.length !== 2) return '';
    
    const operation = parts[1];
    
    const classMap = {
      create: 'admin-action-log-create',
      update: 'admin-action-log-update',
      delete: 'admin-action-log-delete',
      verify: 'admin-action-log-verify',
      approve: 'admin-action-log-approve',
      reject: 'admin-action-log-reject',
      suspend: 'admin-action-log-suspend',
      resolve: 'admin-action-log-resolve',
      dismiss: 'admin-action-log-dismiss',
      login: 'admin-action-log-login',
      backup: 'admin-action-log-backup',
      restore: 'admin-action-log-restore',
      cancel: 'admin-action-log-cancel'
    };
    
    return classMap[operation] || '';
  };
  
  const formatDetails = (details, action) => {
    if (!details || Object.keys(details).length === 0) return 'No details';
    
    const detailsArr = Object.entries(details).map(([key, value]) => `${key}: ${value}`);
    return detailsArr.join(', ');
  };

  return (
    <AdminLayout title="Audit Logs">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Security Audit Logs</h3>
          <div className="admin-filters">
            <select 
              value={actionFilter} 
              onChange={handleActionFilterChange}
              className="admin-select"
            >
              <option value="all">All Actions</option>
              <option value="user">User Actions</option>
              <option value="content">Content Actions</option>
              <option value="report">Report Actions</option>
              <option value="settings">Settings Actions</option>
              <option value="subscription">Subscription Actions</option>
              <option value="system">System Actions</option>
            </select>
            
            <input
              type="text"
              placeholder="Filter by user..."
              value={userFilter}
              onChange={handleUserFilterChange}
              className="admin-input"
            />
            
            <input
              type="date"
              placeholder="From date"
              value={dateRange.from}
              onChange={handleDateFromChange}
              className="admin-input admin-date-input"
            />
            
            <input
              type="date"
              placeholder="To date"
              value={dateRange.to}
              onChange={handleDateToChange}
              className="admin-input admin-date-input"
            />
            
            <select 
              value={sortOrder} 
              onChange={handleSortChange}
              className="admin-select"
            >
              <option value="timestamp_desc">Newest First</option>
              <option value="timestamp_asc">Oldest First</option>
            </select>
          </div>
        </div>
        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading">
              <div className="spinner"></div>
              <p>Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="admin-no-data">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 10H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 10H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 16H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>No audit logs found</h3>
              <p>No logs match your current filters</p>
            </div>
          ) : (
            <>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Target</th>
                      <th>Details</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.timestamp)}</td>
                        <td>
                          <span className={`admin-action-log ${getActionClass(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td>
                          <div className="admin-user-info">
                            <span className="admin-user-name">{log.user.name}</span>
                            <span className="admin-user-id">{log.user.email}</span>
                          </div>
                        </td>
                        <td>
                          {log.targetType && (
                            <>
                              <span className="admin-log-target-type">{log.targetType}</span>
                              {log.targetId && <span className="admin-log-target-id">{log.targetId}</span>}
                            </>
                          )}
                        </td>
                        <td>
                          <div className="admin-log-details">
                            {formatDetails(log.details, log.action)}
                          </div>
                        </td>
                        <td>{log.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="admin-pagination">
                <div className="admin-pagination-info">
                  Showing {auditLogs.length} of {totalLogs} logs
                </div>
                <div className="admin-pagination-controls">
                  <button 
                    onClick={() => handlePageChange(1)} 
                    disabled={currentPage === 1}
                  >
                    First
                  </button>
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="admin-pagination-current">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button 
                    onClick={() => handlePageChange(totalPages)} 
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogs;