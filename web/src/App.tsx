import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScenarioHub from './pages/ScenarioHub';
import Conversation from './pages/Conversation';
import Report from './pages/Report';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route path="/" element={<ScenarioHub />} />
          <Route path="/conversation" element={<Conversation />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
