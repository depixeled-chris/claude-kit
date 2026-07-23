// The route table (KIT-D044 phase-1 screens): / = the cross-project waiting board (landing),
// /p/:key = a project's kanban, /p/:key/t/:id = ticket detail. The Nav is always present.

import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import WaitingBoard from './pages/WaitingBoard';
import ProjectBoard from './pages/ProjectBoard';
import TicketDetail from './pages/TicketDetail';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<WaitingBoard />} />
          <Route path="/p/:key" element={<ProjectBoard />} />
          <Route path="/p/:key/t/:id" element={<TicketDetail />} />
        </Routes>
      </main>
    </div>
  );
}
