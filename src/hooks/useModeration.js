// src/hooks/useModeration.js
import { useContext } from 'react';
import { ModerationContext } from '@/context/ModerationContext';

/**
 * useModeration
 * A convenience hook wrapping ModerationContext values/methods.
 *
 * - reportUser(userId, reportData)
 * - blockUser(userId)
 * - reports
 * - blockedUsers
 */
export default function useModeration() {
  const {
    reports,
    blockedUsers,
    reportUser,
    blockUser,
  } = useContext(ModerationContext);

  return {
    reports,
    blockedUsers,
    reportUser,
    blockUser,
  };
}
