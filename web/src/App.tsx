import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import ScenarioHub from './pages/ScenarioHub';
import Progress from './pages/Progress';
import Achievements from './pages/Achievements';
import Profile from './pages/Profile';
import Conversation from './pages/Conversation';
import Report from './pages/Report';
import SessionDetail from './pages/SessionDetail';
import Login from './pages/Login';
import DevPreview from './pages/DevPreview';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 带导航壳层的页面（桌面侧栏 / 移动底栏） */}
        <Route element={<AppShell />}>
          <Route path="/" element={<ScenarioHub />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* 沉浸式全屏页面（无导航壳层） */}
        <Route path="/login" element={<Login />} />
        <Route path="/conversation" element={<Conversation />} />
        <Route path="/report" element={<Report />} />
        <Route path="/session/:id" element={<SessionDetail />} />
        <Route path="/preview" element={<DevPreview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
