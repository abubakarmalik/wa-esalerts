import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  connectDatabase,
  selectAuthLoading,
  selectAuthError,
  selectAuthMessage,
} from '../features/auth/authSlice.js';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Connection = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formValues, setFormValues] = useState({
    serverName: '',
    databaseName: '',
    user: '',
    password: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading);
  const apiError = useSelector(selectAuthError);
  const apiMessage = useSelector(selectAuthMessage);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(connectDatabase(formValues));
  };

  useEffect(() => {
    if (apiMessage) {
      if (apiError) {
        toast.error(apiMessage);
      } else {
        toast.success(apiMessage);
      }
    }
  }, [apiMessage, apiError]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 pb-16">
        <div className="w-full max-w-lg">
          <div className="bg-white shadow-xl rounded-xl p-8">
            <h1 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Database Connection
            </h1>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="serverName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Server name
                </label>
                <input
                  id="serverName"
                  name="serverName"
                  type="text"
                  value={formValues.serverName}
                  onChange={handleChange}
                  placeholder="e.g. 127.0.0.1 or server.domain.com"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="databaseName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Database name
                </label>
                <input
                  id="databaseName"
                  name="databaseName"
                  type="text"
                  value={formValues.databaseName}
                  onChange={handleChange}
                  placeholder="e.g. my_database"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="user"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  User
                </label>
                <input
                  id="user"
                  name="user"
                  type="text"
                  value={formValues.user}
                  onChange={handleChange}
                  placeholder="e.g. admin"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formValues.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700 focus:outline-none"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
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
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.234.938-4.675M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.062-4.675A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10a9.956 9.956 0 01-4.675-.938M3 3l18 18"
                        />
                      </svg>
                    ) : (
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7-2s-4-7-10-7-10 7-10 7 4 7 10 7 10-7 10-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {apiMessage && (
                <p
                  className={`text-sm ${
                    apiError ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {apiMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-white font-medium shadow hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 active:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect database'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Connection;
