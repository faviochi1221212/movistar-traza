import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TrazaDrawer from './TrazaDrawer';

export default function Layout() {
  const [trazaOpen, setTrazaOpen] = useState(false);
  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', background: '#F5F7FA', fontFamily: "'Helvetica Neue',Helvetica,Arial,system-ui,sans-serif", color: '#1A2433', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <Header onOpenTraza={() => setTrazaOpen(true)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 40px' }}>
          <Outlet />
        </div>
      </div>
      <TrazaDrawer open={trazaOpen} onClose={() => setTrazaOpen(false)} />
    </div>
  );
}
