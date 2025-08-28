import React from 'react';
import Sidebar from '../components/sidebar';
import Branding from '../components/branding';
import { Link } from 'react-router-dom';

const FeatureCard = ({ title, description, icon }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
    <div className="flex items-center justify-center w-12 h-12 bg-gray-50 rounded-lg mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm">{description}</p>
  </div>
);

const ActionButton = ({ title, icon, to }) => (
  <Link
    to={to}
    className="flex items-center justify-center space-x-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-300"
  >
    <span className="text-gray-600">{icon}</span>
    <span className="text-sm font-medium text-gray-700">{title}</span>
  </Link>
);

const Dashboard = () => {
  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Branding />
        <div className="p-8 pb-16">
          {/* Added padding at bottom to account for fixed footer */}
          {/* Header with Welcome Message */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to WhatsApp Automation
            </h1>
            <p className="text-gray-600">
              Streamline your communication with powerful automation tools
            </p>
          </div>
          {/* Quick Action Buttons */}
          <div className="flex justify-center gap-4 mb-12">
            <ActionButton
              to="/auto-sender"
              title="Auto Sender"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              }
            />
            <ActionButton
              to="/broadcast"
              title="Broadcast"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                  />
                </svg>
              }
            />
          </div>
          {/* Features Grid */}
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
              Key Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                title="Auto Message Sender"
                description="Schedule and automate your WhatsApp messages with ease"
                icon={
                  <svg
                    className="w-6 h-6 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
              <FeatureCard
                title="Bulk Broadcasting"
                description="Send messages to multiple contacts simultaneously"
                icon={
                  <svg
                    className="w-6 h-6 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                }
              />
              <FeatureCard
                title="Excel Management"
                description="Organize and manage your contacts efficiently"
                icon={
                  <svg
                    className="w-6 h-6 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                }
              />
            </div>
          </div>
          {/* Getting Started Section */}
          <div className="mt-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Getting Started
            </h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 text-white font-semibold">
                  1
                </div>
                <p className="text-gray-600">
                  Connect your WhatsApp account using the sidebar options
                </p>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 text-white font-semibold">
                  2
                </div>
                <p className="text-gray-600">
                  Create your first automated message sequence
                </p>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 text-white font-semibold">
                  3
                </div>
                <p className="text-gray-600">
                  Start broadcasting messages to your contacts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
