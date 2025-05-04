// src/components/chat/FileAttachmentHandler.jsx
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { FaSpinner } from 'react-icons/fa';
import styles from '../../styles/Messages.module.css';

/**
 * Handles file attachment selection and display of upload progress
 */
const FileAttachmentHandler = ({
  onFileSelected,
  isUploading = false,
  uploadProgress = 0,
  showProgress = false,
  acceptedFileTypes = "*"
}) => {
  const fileInputRef = useRef(null);

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        accept={acceptedFileTypes}
        aria-label="Upload file"
      />

      {showProgress && isUploading && (
        <div className={styles.uploadProgressContainer} role="progressbar" 
             aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">
          <div className={styles.uploadProgressLabel}>
            <FaSpinner className="fa-spin" /> Uploading: {Math.round(uploadProgress)}%
          </div>
          <div className={styles.uploadProgressBar}>
            <div 
              className={styles.uploadProgressFill} 
              style={{ width: `${uploadProgress}%` }} 
            />
          </div>
        </div>
      )}
    </>
  );
};

FileAttachmentHandler.propTypes = {
  onFileSelected: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  uploadProgress: PropTypes.number,
  showProgress: PropTypes.bool,
  acceptedFileTypes: PropTypes.string,
};

export default React.memo(FileAttachmentHandler);