// src/context/ModerationContext.js
import React, {
  createContext, useState, useCallback
} from 'react';
import PropTypes from 'prop-types';
// import { submitReportService, blockUserService } from '@/services/moderationService';

export const ModerationContext = createContext();

export function ModerationProvider({ children }) {
  const [reports, setReports] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Example: handle user report
  const reportUser = useCallback((userId, reportData) => {
    // e.g., call your API service
    // submitReportService({ userId, ...reportData })
    //   .then(...)
    //   .catch(...)
    setReports((prev) => [...prev, { userId, ...reportData }]);
  }, []);

  // Example: block a user
  const blockUser = useCallback((userId) => {
    // blockUserService(userId);
    setBlockedUsers((prev) => [...prev, userId]);
  }, []);

  const contextValue = {
    reports,
    blockedUsers,
    reportUser,
    blockUser,
  };

  return (
    <ModerationContext.Provider value={contextValue}>
      {children}
    </ModerationContext.Provider>
  );
}

ModerationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
