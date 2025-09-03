import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/base-url.js';
import { logout } from '../features/auth/authSlice.js';

const Sidebar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isOpen, setIsOpen] = useState(() => {
    // Initialize from localStorage, default to true (expanded)
    const savedState = localStorage.getItem('sidebar_expanded');
    return savedState !== null ? JSON.parse(savedState) : true;
  });

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(isOpen));
  }, [isOpen]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const menuItems = [
    {
      name: 'Home',
      path: '/dashboard',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: 'Whatsapp Auto',
      path: '/auto-sender',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },

    {
      name: 'Broadcast',
      path: '/broadcast',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
      ),
    },
    {
      name: 'Comming Soon!',
      path: '/manual-sender',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      ),
    },
  ];

  const handleLogout = async () => {
    try {
      await api.post('/db/close', {});
      dispatch(logout());
      toast.success('Disconnected and logged out');
      navigate('/connection');
    } catch (error) {
      const msg =
        error?.response?.data?.message || error.message || 'Logout failed';
      toast.error(msg);
    }
  };

  const handleClickLogout = () => {
    setShowLogoutModal(true);
  };

  const openLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`h-screen bg-gray-200 shadow-xl flex flex-col transition-all duration-500 ease-in-out transform ${
          isOpen
            ? 'w-64 translate-x-0 opacity-100'
            : 'w-16 -translate-x-0 opacity-95'
        }`}
      >
        {/* Logo/Header section with toggle button */}
        <div
          className={`border-b border-gray-200 transition-all duration-500 ease-in-out ${
            isOpen ? 'p-6' : 'p-3'
          }`}
        >
          <div
            className={`flex items-center transition-all duration-500 ease-in-out ${
              isOpen ? 'justify-between' : 'justify-center'
            }`}
          >
            {isOpen && (
              <h3
                className="text-lg font-extrabold italic tracking-wide text-transparent bg-clip-text 
             bg-gradient-to-r from-gray-800 via-green-800 to-gray-900 
             drop-shadow-md hover:scale-105 transition-transform duration-500 ease-in-out"
              >
                WhatsApp Sender
              </h3>
            )}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-all duration-300 ease-in-out hover:scale-105"
              aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg
                className={`w-4 h-4 text-gray-700 transition-all duration-500 ease-in-out transform ${
                  isOpen ? 'rotate-180 scale-100' : 'rotate-0 scale-90'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
          {isOpen && (
            <div className="w-full border-b border-gray-400 my-2 transition-all duration-500 ease-in-out transform scale-x-100 origin-left"></div>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          className={`flex-1 transition-all duration-500 ease-in-out ${
            isOpen ? 'p-4 space-y-2' : 'p-2 space-y-1'
          }`}
        >
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center transition-all duration-300 ease-in-out rounded-lg hover:scale-105 ${
                isOpen ? 'space-x-3 px-4 py-2.5' : 'justify-center p-3'
              } ${
                location.pathname === item.path
                  ? 'bg-gray-900 text-white shadow-lg transform scale-105'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={!isOpen ? item.name : ''}
            >
              <div className="flex-shrink-0 transition-all duration-300 ease-in-out transform hover:scale-110">
                {item.icon}
              </div>
              {isOpen && (
                <span className="font-medium transition-all duration-500 ease-in-out transform opacity-100">
                  {item.name}
                </span>
              )}
            </Link>
          ))}

          {/* Logout Button */}
          <div className={isOpen ? '' : 'mt-4'}>
            <button
              onClick={handleClickLogout}
              className={`flex items-center transition-all duration-300 ease-in-out rounded-lg hover:scale-105 ${
                isOpen
                  ? 'space-x-3 w-full px-4 py-2.5'
                  : 'justify-center p-3 w-full'
              } text-gray-700 hover:bg-gray-100`}
              title={!isOpen ? 'Logout' : ''}
            >
              <div className="flex-shrink-0 transition-all duration-300 ease-in-out transform hover:scale-110">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              {isOpen && (
                <span className="font-medium transition-all duration-500 ease-in-out transform opacity-100">
                  Logout
                </span>
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with light blur effect */}
          <div
            className="absolute inset-0 bg-gray-500/30 backdrop-blur-sm transition-opacity"
            onClick={closeLogoutModal}
          ></div>

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4 transform transition-all">
            {/* Modal content */}
            <div className="flex items-start space-x-4">
              {/* Dynamic Icon based on state */}
              <div
                className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${
                  localStorage.getItem('wa_sender_running') === 'false'
                    ? 'bg-red-100'
                    : 'bg-yellow-100'
                }`}
              >
                {localStorage.getItem('wa_sender_running') === 'false' ? (
                  // Logout icon
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                ) : (
                  // Warning icon
                  <svg
                    className="h-6 w-6 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Conditional Content based on wa_sender_running */}
                {localStorage.getItem('wa_sender_running') === 'false' ? (
                  <>
                    {/* Logout Confirmation */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Confirm Logout
                    </h3>
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                      Are you sure you want to logout? This will close the
                      database connection & whatsapp session. You'll need to
                      reconnect to continue using the application.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={closeLogoutModal}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:red-500 transition-colors duration-200"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Warning: Process is Running */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Process is Running
                    </h3>
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                      The WhatsApp sender process is currently running. Please
                      stop it first before logging out to avoid any data loss or
                      connection issues.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={closeLogoutModal}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                      >
                        Got it
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
