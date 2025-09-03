import React from 'react';

const ProgressBar = ({ label = 'Processing…' }) => {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">Please wait</span>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 shadow-inner">
        {/* Base subtle fill */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/60 via-blue-100/50 to-blue-50/60" />
        {/* Shimmering moving bar */}
        <div className="absolute top-0 left-0 h-3 w-1/3 rounded-full bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.55)] animate-[bar-move_1.3s_ease-in-out_infinite]" />
        {/* Soft glow overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40" />
      </div>

      <style>{`
        @keyframes bar-move {
          0% { transform: translateX(-120%); }
          50% { transform: translateX(30%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;
