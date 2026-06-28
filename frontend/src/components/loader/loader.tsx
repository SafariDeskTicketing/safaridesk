import React from 'react';

export const Loader = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-white/50 dark:bg-[var(--overlay-bg)] transition-opacity duration-300">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 bg-primary-400 rounded-full opacity-50 animate-ping-slow"></div>
        <div className="absolute w-16 h-16 bg-primary-500 rounded-full opacity-50 animate-ping-slow" style={{ animationDelay: '0.5s' }}></div>
        <div className="w-8 h-8 bg-primary-600 rounded-full"></div>
      </div>
      <style>
        {`
          @keyframes ping-slow {
            0%, 100% {
              transform: scale(0.8);
              opacity: 0.5;
            }
            50% {
              transform: scale(1.5);
              opacity: 0;
            }
          }
          .animate-ping-slow {
            animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
        `}
      </style>
    </div>
  );
};
