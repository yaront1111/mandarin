// src/components/profile/PhotoManager.jsx
import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import photoService from '../../services/photoService';

const PhotoManager = ({ photos, onPhotosUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection for upload
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // Process each file
      const uploadPromises = files.map(async (file, index) => {
        // Create a mock progress update
        const updateProgress = () => {
          setUploadProgress(prev =>
            Math.min(prev + (100 / files.length / 10), (index + 1) * (100 / files.length))
          );
        };

        // Simulate progress (in real app, you'd use XHR to track actual progress)
        const progressInterval = setInterval(updateProgress, 200);

        try {
          const newPhoto = await photoService.uploadPhoto(file, isPrivate, { caption: '' });
          clearInterval(progressInterval);
          return newPhoto;
        } catch (error) {
          clearInterval(progressInterval);
          throw error;
        }
      });

      // Wait for all uploads to complete
      const newPhotos = await Promise.all(uploadPromises);

      // Update the parent component with new photos
      onPhotosUpdate([...photos, ...newPhotos]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      // Show an error notification (you can integrate with your notification system)
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setIsPrivate(false);
    }
  };

  // Handle manual reordering using arrow buttons instead of drag-drop
  const movePhoto = (photoId, direction) => {
    const index = photos.findIndex(photo => photo.id === photoId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const newPhotos = [...photos];
      [newPhotos[index], newPhotos[index - 1]] = [newPhotos[index - 1], newPhotos[index]];
      onPhotosUpdate(newPhotos);

      // Update order on server
      const photoIds = newPhotos.map(photo => photo.id);
      photoService.updatePhotoOrder(photoIds).catch(err => {
        console.error('Error updating photo order:', err);
        onPhotosUpdate(photos); // Revert on error
      });
    } else if (direction === 'down' && index < photos.length - 1) {
      const newPhotos = [...photos];
      [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
      onPhotosUpdate(newPhotos);

      // Update order on server
      const photoIds = newPhotos.map(photo => photo.id);
      photoService.updatePhotoOrder(photoIds).catch(err => {
        console.error('Error updating photo order:', err);
        onPhotosUpdate(photos); // Revert on error
      });
    }
  };

  // Photo deletion
  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;

    try {
      await photoService.deletePhoto(photoId);
      onPhotosUpdate(photos.filter(photo => photo.id !== photoId));
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    }
  };

  // Photo visibility toggle
  const togglePhotoPrivacy = async (photoId, currentStatus) => {
    try {
      await photoService.updatePhoto(photoId, { isPrivate: !currentStatus });
      onPhotosUpdate(photos.map(photo =>
        photo.id === photoId
          ? { ...photo, isPrivate: !currentStatus }
          : photo
      ));
    } catch (error) {
      console.error('Error updating photo privacy:', error);
      alert('Failed to update photo privacy. Please try again.');
    }
  };

  // Photo modal for viewing/editing details
  const openPhotoDetails = (photo) => {
    setSelectedPhotoId(photo.id);
    setPhotoCaption(photo.caption || '');
  };

  const closePhotoDetails = () => {
    setSelectedPhotoId(null);
    setPhotoCaption('');
  };

  const savePhotoDetails = async () => {
    try {
      await photoService.updatePhoto(selectedPhotoId, { caption: photoCaption });
      onPhotosUpdate(photos.map(photo =>
        photo.id === selectedPhotoId
          ? { ...photo, caption: photoCaption }
          : photo
      ));
      closePhotoDetails();
    } catch (error) {
      console.error('Error updating photo details:', error);
      alert('Failed to update photo details. Please try again.');
    }
  };

  // Get the currently selected photo
  const selectedPhoto = photos.find(p => p.id === selectedPhotoId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-text-primary">My Photos</h2>
        <div className="flex gap-3">
          <label className="inline-flex items-center text-text-secondary text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={() => setIsPrivate(!isPrivate)}
              className="mr-2 h-4 w-4 text-brand-pink rounded border-gray-300 focus:ring-brand-pink"
            />
            Private Upload
          </label>
          <label
            className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 cursor-pointer"
          >
            Add Photos
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="mb-4">
          <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-pink"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-text-secondary text-sm mt-1">Uploading photos... {Math.round(uploadProgress)}%</p>
        </div>
      )}

      {/* Photo Grid without DnD */}
      {photos.length === 0 ? (
        <div className="bg-bg-card p-10 rounded-lg border-2 border-dashed border-gray-700 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-input flex items-center justify-center text-text-secondary">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-text-secondary mb-4">No photos yet. Add photos to improve your profile!</p>
          <label
            className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 cursor-pointer inline-block"
          >
            Upload Photos
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="aspect-square relative rounded-lg overflow-hidden group"
            >
              <img
                src={photo.url}
                alt={photo.caption || "Profile photo"}
                className="w-full h-full object-cover"
              />

              {/* Optional caption */}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-sm truncate">
                  {photo.caption}
                </div>
              )}

              {/* Private indicator */}
              {photo.isPrivate && (
                <div className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}

              {/* Reorder controls */}
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => movePhoto(photo.id, 'up')}
                  disabled={index === 0}
                  className={`w-8 h-8 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white ${index === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-70'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => movePhoto(photo.id, 'down')}
                  disabled={index === photos.length - 1}
                  className={`w-8 h-8 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white ${index === photos.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-70'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Action overlay - visible on hover */}
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openPhotoDetails(photo)}
                  className="w-10 h-10 rounded-full bg-bg-dark bg-opacity-60 flex items-center justify-center text-white"
                  title="Edit details"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18.5 2.49998C18.8978 2.10216 19.4374 1.87866 20 1.87866C20.5626 1.87866 21.1022 2.10216 21.5 2.49998C21.8978 2.89781 22.1213 3.43737 22.1213 3.99998C22.1213 4.56259 21.8978 5.10216 21.5 5.49998L12 15L8 16L9 12L18.5 2.49998Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => togglePhotoPrivacy(photo.id, photo.isPrivate)}
                  className="w-10 h-10 rounded-full bg-bg-dark bg-opacity-60 flex items-center justify-center text-white"
                  title={photo.isPrivate ? "Make public" : "Make private"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {photo.isPrivate ? (
                      <path d="M8 11V7C8 5.93913 8.42143 4.92172 9.17157 4.17157C9.92172 3.42143 10.9391 3 12 3C13.0609 3 14.0783 3.42143 14.8284 4.17157C15.5786 4.92172 16 5.93913 16 7V11M5 11H19C20.1046 11 21 11.8954 21 13V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V13C3 11.8954 3.89543 11 5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    ) : (
                      <path d="M15 11V7C15 5.93913 14.5786 4.92172 13.8284 4.17157C13.0783 3.42143 12.0609 3 11 3C9.93913 3 8.92172 3.42143 8.17157 4.17157C7.42143 4.92172 7 5.93913 7 7M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="w-10 h-10 rounded-full bg-bg-dark bg-opacity-60 flex items-center justify-center text-white hover:text-error"
                  title="Delete photo"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* Add More Photos button */}
          <div className="aspect-square rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-brand-pink transition-colors">
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-text-secondary mb-2">
                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-text-secondary text-sm">Add Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Photo Details Modal */}
      {selectedPhotoId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-lg overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
              <h3 className="text-xl font-bold text-text-primary">Photo Details</h3>
              <button
                onClick={closePhotoDetails}
                className="text-text-secondary hover:text-text-primary"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="flex-grow overflow-auto p-4">
              <div className="aspect-square max-h-80 mb-4 mx-auto">
                <img
                  src={selectedPhoto?.url}
                  alt="Selected photo"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="photoCaption" className="block text-text-primary mb-1 font-medium">
                  Caption
                </label>
                <input
                  id="photoCaption"
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Add a caption to this photo"
                  className="w-full p-3 bg-bg-input rounded-lg border border-gray-700 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-pink"
                />
              </div>

              <div className="flex items-center">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPhoto?.isPrivate}
                    onChange={() => togglePhotoPrivacy(selectedPhoto?.id, selectedPhoto?.isPrivate)}
                    className="mr-2 h-4 w-4 text-brand-pink rounded border-gray-300 focus:ring-brand-pink"
                  />
                  <span className="text-text-secondary">Private Photo</span>
                </label>
                <p className="text-text-secondary text-xs ml-2 italic">
                  Private photos are only visible to users you grant access to.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={closePhotoDetails}
                className="px-4 py-2 border border-gray-700 rounded-md text-text-secondary mr-2 hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={savePhotoDetails}
                className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

PhotoManager.propTypes = {
  photos: PropTypes.array.isRequired,
  onPhotosUpdate: PropTypes.func.isRequired,
};

export default PhotoManager;
