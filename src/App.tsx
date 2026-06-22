import react from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import DashboardView from './components/DashboardView';
import { ApiProvider } from './contexts/ApiContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ApiProvider>
      <Router>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/admin" element={<Layout><Admin /></Layout>} />
            <Route path="/test-feed" element={<Layout><DashboardView /></Layout>} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </ApiProvider>
  );
}

export default App;