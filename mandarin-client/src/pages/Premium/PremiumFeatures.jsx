// src/pages/Premium/PremiumFeatures.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { USER_ROLES, ROLE_PERMISSIONS } from '../../config/constants';

function PremiumFeatures() {
  const navigate = useNavigate();

  const tiers = [
    { role: USER_ROLES.FREE, label: 'Free', permissions: ROLE_PERMISSIONS[USER_ROLES.FREE] },
    { role: USER_ROLES.PREMIUM, label: 'Premium', permissions: ROLE_PERMISSIONS[USER_ROLES.PREMIUM] },
    { role: USER_ROLES.PREMIUM_PLUS, label: 'Premium Plus', permissions: ROLE_PERMISSIONS[USER_ROLES.PREMIUM_PLUS] },
  ];

  const handleUpgrade = (role) => {
    // Possibly call userService.upgradeRole(role) or payment flow
    console.log('Upgrade to:', role);
  };

  return (
    <div className="app-container">
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Premium Plans</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <div key={tier.role} className="bg-gray-800 p-4 rounded-lg flex flex-col items-start">
              <h2 className="text-lg font-semibold mb-2">{tier.label}</h2>
              <ul className="text-sm text-gray-300 mb-4">
                <li>Max Private Photos: {tier.permissions.maxPrivatePhotos === -1 ? 'Unlimited' : tier.permissions.maxPrivatePhotos}</li>
                <li>Max Likes per Day: {tier.permissions.maxLikesPerDay === -1 ? 'Unlimited' : tier.permissions.maxLikesPerDay}</li>
                <li>Map Feature: {tier.permissions.canAccessMapFeature ? 'Yes' : 'No'}</li>
                <li>Max Message Threads: {tier.permissions.maxMessageThreads === -1 ? 'Unlimited' : tier.permissions.maxMessageThreads}</li>
              </ul>
              {tier.role !== USER_ROLES.FREE && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleUpgrade(tier.role)}
                >
                  Upgrade to {tier.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
      <ErrorBoundary>
        <Navigation
          activeTab="profile"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </ErrorBoundary>
    </div>
  );
}

export default PremiumFeatures;
