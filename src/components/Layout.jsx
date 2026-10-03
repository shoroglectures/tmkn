import { Outlet } from 'react-router-dom';
import DateTimeBar from './DateTimeBar';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="mr-64 min-h-screen">
        <DateTimeBar className="sticky top-0 z-20 px-6 lg:px-8" />
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}