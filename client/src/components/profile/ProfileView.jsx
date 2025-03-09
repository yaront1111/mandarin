import React from 'react';
import PropTypes from 'prop-types';
import CompatibilityMeter from '../ui/CompatibilityMeter';
import InterestTags from './InterestTags';

const ProfileView = ({ profile }) => {
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-secondary">Select a match to view profile</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Banner and Profile Photo */}
      <div className="relative h-64 bg-gradient-to-br from-brand-purple to-brand-pink bg-opacity-50">
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
          <div className="w-32 h-32 rounded-full bg-bg-card p-1">
            <img
              src={profile.avatar || '/images/default-avatar.png'}
              alt={profile.firstName}
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="pt-20 px-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">
            {profile.firstName}, {profile.age}
          </h1>
          <p className="text-text-secondary">{profile.occupation}</p>
        </div>

        {/* Compatibility Meter */}
        <div className="flex flex-col items-center mb-8">
          <CompatibilityMeter score={profile.compatibilityScore || 85} />
        </div>

        {/* About Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-text-secondary">
            {profile.bio || "This user hasn't added a bio yet."}
          </p>
        </div>

        {/* Interests */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Interests</h2>
          <InterestTags
            interests={profile.interests || [
              'Photography', 'Music', 'Travel', 'Cooking', 'Art'
            ]}
          />
        </div>

        {/* Photos */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {profile.photos ? (
              profile.photos.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-bg-input">
                  <img
                    src={photo.url}
                    alt={`${profile.firstName}'s photo`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="col-span-3 py-4 text-center text-text-secondary">
                No photos yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ProfileView.propTypes = {
  profile: PropTypes.object
};

export default ProfileView;
