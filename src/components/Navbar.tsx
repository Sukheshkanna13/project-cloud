import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, Volume2, Radio } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const Navbar = () => {
  const location = useLocation();
  const { isPolling, noiseData, lastUpdated } = useApi();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Volume2 className="w-7 h-7 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Urban Noise</span>
            </Link>
          </div>

          {/* Nav Links */}
          <div className="flex items-center space-x-6">
            {/* Live Status Indicator */}
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
              <Radio className={`w-4 h-4 ${isPolling ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
              <span>{noiseData.length} records</span>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  · {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>

            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/admin"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
