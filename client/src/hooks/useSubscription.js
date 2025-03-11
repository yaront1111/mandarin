// src/hooks/useSubscription.js
import { useSelector, useDispatch } from 'react-redux';
import { showUpgradeModal, showSubscriptionModal } from '../store/uiSlice';

/**
 * Hook to check subscription status and handle premium features
 * @returns {Object} - Subscription utilities
 */
const useSubscription = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { stats } = useSelector(state => state.user);

  // Check if user has a premium subscription
  const isPremium = user?.subscription === 'premium';

  // Get daily likes remaining for free users
  const dailyLikesRemaining = isPremium ? Infinity : (stats?.dailyLikesRemaining || 3);

  // Function to prompt upgrade for specific features
  const promptUpgrade = (feature) => {
    dispatch(showUpgradeModal(feature));
  };

  // Function to show subscription modal
  const showSubscription = () => {
    dispatch(showSubscriptionModal());
  };

  // Function to check if user can perform a premium action
  const canPerformPremiumAction = (action, fallback) => {
    if (isPremium) {
      return true;
    }

    // If there's a custom fallback, use it (like checked match status)
    if (fallback && typeof fallback === 'function') {
      return fallback();
    }

    // Default: show upgrade modal and return false
    promptUpgrade(action);
    return false;
  };

  // Function to check if user can like more profiles
  const canLike = () => {
    if (isPremium) return true;
    if (dailyLikesRemaining > 0) return true;

    promptUpgrade('likes');
    return false;
  };

  return {
    isPremium,
    dailyLikesRemaining,
    promptUpgrade,
    showSubscription,
    canPerformPremiumAction,
    canLike
  };
};

export default useSubscription;
