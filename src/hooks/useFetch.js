// src/hooks/useFetch.js
import { useState, useEffect, useCallback } from 'react';
import useAuth from './useAuth';
import { API_TIMEOUT } from ',,/config/constants'; // Example usage of constants

/**
 * useFetch
 * A generic data fetching hook that can handle authenticated requests.
 *
 * @param {string} url - The endpoint URL
 * @param {object} options - Additional fetch options (method, headers, body, etc.)
 * @param {boolean} immediate - If true, fetch immediately on mount
 *
 * Returns { data, error, loading, refetch }
 */
export default function useFetch(url, options = {}, immediate = true) {
  const { authToken } = useAuth(); // If you need auth
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);

  const fetchData = useCallback(async (customUrl, customOptions) => {
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT);

      // Attach auth token to headers if you need it
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...customOptions.headers,
      };

      const response = await fetch(customUrl, {
        ...customOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out.');
      } else {
        setError(err.message);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // Refetch function allows manual triggers
  const refetch = useCallback(() => {
    fetchData(url, options);
  }, [url, options, fetchData]);

  // Automatic fetch on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, url, options]);

  return { data, error, loading, refetch };
}
