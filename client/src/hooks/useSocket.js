import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function useSocket(token) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (token && !socketRef.current) {
      // Connect to Socket.IO with token
      socketRef.current = io('http://localhost:5000', {
        auth: { token }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token]);

  return socketRef.current;
}
