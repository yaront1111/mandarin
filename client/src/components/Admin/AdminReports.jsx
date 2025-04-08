import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import AdminLayout from './AdminLayout';
import adminService from '../../services/AdminService';
import { toast } from 'react-toastify';

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [totalReports, setTotalReports] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('createdAt_desc');
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await adminService.getReportedContent({
        status: statusFilter,
        type: typeFilter,
        search: searchTerm,
        sort: sortOrder,
        page: currentPage,
        limit: 10
      });

      if (response.success && response.data) {
        // API returned data
        setReports(response.data.reports || []);
        setTotalReports(response.data.totalReports || 0);
        setTotalPages(response.data.totalPages || 1);
        setCurrentPage(response.data.currentPage || 1);
      } else if (response.message === "Reports functionality not yet implemented") {
        // Handle the case where backend API is not implemented
        console.warn("Reports functionality not yet implemented on the backend");
        setReports([]);
        setTotalReports(0);
        setTotalPages(1);
      } else {
        console.error('Failed to fetch reports:', response.error || 'Unknown error');
        setReports([]);
        setTotalReports(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setTotalReports(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter, typeFilter, sortOrder, currentPage]);
  
  // Show a notification on first mount if the feature is not fully implemented
  useEffect(() => {
    const hasShownNotification = localStorage.getItem('reports_notification_shown');
    if (!hasShownNotification) {
      toast.info("The reports management functionality is currently under development. Some features may be limited.", {
        autoClose: 8000,
        position: "top-center"
      });
      localStorage.setItem('reports_notification_shown', 'true');
    }
  }, []);

  useEffect(() => {
    // Debounce search input
    const timer = setTimeout(() => {
      fetchReports();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReport(null);
    setAdminNotes('');
  };

  const handleResolveReport = async (action) => {
    if (!selectedReport) return;
    
    setActionInProgress(true);
    try {
      const response = await adminService.handleReportedContent(
        selectedReport._id,
        action,
        adminNotes
      );

      if (response.success) {
        // Update the report in the current list
        const updatedReports = reports.map(report => 
          report._id === selectedReport._id ? response.data : report
        );
        setReports(updatedReports);
        handleCloseModal();
        // If we're filtering by status, might need to refresh the list
        if (statusFilter === 'pending') {
          fetchReports();
        }
      } else if (response.message === "Report update functionality not yet implemented") {
        // Handle the case where backend API is not implemented
        console.warn("Report update functionality not yet implemented on the backend");
        handleCloseModal();
        // Show message to user or handle gracefully
        alert("This feature is currently under development. The action has been logged but not processed.");
      } else {
        console.error(`Error ${action} report:`, response.error || 'Unknown error');
        alert("Error processing this action. Please try again later.");
      }
    } catch (error) {
      console.error(`Error ${action} report:`, error);
      alert("Error processing this action. Please try again later.");
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getReportTypeLabel = (type) => {
    const typeLabels = {
      'inappropriate_photo': 'Inappropriate Photo',
      'spam': 'Spam',
      'harassment': 'Harassment',
      'fake_profile': 'Fake Profile',
      'underage': 'Underage User'
    };
    return typeLabels[type] || type;
  };

  const getStatusBadgeClass = (status) => {
    return `admin-status-badge ${status === 'pending' ? 'unverified' : status === 'resolved' ? 'active' : 'inactive'}`;
  };

  return (
    <AdminLayout title="Reports Management">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>User Reports</h3>
          <div className="admin-filters">
            <select 
              value={statusFilter} 
              onChange={handleStatusFilterChange}
              className="admin-select"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select 
              value={typeFilter} 
              onChange={handleTypeFilterChange}
              className="admin-select"
            >
              <option value="all">All Types</option>
              <option value="inappropriate_photo">Inappropriate Photos</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="fake_profile">Fake Profile</option>
              <option value="underage">Underage User</option>
            </select>
            <select 
              value={sortOrder} 
              onChange={handleSortChange}
              className="admin-select"
            >
              <option value="createdAt_desc">Latest First</option>
              <option value="createdAt_asc">Oldest First</option>
            </select>
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={handleSearch}
              className="admin-input"
            />
          </div>
        </div>
        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading">
              <div className="spinner"></div>
              <p>Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="admin-no-data">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 10H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 10H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 16H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>No reports found</h3>
              <p>No reports match your current filters</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Reported User</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report._id}>
                      <td>
                        <div className="admin-user-info">
                          <span className="admin-user-name">{report.reporter.nickname}</span>
                          <span className="admin-user-id">{report.reporter.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-info">
                          <span className="admin-user-name">{report.reportedUser.nickname}</span>
                          <span className="admin-user-id">{report.reportedUser.email}</span>
                        </div>
                      </td>
                      <td>{getReportTypeLabel(report.type)}</td>
                      <td>
                        <div className="report-reason" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.reason}
                        </div>
                      </td>
                      <td>{formatDate(report.createdAt)}</td>
                      <td>
                        <span className={getStatusBadgeClass(report.status)}>
                          {report.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button 
                            className="admin-action-button view" 
                            onClick={() => handleViewReport(report)}
                            title="View details"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="admin-pagination">
                <div className="admin-pagination-info">
                  Showing {reports.length} of {totalReports} reports
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
            </div>
          )}
        </div>
      </div>

      {/* Report Details Modal */}
      {modalOpen && selectedReport && (
        <div className="admin-modal">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>Report Details</h2>
              <button className="admin-modal-close" onClick={handleCloseModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label>Report Type</label>
                <div>{getReportTypeLabel(selectedReport.type)}</div>
              </div>
              <div className="admin-form-group">
                <label>Reporter</label>
                <div>{selectedReport.reporter.nickname} ({selectedReport.reporter.email})</div>
              </div>
              <div className="admin-form-group">
                <label>Reported User</label>
                <div>{selectedReport.reportedUser.nickname} ({selectedReport.reportedUser.email})</div>
              </div>
              <div className="admin-form-group">
                <label>Reason</label>
                <div>{selectedReport.reason}</div>
              </div>
              {selectedReport.additionalInfo && (
                <div className="admin-form-group">
                  <label>Additional Information</label>
                  <div>{selectedReport.additionalInfo}</div>
                </div>
              )}
              <div className="admin-form-group">
                <label>Date Reported</label>
                <div>{formatDate(selectedReport.createdAt)}</div>
              </div>
              <div className="admin-form-group">
                <label>Status</label>
                <div>
                  <span className={getStatusBadgeClass(selectedReport.status)}>
                    {selectedReport.status}
                  </span>
                </div>
              </div>
              {selectedReport.status !== 'pending' && (
                <div className="admin-form-group">
                  <label>Action Taken</label>
                  <div>{selectedReport.actionTaken || 'None'}</div>
                </div>
              )}
              <div className="admin-form-group">
                <label>Admin Notes</label>
                <textarea 
                  className="admin-textarea" 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this report..."
                  disabled={selectedReport.status !== 'pending'}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              {selectedReport.status === 'pending' ? (
                <>
                  <button 
                    className="admin-button admin-button-secondary" 
                    onClick={() => handleResolveReport('dismiss')}
                    disabled={actionInProgress}
                  >
                    Dismiss Report
                  </button>
                  <button 
                    className="admin-button admin-button-primary" 
                    onClick={() => handleResolveReport('resolve')}
                    disabled={actionInProgress}
                  >
                    Resolve & Take Action
                  </button>
                </>
              ) : (
                <button 
                  className="admin-button admin-button-secondary" 
                  onClick={handleCloseModal}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminReports;