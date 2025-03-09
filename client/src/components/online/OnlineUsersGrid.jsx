// src/components/online/OnlineUsersGrid.jsx
import React, { useEffect, useState } from 'react';
import UserCard from '../ui/UserCard';

const OnlineUsersGrid = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const response = await fetch('/users/online'); // adjust endpoint as needed
        const data = await response.json();
        setOnlineUsers(data);
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    fetchOnlineUsers();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-text-primary">Online Now</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {onlineUsers.map(user => (
          <UserCard key={user.id} user={user} onClick={() => console.log(`Clicked ${user.firstName}`)} />
        ))}
      </div>
    </div>
  );
};

export default OnlineUsersGrid;
