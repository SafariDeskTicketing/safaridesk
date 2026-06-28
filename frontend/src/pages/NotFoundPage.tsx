// import React from 'react';
// import { Link } from 'react-router-dom';

// const NotFoundPage: React.FC = () => {
//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-surface text-gray-900 dark:text-[var(--text-primary)] flex flex-col items-center justify-center">
//       <h1 className="text-6xl font-bold text-gray-800 dark:text-[var(--text-primary)] mb-4">404</h1>
//       <p className="text-xl text-gray-600 dark:text-[var(--text-primary)] mb-8">Page Not Found</p>
//       <Link to="/" className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
//         Go to Homepage
//       </Link>
//     </div>
//   );
// };

// export default NotFoundPage;


import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft, FileX, AlertTriangle } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-surface dark:via-surface-elevated dark:to-surface text-gray-900 dark:text-[var(--text-primary)] flex flex-col items-center justify-center px-4">
      {/* Main Content Container */}
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <FileX className="w-16 h-16 text-red-500 dark:text-red-400" />
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-bounce" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-400 rounded-full animate-pulse" />
        </div>

        {/* 404 Text */}
        <div className="mb-6">
          <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-2">
            404
          </h1>
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-[var(--text-primary)]">
              Page Not Found
            </h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-[var(--text-primary)] leading-relaxed">
            Oops! The page you're looking for seems to have wandered off into the digital void.
          </p>
        </div>

        {/* Suggestions Box */}
        <div className="bg-white dark:bg-surface-elevated rounded-xl shadow-lg border border-gray-200 dark:border-subtle p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-[var(--text-primary)] mb-4">
            What you can do:
          </h3>
          <ul className="text-left space-y-3 text-gray-600 dark:text-[var(--text-primary)]">
            <li className="flex items-start">
              <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3 flex-shrink-0" />
              <span>Check if the URL is spelled correctly</span>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
              <span>Go back to the previous page</span>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0" />
              <span>Visit our homepage to start fresh</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>
          
          <Link
            to="/"
            className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Homepage
          </Link>
        </div>

        {/* Search Suggestion */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-center text-blue-700 dark:text-blue-300">
            <Search className="w-4 h-4 mr-2" />
            <span className="text-sm">
              Can't find what you're looking for? Try using the search feature.
            </span>
          </div>
        </div>
      </div>

      {/* Floating Animation Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary-400 rounded-full animate-ping opacity-75" />
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-blue-400 rounded-full animate-bounce opacity-50" />
        <div className="absolute top-1/2 left-1/6 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-60" />
        <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-40" />
      </div>
    </div>
  );
};

export default NotFoundPage;