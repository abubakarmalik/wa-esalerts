import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from './features/auth/authSlice.js';
import { ToastContainer } from 'react-toastify';
import Spinner from './components/spinner.jsx';
import Connection from './layouts/connection.jsx';
import AutoSender from './layouts/autoSender.jsx';
import Broadcast from './layouts/broadcast.jsx';
import Dashboard from './layouts/Dashboard.jsx';
import Footer from './components/footer.jsx';

function App() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    // Ensure auth state is respected on hard refreshes
    // If not authenticated and trying to access protected routes, navigate is handled by Routes below
    setNavigating(true);
    const id = setTimeout(() => setNavigating(false), 350);
    return () => clearTimeout(id);
  }, [location]);

  return (
    <div className="min-h-screen">
      <ToastContainer
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />
      <Spinner show={navigating} />
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/connection" replace />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard />
            ) : (
              <Navigate to="/connection" replace />
            )
          }
        />
        <Route path="/connection" element={<Connection />} />
        <Route
          path="/auto-sender"
          element={
            isAuthenticated ? (
              <AutoSender />
            ) : (
              <Navigate to="/connection" replace />
            )
          }
        />
        <Route
          path="/broadcast"
          element={
            isAuthenticated ? (
              <Broadcast />
            ) : (
              <Navigate to="/connection" replace />
            )
          }
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/connection" replace />
            )
          }
        />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
