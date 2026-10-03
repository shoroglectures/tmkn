import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import StartupSplash from './components/StartupSplash';
import { useAuth } from './contexts/AuthContext';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const Section = lazy(() => import('./pages/Section'));
const Exam = lazy(() => import('./pages/Exam'));
const ExamsList = lazy(() => import('./pages/ExamsList'));
const Students = lazy(() => import('./pages/Students'));
const Plans = lazy(() => import('./pages/Plans'));
const FollowUp = lazy(() => import('./pages/FollowUp'));
const PlanDetail = lazy(() => import('./pages/PlanDetail'));
const CoursePlan = lazy(() => import('./pages/CoursePlan'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const AccessPending = lazy(() => import('./pages/AccessPending'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteView({ page: Page }) {
  return (
    <Suspense fallback={<div className="card p-10 text-center text-slate-400">جاري التحميل...</div>}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  const { loading: authLoading, profile } = useAuth();
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashElapsed(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (authLoading || !splashElapsed) return <StartupSplash />;

  return (
    <Routes>
      {/* عام */}
      <Route path="/login" element={<RouteView page={Login} />} />
      <Route path="/access-pending" element={<RouteView page={AccessPending} />} />
      <Route path="/student/:token" element={<RouteView page={StudentPortal} />} />
      <Route path="/plan/:token" element={<RouteView page={StudentPortal} />} />

      {/* محمي */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RouteView page={Dashboard} />} />
        <Route path="/courses" element={<RouteView page={Courses} />} />
        <Route path="/exams" element={<RouteView page={ExamsList} />} />
        <Route path="/exam/:id" element={<RouteView page={Exam} />} />
        <Route path="/section/:id" element={<RouteView page={Section} />} />
        <Route path="/students" element={<RouteView page={Students} />} />
        <Route path="/plans" element={<RouteView page={Plans} />} />
        <Route path="/follow-up" element={<RouteView page={FollowUp} />} />
        <Route path="/follow-up/:studentId" element={<RouteView page={FollowUp} />} />
        <Route path="/plans/:id" element={<RouteView page={PlanDetail} />} />
        <Route path="/course/:id/plan" element={<RouteView page={CoursePlan} />} />
        <Route path="/settings" element={<RouteView page={Settings} />} />
        <Route
          path="/admin"
          element={profile?.role === 'admin' ? <RouteView page={Admin} /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<RouteView page={NotFound} />} />
      </Route>
    </Routes>
  );
}