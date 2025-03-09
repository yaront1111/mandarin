// src/hooks/useProfile.js
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

/**
 * Custom hook to manage profile data
 * This is a basic implementation that can be expanded with API calls
 */
const useProfile = () => {
  const { user } = useSelector(state => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulate fetching profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // In a real app, you would fetch from your API
        // For now, we'll simulate a delay and use the auth user data
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Create a sample profile based on user data
        // In a real app, you would fetch this from your API
        const mockProfile = {
          id: user.id,
          firstName: user.firstName,
          age: 27, // Mock data
          bio: "I love hiking and photography. Always looking for new adventures!",
          occupation: "Software Developer",
          interests: ["Hiking", "Photography", "Cooking", "Travel"],
          avatar: user.avatar,
          photos: [
            // These would come from your API in a real app
          ],
          compatibilityScore: 85
        };

        setProfile(mockProfile);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Function to save profile changes
  const saveProfile = async (updatedData) => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, you would send this to your API
      // For now, we'll simulate a delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update local state with new data
      setProfile(prev => ({
        ...prev,
        ...updatedData
      }));

      // Here you would typically make an API call:
      // await api.updateProfile(user.id, updatedData);

    } catch (err) {
      setError('Failed to save profile changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    error,
    saveProfile
  };
};

export default useProfile;
