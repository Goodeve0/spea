import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import BuddyInboxPoller from './components/BuddyInboxPoller';
import BuddyInviteBanner from './components/BuddyInviteBanner';
import BuddyToast from './components/BuddyToast';

// ── 重量级页面懒加载（code-splitting）──────────────────────────────────────
// Home 是首屏，保持同步加载以避免 FCP 延迟
import Home from './pages/Home';

const ScenarioHub  = lazy(() => import('./pages/ScenarioHub'));
const Progress     = lazy(() => import('./pages/Progress'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Vocab        = lazy(() => import('./pages/Vocab'));
const Profile      = lazy(() => import('./pages/Profile'));
const Conversation = lazy(() => import('./pages/Conversation'));
const Report       = lazy(() => import('./pages/Report'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const Buddies      = lazy(() => import('./pages/Buddies'));
const LiveRoom     = lazy(() => import('./pages/LiveRoom'));
const Login        = lazy(() => import('./pages/Login'));
const DevPreview   = lazy(() => import('./pages/DevPreview'));

/** 全局 Loading 占位（轻量，避免 flash） */
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center text-neutral-400 text-sm">
      Loading…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <BuddyInboxPoller />
      <BuddyInviteBanner />
      <BuddyToast />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 带导航壳层的页面（桌面侧栏 / 移动底栏） */}
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/practice" element={<ScenarioHub />} />
            <Route path="/vocab" element={<Vocab />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/buddies" element={<Buddies />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* 沉浸式全屏页面（无导航壳层） */}
          <Route path="/login" element={<Login />} />
          <Route path="/conversation" element={<Conversation />} />
          <Route path="/report" element={<Report />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/room/:id" element={<LiveRoom />} />
          <Route path="/preview" element={<DevPreview />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
