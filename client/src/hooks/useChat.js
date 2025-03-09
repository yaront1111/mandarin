import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMessages, sendMessage } from '../store/chatSlice';

export default function useChat(matchId) {
  const dispatch = useDispatch();
  const { messagesByMatch, loading, error } = useSelector((state) => state.chat);
  const [localMatchId] = useState(matchId);

  useEffect(() => {
    if (localMatchId) {
      dispatch(fetchMessages(localMatchId));
    }
  }, [dispatch, localMatchId]);

  const onSendMessage = (content) => {
    dispatch(sendMessage({ matchId: localMatchId, content }));
  };

  const messages = messagesByMatch[localMatchId] || [];

  return { messages, loading, error, onSendMessage };
}
