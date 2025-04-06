import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import { FaSearch, FaEdit, FaUserCheck, FaUserSlash, FaTrash, FaEye, FaCheck, FaTimes } from 'react-icons/fa';
import { adminService } from '../../services';
import { toast } from 'react-toastify';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalUsers: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    role: 'all',
    gender: 'all',
    sort: 'createdAt_desc',
    verified: 'all'
  });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { page, limit } = pagination;
      const response = await adminService.getUsers({
        page,
        limit,
        search: filters.search,
        status: filters.status !== 'all' ? filters.status : undefined,
        role: filters.role !== 'all' ? filters.role : undefined,
        gender: filters.gender !== 'all' ? filters.gender : undefined,
        verified: filters.verified !== 'all' ? filters.verified : undefined,
        sort: filters.sort
      });

      if (response.success) {
        setUsers(response.data.users);
        setPagination({
          ...pagination,
          totalPages: response.data.totalPages,
          totalUsers: response.data.totalUsers
        });
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('An error occurred while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setPagination({ ...pagination, page: 1 }); // Reset to first page when filters change
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 }); // Reset to first page
    fetchUsers();
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleViewUser = async (userId) => {
    try {
      setLoading(true);
      const response = await adminService.getUser(userId);
      if (response.success) {
        setSelectedUser(response.data);
        setShowUserModal(true);
      } else {
        toast.error('Failed to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('An error occurred while fetching user details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const response = await adminService.toggleUserActive(userId, newStatus);
      if (response.success) {
        toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
        // Update the user in the list
        setUsers(users.map(user => 
          user._id === userId ? { ...user, isActive: newStatus } : user
        ));
      } else {
        toast.error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('An error occurred while updating user status');
    }
  };

  const handleVerifyUser = async (userId) => {
    try {
      const response = await adminService.verifyUser(userId);
      if (response.success) {
        toast.success('User verified successfully');
        // Update the user in the list
        setUsers(users.map(user => 
          user._id === userId ? { ...user, verified: true } : user
        ));
      } else {
        toast.error('Failed to verify user');
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      toast.error('An error occurred while verifying user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminService.deleteUser(userId);
      if (response.success) {
        toast.success('User deleted successfully');
        // Remove the user from the list
        setUsers(users.filter(user => user._id !== userId));
        setPagination(prev => ({
          ...prev,
          totalUsers: prev.totalUsers - 1
        }));
      } else {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('An error occurred while deleting user');
    }
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="admin-user-management">
      <h1>User Management</h1>
      
      {/* Filter and Search */}
      <div className="admin-filter-container">
        <form onSubmit={handleSearch} className="admin-search-form">
          <div className="admin-search-input">
            <input
              type="text"
              placeholder="Search by name, email or ID..."
              value={filters.search}
              onChange={handleSearchChange}
            />
            <button type="submit">
              <FaSearch />
            </button>
          </div>
          
          <div className="admin-filter-controls">
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            
            <select
              name="role"
              value={filters.role}
              onChange={handleFilterChange}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
            </select>
            
            <select
              name="gender"
              value={filters.gender}
              onChange={handleFilterChange}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="couple">Couple</option>
            </select>
            
            <select
              name="verified"
              value={filters.verified}
              onChange={handleFilterChange}
            >
              <option value="all">All Verification</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
            
            <select
              name="sort"
              value={filters.sort}
              onChange={handleFilterChange}
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="lastActive_desc">Recently Active</option>
              <option value="nickname_asc">Name (A-Z)</option>
              <option value="nickname_desc">Name (Z-A)</option>
            </select>
          </div>
        </form>
      </div>
      
      {/* Users Table */}
      <div className="admin-table-container">
        {loading ? (
          <div className="admin-loading">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Joined</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            {user.profileImage ? (
                              <img src={user.profileImage} alt={user.nickname || 'User'} />
                            ) : (
                              <div className="admin-user-initials">
                                {(user.nickname || user.email || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="admin-user-info">
                            <div className="admin-user-name">{user.nickname || 'Anonymous User'}</div>
                            <div className="admin-user-id">{user._id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.gender || 'Not specified'}</td>
                      <td>
                        <span className={`admin-status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-status-badge ${user.verified ? 'verified' : 'unverified'}`}>
                          {user.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{user.lastActive ? formatDate(user.lastActive) : 'Never'}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            onClick={() => handleViewUser(user._id)}
                            className="admin-action-button"
                            title="View User"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                            className={`admin-action-button ${user.isActive ? 'inactive' : 'active'}`}
                            title={user.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {user.isActive ? <FaUserSlash /> : <FaUserCheck />}
                          </button>
                          {!user.verified && (
                            <button
                              onClick={() => handleVerifyUser(user._id)}
                              className="admin-action-button verify"
                              title="Verify User"
                            >
                              <FaCheck />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="admin-action-button delete"
                            title="Delete User"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="admin-no-data">
                      No users found matching the criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {users.length} of {pagination.totalUsers} users
              </div>
              <div className="admin-pagination-controls">
                <button 
                  disabled={pagination.page === 1} 
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <span className="admin-pagination-current">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button 
                  disabled={pagination.page === pagination.totalPages} 
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="admin-modal">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>User Details</h2>
              <button className="admin-modal-close" onClick={closeUserModal}>
                <FaTimes />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-user-profile">
                <div className="admin-user-profile-header">
                  <div className="admin-user-profile-avatar">
                    {selectedUser.profileImage ? (
                      <img src={selectedUser.profileImage} alt={selectedUser.nickname || 'User'} />
                    ) : (
                      <div className="admin-user-profile-initials">
                        {(selectedUser.nickname || selectedUser.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="admin-user-profile-info">
                    <h3>{selectedUser.nickname || 'Anonymous User'}</h3>
                    <p className="admin-user-profile-email">{selectedUser.email}</p>
                    <p className="admin-user-profile-id">ID: {selectedUser._id}</p>
                    <div className="admin-user-profile-badges">
                      <span className={`admin-status-badge ${selectedUser.isActive ? 'active' : 'inactive'}`}>
                        {selectedUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`admin-status-badge ${selectedUser.verified ? 'verified' : 'unverified'}`}>
                        {selectedUser.verified ? 'Verified' : 'Unverified'}
                      </span>
                      {selectedUser.roles?.includes('admin') && (
                        <span className="admin-status-badge admin">Admin</span>
                      )}
                      {selectedUser.subscription?.status === 'active' && (
                        <span className="admin-status-badge premium">Premium</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="admin-user-profile-details">
                  <div className="admin-user-profile-section">
                    <h4>Basic Information</h4>
                    <div className="admin-user-profile-grid">
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Gender</span>
                        <span className="admin-user-profile-value">{selectedUser.gender || 'Not specified'}</span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Age</span>
                        <span className="admin-user-profile-value">{selectedUser.age || 'Not specified'}</span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Joined</span>
                        <span className="admin-user-profile-value">{formatDate(selectedUser.createdAt)}</span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Last Active</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.lastActive ? formatDate(selectedUser.lastActive) : 'Never'}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Location</span>
                        <span className="admin-user-profile-value">{selectedUser.location || 'Not specified'}</span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Interests</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.interests?.length 
                            ? selectedUser.interests.join(', ') 
                            : 'None specified'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="admin-user-profile-section">
                    <h4>Subscription Information</h4>
                    <div className="admin-user-profile-grid">
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Status</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.subscription?.status || 'Free'}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Plan</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.subscription?.plan || 'None'}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Starts</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.subscription?.startDate 
                            ? formatDate(selectedUser.subscription.startDate) 
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Expires</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.subscription?.endDate 
                            ? formatDate(selectedUser.subscription.endDate) 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="admin-user-profile-section">
                    <h4>Activity</h4>
                    <div className="admin-user-profile-grid">
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Login Count</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.loginCount || 0}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Messages Sent</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.messagesSent || 0}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Photos</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.photosCount || 0}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Stories</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.storiesCount || 0}
                        </span>
                      </div>
                      <div className="admin-user-profile-field">
                        <span className="admin-user-profile-label">Reports Against</span>
                        <span className="admin-user-profile-value">
                          {selectedUser.reportsCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button 
                className="admin-button admin-button-primary" 
                onClick={() => handleToggleUserStatus(selectedUser._id, selectedUser.isActive)}
              >
                {selectedUser.isActive ? 'Deactivate User' : 'Activate User'}
              </button>
              {!selectedUser.verified && (
                <button 
                  className="admin-button admin-button-success" 
                  onClick={() => handleVerifyUser(selectedUser._id)}
                >
                  Verify User
                </button>
              )}
              <button 
                className="admin-button admin-button-danger" 
                onClick={() => {
                  handleDeleteUser(selectedUser._id);
                  closeUserModal();
                }}
              >
                Delete User
              </button>
              <button 
                className="admin-button admin-button-secondary" 
                onClick={closeUserModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;