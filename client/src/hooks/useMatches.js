import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMatches } from '../store/matchSlice';

export default function useMatches() {
  const dispatch = useDispatch();
  const { matches, loading, error } = useSelector((state) => state.match);

  useEffect(() => {
    dispatch(fetchMatches());
  }, [dispatch]);

  return { matches, loading, error };
}
