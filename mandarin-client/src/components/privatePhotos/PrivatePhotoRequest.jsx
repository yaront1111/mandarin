// src/components/privatePhotos/PrivatePhotoRequest.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Displays a button to request or manage access to private photos.
 * - If already requested, shows a different label/state.
 */
function PrivatePhotoRequest({
  hasRequested,
  onRequestAccess,
  onCancelRequest
}) {
  const handleClick = () => {
    if (hasRequested) {
      onCancelRequest();
    } else {
      onRequestAccess();
    }
  };

  return (
    <button
      type="button"
      className={`private-photo-request ${hasRequested ? 'requested' : ''}`}
      onClick={handleClick}
    >
      <span className={`private-photo-icon ${hasRequested ? 'requested' : 'not-requested'}`}>
        {hasRequested ? '✅' : '🔒'}
      </span>
      <span className="text-xs">
        {hasRequested ? 'Requested' : 'Request Private'}
      </span>
    </button>
  );
}

PrivatePhotoRequest.propTypes = {
  /** Whether access has already been requested */
  hasRequested: PropTypes.bool,
  /** Called when user clicks to request access */
  onRequestAccess: PropTypes.func,
  /** Called when user clicks to cancel an existing request */
  onCancelRequest: PropTypes.func,
};

PrivatePhotoRequest.defaultProps = {
  hasRequested: false,
  onRequestAccess: () => {},
  onCancelRequest: () => {},
};

export default PrivatePhotoRequest;
