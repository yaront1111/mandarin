import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyProfile, updateMyProfile } from '../store/profileSlice';

export default function useProfile() {
  const dispatch = useDispatch();
  const { profile, loading, error } = useSelector((state) => state.profile);

  useEffect(() => {
    dispatch(fetchMyProfile());
  }, [dispatch]);

  const saveProfile = (data) => {
    dispatch(updateMyProfile(data));
  };

  return { profile, loading, error, saveProfile };
}
