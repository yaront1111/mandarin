// src/pages/Admin/Analytics.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { adminService } from '../../services/adminService';

function Analytics() {
  const navigate = useNavigate();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const data = await adminService.getAnalytics();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
        <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Analytics</h1>
        {/* Render charts or data tables */}
        {analyticsData && (
          <div className="space-y-4">
            {/* Example data */}
            <p>Total Logins: {analyticsData.totalLogins}</p>
            <p>New Registrations (30 days): {analyticsData.newRegistrations}</p>
            {/* Possibly use a chart library */}
          </div>
        )}
      </main>
      <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
}

export default Analytics;
