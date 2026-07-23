// The route table (KIT-D044 phase-1 screens): / = the cross-project waiting board (landing),
// /all = every project's kanban stacked (KIT-T144), /p/:key = a project's kanban, /p/:key/t/:id =
// ticket detail. The Nav is always present. Board routes (/all, /p/:key) get a full-bleed main so
// swimlanes claim all the width the screen offers — this is a data-driven UI, not a brochure
// (KIT-T144 scope-add); detail + waiting keep the readable centered column.

import { Routes, Route, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import WaitingBoard from './pages/WaitingBoard';
import AllBoards from './pages/AllBoards';
import ProjectBoard from './pages/ProjectBoard';
import ProjectSettings from './pages/ProjectSettings';
import TicketDetail from './pages/TicketDetail';
import './App.css';

// Board routes render full-width: /all and a single project board (/p/:key), but NOT ticket detail
// (/p/:key/t/:id) which stays a readable column.
function isBoardRoute(pathname: string): boolean {
  return pathname === '/all' || /^\/p\/[^/]+$/.test(pathname);
}

export default function App() {
  const { pathname } = useLocation();
  const wide = isBoardRoute(pathname);

  return (
    <div className="app">
      <Nav />
      <main className={wide ? 'main main--wide' : 'main'}>
        <Routes>
          <Route path="/" element={<WaitingBoard />} />
          <Route path="/all" element={<AllBoards />} />
          <Route path="/p/:key" element={<ProjectBoard />} />
          <Route path="/p/:key/settings" element={<ProjectSettings />} />
          <Route path="/p/:key/t/:id" element={<TicketDetail />} />
        </Routes>
      </main>
    </div>
  );
}
