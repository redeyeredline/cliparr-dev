import React from 'react';
import SonarrTest from './components/SonarrTest.tsx';
import DatabaseTest from './components/DatabaseTest.tsx';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Cliparr</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <SonarrTest />
          <div className="mt-6">
            <DatabaseTest />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
