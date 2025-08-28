import React from 'react';
import favicon from '../assets/favicon.png';

const Spinner = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <img
        src={favicon}
        alt="Loading"
        className="h-10 w-10 animate-spin [animation-duration:1200ms]"
        style={{ animationTimingFunction: 'linear' }}
      />
    </div>
  );
};

export default Spinner;
