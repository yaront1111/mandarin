import React, { useState, useEffect } from 'react';
import '../../styles/admin.css';
import { FaCheck, FaTimes, FaImage, FaSearch, FaFilter, FaSortAmountDown } from 'react-icons/fa';
import { adminService } from '../../services';
import { toast } from 'react-toastify';

const AdminContentModeration = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalPages: 1,
    totalPhotos: 0
  });
  const [filters, setFilters] = useState({
    status: 'pending',
    sort: 'createdAt_desc',
    search: ''
  });

  useEffect(() => {
    fetchPhotos();
  }, [pagination.page, filters]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const { page, limit } = pagination;
      const response = await adminService.getPhotosForModeration({
        page,
        limit,
        status: filters.status,
        sort: filters.sort,
        search: filters.search
      });

      if (response.success) {
        setPhotos(response.data.photos);
        setPagination({
          ...pagination,
          totalPages: response.data.totalPages,
          totalPhotos: response.data.totalPhotos
        });
      } else {
        toast.error('Failed to fetch photos');
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('An error occurred while fetching photos');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setPagination({ ...pagination, page: 1 }); // Reset to first page when filters change
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 }); // Reset to first page
    fetchPhotos();
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleViewPhoto = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  const handleApprovePhoto = async (photoId) => {
    try {
      const response = await adminService.moderatePhoto(photoId, 'approve');
      if (response.success) {
        toast.success('Photo approved successfully');
        // Remove the photo from the list if we're viewing pending photos
        if (filters.status === 'pending') {
          setPhotos(photos.filter(photo => photo._id !== photoId));
          setPagination(prev => ({
            ...prev,
            totalPhotos: prev.totalPhotos - 1
          }));
        } else {
          // Update the photo status in the list
          setPhotos(photos.map(photo => 
            photo._id === photoId ? { ...photo, status: 'approved' } : photo
          ));
        }
        // Close the modal if open
        if (showPhotoModal && selectedPhoto?._id === photoId) {
          setShowPhotoModal(false);
          setSelectedPhoto(null);
        }
      } else {
        toast.error('Failed to approve photo');
      }
    } catch (error) {
      console.error('Error approving photo:', error);
      toast.error('An error occurred while approving photo');
    }
  };

  const handleRejectPhoto = async (photoId, reason = '') => {
    try {
      const response = await adminService.moderatePhoto(photoId, 'reject', reason);
      if (response.success) {
        toast.success('Photo rejected successfully');
        // Remove the photo from the list if we're viewing pending photos
        if (filters.status === 'pending') {
          setPhotos(photos.filter(photo => photo._id !== photoId));
          setPagination(prev => ({
            ...prev,
            totalPhotos: prev.totalPhotos - 1
          }));
        } else {
          // Update the photo status in the list
          setPhotos(photos.map(photo => 
            photo._id === photoId ? { ...photo, status: 'rejected', rejectionReason: reason } : photo
          ));
        }
        // Close the modal if open
        if (showPhotoModal && selectedPhoto?._id === photoId) {
          setShowPhotoModal(false);
          setSelectedPhoto(null);
        }
        // Reset the rejection reason
        setRejectionReason('');
      } else {
        toast.error('Failed to reject photo');
      }
    } catch (error) {
      console.error('Error rejecting photo:', error);
      toast.error('An error occurred while rejecting photo');
    }
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setRejectionReason('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="admin-content-moderation">
      <h1>Content Moderation</h1>
      
      {/* Filter and Search */}
      <div className="admin-filter-container">
        <form onSubmit={handleSearch} className="admin-search-form">
          <div className="admin-search-input">
            <input
              type="text"
              placeholder="Search by user name or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <button type="submit">
              <FaSearch />
            </button>
          </div>
          
          <div className="admin-filter-controls">
            <div className="admin-filter-group">
              <FaFilter />
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Photos</option>
              </select>
            </div>
            
            <div className="admin-filter-group">
              <FaSortAmountDown />
              <select
                name="sort"
                value={filters.sort}
                onChange={handleFilterChange}
              >
                <option value="createdAt_desc">Newest First</option>
                <option value="createdAt_asc">Oldest First</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      
      {/* Photos Grid */}
      <div className="admin-photo-grid-container">
        {loading ? (
          <div className="admin-loading">
            <div className="spinner"></div>
            <p>Loading photos...</p>
          </div>
        ) : photos.length > 0 ? (
          <>
            <div className="admin-photo-grid">
              {photos.map((photo) => (
                <div className="admin-photo-card" key={photo._id}>
                  <div className="admin-photo-card-image" onClick={() => handleViewPhoto(photo)}>
                    <img src={photo.url} alt="User content" />
                    {photo.status === 'approved' && (
                      <div className="admin-photo-status approved">
                        <FaCheck />
                      </div>
                    )}
                    {photo.status === 'rejected' && (
                      <div className="admin-photo-status rejected">
                        <FaTimes />
                      </div>
                    )}
                  </div>
                  <div className="admin-photo-card-info">
                    <div className="admin-photo-user">
                      {photo.user && (
                        <div className="admin-photo-user-details">
                          <div className="admin-photo-user-name">
                            {photo.user.nickname || 'Anonymous User'}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="admin-photo-date">
                      {formatDate(photo.createdAt)}
                    </div>
                  </div>
                  <div className="admin-photo-card-actions">
                    {filters.status === 'pending' || filters.status === 'all' ? (
                      <>
                        <button
                          onClick={() => handleApprovePhoto(photo._id)}
                          className="admin-photo-button approve"
                          disabled={photo.status === 'approved'}
                        >
                          <FaCheck /> Approve
                        </button>
                        <button
                          onClick={() => handleViewPhoto(photo)}
                          className="admin-photo-button reject"
                          disabled={photo.status === 'rejected'}
                        >
                          <FaTimes /> Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleViewPhoto(photo)}
                        className="admin-photo-button view"
                      >
                        <FaImage /> View
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {photos.length} of {pagination.totalPhotos} photos
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
        ) : (
          <div className="admin-no-data">
            <FaImage size={48} opacity={0.3} />
            <p>No photos found matching the criteria</p>
          </div>
        )}
      </div>
      
      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div className="admin-modal">
          <div className="admin-modal-content admin-photo-modal">
            <div className="admin-modal-header">
              <h2>
                {selectedPhoto.user
                  ? `Photo from ${selectedPhoto.user.nickname || 'Anonymous User'}`
                  : 'Photo Details'}
              </h2>
              <button className="admin-modal-close" onClick={closePhotoModal}>
                <FaTimes />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-photo-detail">
                <div className="admin-photo-detail-image">
                  <img src={selectedPhoto.url} alt="User content" />
                </div>
                <div className="admin-photo-detail-info">
                  <div className="admin-photo-detail-section">
                    <h4>Photo Information</h4>
                    <div className="admin-photo-detail-grid">
                      <div className="admin-photo-detail-field">
                        <span className="admin-photo-detail-label">ID</span>
                        <span className="admin-photo-detail-value">{selectedPhoto._id}</span>
                      </div>
                      <div className="admin-photo-detail-field">
                        <span className="admin-photo-detail-label">Uploaded</span>
                        <span className="admin-photo-detail-value">{formatDate(selectedPhoto.createdAt)}</span>
                      </div>
                      <div className="admin-photo-detail-field">
                        <span className="admin-photo-detail-label">Status</span>
                        <span className={`admin-status-badge ${selectedPhoto.status}`}>
                          {selectedPhoto.status.charAt(0).toUpperCase() + selectedPhoto.status.slice(1)}
                        </span>
                      </div>
                      {selectedPhoto.status === 'rejected' && selectedPhoto.rejectionReason && (
                        <div className="admin-photo-detail-field">
                          <span className="admin-photo-detail-label">Rejection Reason</span>
                          <span className="admin-photo-detail-value">{selectedPhoto.rejectionReason}</span>
                        </div>
                      )}
                      <div className="admin-photo-detail-field">
                        <span className="admin-photo-detail-label">Type</span>
                        <span className="admin-photo-detail-value">{selectedPhoto.photoType || 'Profile'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedPhoto.user && (
                    <div className="admin-photo-detail-section">
                      <h4>User Information</h4>
                      <div className="admin-photo-detail-grid">
                        <div className="admin-photo-detail-field">
                          <span className="admin-photo-detail-label">User ID</span>
                          <span className="admin-photo-detail-value">{selectedPhoto.user._id}</span>
                        </div>
                        <div className="admin-photo-detail-field">
                          <span className="admin-photo-detail-label">Name</span>
                          <span className="admin-photo-detail-value">
                            {selectedPhoto.user.nickname || 'Anonymous User'}
                          </span>
                        </div>
                        <div className="admin-photo-detail-field">
                          <span className="admin-photo-detail-label">Email</span>
                          <span className="admin-photo-detail-value">{selectedPhoto.user.email || 'N/A'}</span>
                        </div>
                        <div className="admin-photo-detail-field">
                          <span className="admin-photo-detail-label">Gender</span>
                          <span className="admin-photo-detail-value">
                            {selectedPhoto.user.gender || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedPhoto.status === 'pending' && (
                    <div className="admin-photo-detail-section">
                      <h4>Moderation</h4>
                      <div className="admin-form-group">
                        <label htmlFor="rejectionReason">Rejection Reason (optional)</label>
                        <select
                          id="rejectionReason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="admin-select"
                        >
                          <option value="">Select a reason</option>
                          <option value="Inappropriate content">Inappropriate content</option>
                          <option value="Not a real person">Not a real person</option>
                          <option value="Copyright violation">Copyright violation</option>
                          <option value="Nudity or sexual content">Nudity or sexual content</option>
                          <option value="Violence or offensive content">Violence or offensive content</option>
                          <option value="Spam or misleading">Spam or misleading</option>
                          <option value="Low quality image">Low quality image</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {rejectionReason === 'Other' && (
                        <div className="admin-form-group">
                          <label htmlFor="customReason">Custom Reason</label>
                          <textarea
                            id="customReason"
                            value={rejectionReason === 'Other' ? '' : rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="admin-textarea"
                            placeholder="Enter a custom rejection reason..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              {selectedPhoto.status === 'pending' && (
                <>
                  <button 
                    className="admin-button admin-button-success" 
                    onClick={() => handleApprovePhoto(selectedPhoto._id)}
                  >
                    <FaCheck /> Approve Photo
                  </button>
                  <button 
                    className="admin-button admin-button-danger" 
                    onClick={() => handleRejectPhoto(selectedPhoto._id, rejectionReason)}
                  >
                    <FaTimes /> Reject Photo
                  </button>
                </>
              )}
              <button 
                className="admin-button admin-button-secondary" 
                onClick={closePhotoModal}
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

export default AdminContentModeration;