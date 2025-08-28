import React from 'react';
import Sidebar from '../components/sidebar.jsx';
import Branding from '../components/branding';

const Broadcast = () => {
  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Branding />
        <div className="p-8 pb-16">
          {/* Your main content goes here */}
          <h1 className="text-2xl font-semibold text-gray-800">
            Sent Message to All
          </h1>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;
