import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScenarioHub from './pages/ScenarioHub';
import Conversation from './pages/Conversation';
import Report from './pages/Report';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      {/* 各页面自行设置 min-h-screen 与背景，这里不再叠加渐变，避免视觉拼接 */}
      <Routes>
        <Route path="/" element={<ScenarioHub />} />
        <Route path="/login" element={<Login />} />
        <Route path="/conversation" element={<Conversation />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
