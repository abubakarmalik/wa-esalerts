import React from 'react';
import Sidebar from '../components/sidebar.jsx';
import Branding from '../components/branding';
import ActiveTask from '../components/activeTask.jsx';

const AutoSender = () => {
  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Branding />
        <div className="p-8 pb-16">
          {/* Your main content goes here */}
          <div className="bg-gray-200 rounded-lg shadow-md p-6 mt-4">
            <div className="space-y-4 text-base-100">
              <ActiveTask />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoSender;
