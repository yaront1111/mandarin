import React from 'react';
import { FaFile, FaImage, FaFileAlt, FaFilePdf, FaFileAudio, FaFileVideo, FaDownload } from 'react-icons/fa';

/**
 * FileMessage component - Renders a file message with appropriate icon and preview
 * 
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object with file metadata
 * @returns {React.ReactElement} The file message component
 */
const FileMessage = ({ message }) => {
  // Get file info from message metadata
  const {
    fileUrl,
    fileName = 'File',
    fileSize,
    mimeType,
    dimensions
  } = message.metadata || {};
  
  // Format file size to human-readable format
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };
  
  // Get appropriate icon for file type
  const getFileIcon = () => {
    if (!mimeType) return <FaFile />;
    
    if (mimeType.startsWith('image/')) return <FaImage />;
    if (mimeType.startsWith('text/')) return <FaFileAlt />;
    if (mimeType.includes('pdf')) return <FaFilePdf />;
    if (mimeType.startsWith('audio/')) return <FaFileAudio />;
    if (mimeType.startsWith('video/')) return <FaFileVideo />;
    
    return <FaFile />;
  };
  
  // Render image preview if it's an image
  const renderPreview = () => {
    if (mimeType && mimeType.startsWith('image/') && fileUrl) {
      return (
        <div className="image-preview">
          <img 
            src={fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`} 
            alt={fileName}
            loading="lazy"
          />
        </div>
      );
    }
    
    // For non-image files, show icon and metadata
    return (
      <div className="file-preview">
        <div className="file-icon">{getFileIcon()}</div>
        <div className="file-info">
          <div className="file-name">{fileName}</div>
          {fileSize && <div className="file-size">{formatFileSize(fileSize)}</div>}
        </div>
        <a 
          href={fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="download-icon"
          title="Download file"
        >
          <FaDownload />
        </a>
      </div>
    );
  };
  
  return (
    <div className="file-message">
      {renderPreview()}
      
      {/* Add styling */}
      <style jsx>{`
        .file-message {
          width: 100%;
        }
        
        .image-preview {
          max-width: 300px;
          max-height: 300px;
          overflow: hidden;
          border-radius: 8px;
        }
        
        .image-preview img {
          width: 100%;
          height: auto;
          object-fit: contain;
          display: block;
        }
        
        .file-preview {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          background-color: rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          gap: 0.5rem;
        }
        
        .file-icon {
          font-size: 1.5rem;
          color: var(--primary);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .file-info {
          flex: 1;
          min-width: 0;
        }
        
        .file-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 170px;
        }
        
        .file-size {
          font-size: 0.75rem;
          color: var(--text-light);
        }
        
        .download-icon {
          font-size: 1rem;
          color: var(--text-light);
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background-color: transparent;
          transition: background-color 0.2s;
        }
        
        .download-icon:hover {
          background-color: rgba(0, 0, 0, 0.05);
          color: var(--primary);
        }
        
        /* Dark mode */
        .dark .file-preview {
          background-color: rgba(255, 255, 255, 0.05);
        }
        
        .dark .download-icon:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default FileMessage;