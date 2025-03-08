// src/pages/Admin/ModerationQueue.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { moderationService } from '../../services/moderationService';

function ModerationQueue() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        const data = await moderationService.fetchReports();
        setReports(data);
      } catch (err) {
        console.error('Error loading reports:', err);
        setError('Failed to load moderation queue.');
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleResolveReport = async (reportId, action) => {
    try {
      await moderationService.resolveReport(reportId, action);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      console.error('Error resolving report:', err);
    }
  };

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

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Moderation Queue</h1>
        {error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-gray-400 text-center">No pending reports</p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-gray-800 p-4 rounded-md">
                <p className="text-gray-300 mb-2">
                  <span className="font-semibold">Reported User:</span> {report.userName}
                </p>
                <p className="text-gray-300 mb-2">
                  <span className="font-semibold">Reason:</span> {report.reason}
                </p>
                <p className="text-gray-300 mb-4">
                  {report.details}
                </p>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-danger text-sm"
                    onClick={() => handleResolveReport(report.id, 'ban')}
                  >
                    Ban
                  </button>
                  <button
                    className="btn btn-primary text-sm"
                    onClick={() => handleResolveReport(report.id, 'warning')}
                  >
                    Warning
                  </button>
                  <button
                    className="btn btn-secondary text-sm"
                    onClick={() => handleResolveReport(report.id, 'dismiss')}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Navigation activeTab="profile" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
}

export default ModerationQueue;
