import React from 'react';
import { Navbar } from '../components';

const Home = () => {
  return (
    <div className="home-page">
      <Navbar />
      <div className="hero-section">
        <h1>Welcome to Mandarin</h1>
        <p>Connect with singles in your area</p>
        <div className="hero-buttons">
          <button className="btn btn-primary">Find Matches</button>
          <button className="btn btn-secondary">Learn More</button>
        </div>
      </div>
      <div className="features-section">
        <div className="feature">
          <h2>Meet New People</h2>
          <p>Browse profiles and connect with singles who share your interests</p>
        </div>
        <div className="feature">
          <h2>Private Photos</h2>
          <p>Control who sees your private photos with our permission system</p>
        </div>
        <div className="feature">
          <h2>Video Chat</h2>
          <p>Take your relationship to the next level with video calls</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
