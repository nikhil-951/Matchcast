import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { MatchProvider } from './context/MatchContext';
import { LandingPage } from './pages/LandingPage';
import { MatchesPage } from './pages/MatchesPage';
import { MatchCentrePage } from './pages/MatchCentrePage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <MatchProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchCentrePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MatchProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
