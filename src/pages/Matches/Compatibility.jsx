// src/pages/Matches/Compatibility.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Header from '../../components/layout/Header';
import Navigation from '../../components/layout/Navigation';
import { userService } from '../../services/userService';

function Compatibility() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [compatibilityData, setCompatibilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCompatibility() {
      try {
        setLoading(true);
        // e.g. GET /matches/:matchId/compatibility
        const data = await userService.getCompatibility(matchId);
        setCompatibilityData(data);
      } catch (err) {
        console.error('Error fetching compatibility:', err);
        setError('Failed to load compatibility data.');
      } finally {
        setLoading(false);
      }
    }
    fetchCompatibility();
  }, [matchId]);

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div className="main flex justify-center items-center">
          <LoadingSpinner size={40} color="var(--color-primary)" />
        </div>
        <Navigation
          activeTab="matches"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </div>
    );
  }

  if (error || !compatibilityData) {
    return (
      <div className="app-container">
        <Header />
        <div className="main p-4">
          <p className="text-red-500 mb-4 text-center">{error || 'No data'}</p>
          <button className="btn btn-primary mx-auto block" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
        <Navigation
          activeTab="matches"
          onTabChange={(tab) => navigate(`/${tab}`)}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main">
        <h1 className="text-xl font-bold mb-4">Kink Compatibility</h1>
        <p className="mb-4">Overall Score: {compatibilityData.score}%</p>

        {/* Show breakdown of factors */}
        {compatibilityData.factors?.map((factor) => (
          <div key={factor.name} className="mb-2">
            <p className="text-sm text-gray-300">
              {factor.name}: {factor.value}%
            </p>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-500"
                style={{ width: `${factor.value}%` }}
              ></div>
            </div>
          </div>
        ))}
      </main>
      <Navigation
        activeTab="matches"
        onTabChange={(tab) => navigate(`/${tab}`)}
      />
    </div>
  );
}

export default Compatibility;
