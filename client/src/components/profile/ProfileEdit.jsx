// src/components/profile/ProfileEdit.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';

const ProfileEdit = ({ profile, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    bio: profile?.bio || '',
    occupation: profile?.occupation || '',
    interests: profile?.interests || [],
    // Add more fields as needed
  });

  const [interestInput, setInterestInput] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddInterest = () => {
    if (!interestInput.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      interests: [...prev.interests, interestInput.trim()]
    }));
    setInterestInput('');
  };

  const handleRemoveInterest = (index) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="bio" className="block text-text-primary font-medium mb-2">
          About Me
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          value={formData.bio}
          onChange={handleChange}
          placeholder="Tell others about yourself..."
          className="w-full p-3 bg-bg-input rounded-lg border border-gray-700
                   text-text-primary placeholder:text-text-secondary
                   focus:outline-none focus:ring-1 focus:ring-brand-pink resize-none"
        />
      </div>

      <div>
        <label htmlFor="occupation" className="block text-text-primary font-medium mb-2">
          Occupation
        </label>
        <input
          type="text"
          id="occupation"
          name="occupation"
          value={formData.occupation}
          onChange={handleChange}
          placeholder="What do you do?"
          className="w-full p-3 bg-bg-input rounded-lg border border-gray-700
                   text-text-primary placeholder:text-text-secondary
                   focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
      </div>

      <div>
        <label className="block text-text-primary font-medium mb-2">
          Interests
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {formData.interests.map((interest, index) => (
            <div key={index} className="group px-3 py-1 bg-bg-input rounded-full text-sm flex items-center">
              {interest}
              <button
                type="button"
                onClick={() => handleRemoveInterest(index)}
                className="ml-2 w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-white opacity-70 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex">
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            placeholder="Add an interest..."
            className="flex-1 p-3 bg-bg-input rounded-l-lg border border-gray-700
                     text-text-primary placeholder:text-text-secondary
                     focus:outline-none focus:ring-1 focus:ring-brand-pink"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
          />
          <button
            type="button"
            onClick={handleAddInterest}
            className="px-4 bg-brand-pink text-white rounded-r-lg hover:bg-opacity-90"
          >
            Add
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 rounded-md bg-transparent border border-gray-600 text-text-primary hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 rounded-md bg-brand-pink text-white hover:bg-opacity-90 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

ProfileEdit.propTypes = {
  profile: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default ProfileEdit;
