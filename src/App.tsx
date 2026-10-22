import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

// Public pages are code-split so each visit only downloads what it needs.
const HomePage = lazy(() => import('./pages/HomePage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const LatestJobsPage = lazy(() => import('./pages/LatestJobsPage'));
const ClosingSoonPage = lazy(() => import('./pages/ClosingSoonPage'));
const ExpiredJobsPage = lazy(() => import('./pages/ExpiredJobsPage'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'));
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AboutPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.ContactPage })));
const DisclaimerPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.DisclaimerPage })));
const PrivacyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.TermsPage })));

// Admin code is split into separate chunks so it never weighs down the public site.
const AdminRoot = lazy(() => import('./admin/AdminRoot'));
const RequireAuth = lazy(() => import('./admin/RequireAuth'));
const LoginPage = lazy(() => import('./admin/LoginPage'));
const DashboardPage = lazy(() => import('./admin/DashboardPage'));
const JobsListPage = lazy(() => import('./admin/JobsListPage'));
const JobFormPage = lazy(() => import('./admin/JobFormPage'));
const ImportsPage = lazy(() => import('./admin/ImportsPage'));
const CategoriesAdminPage = lazy(() => import('./admin/CategoriesAdminPage'));
const ScriptsPage = lazy(() => import('./admin/ScriptsPage'));
const ScriptEditorPage = lazy(() => import('./admin/ScriptEditorPage'));
const CommentsPage = lazy(() => import('./admin/CommentsPage'));
const MessagesPage = lazy(() => import('./admin/MessagesPage'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:slug" element={<JobDetailPage />} />
        <Route path="latest-jobs" element={<LatestJobsPage />} />
        <Route path="closing-soon" element={<ClosingSoonPage />} />
        <Route path="expired-jobs" element={<ExpiredJobsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organization/:slug" element={<OrganizationPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="privacy-policy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="disclaimer" element={<DisclaimerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="admin"
        element={
          <Suspense fallback={<p className="p-8 text-center text-slate-600">লোড হচ্ছে…</p>}>
            <AdminRoot />
          </Suspense>
        }
      >
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs" element={<JobsListPage />} />
          <Route path="jobs/new" element={<JobFormPage />} />
          <Route path="jobs/:id/edit" element={<JobFormPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="categories" element={<CategoriesAdminPage />} />
          <Route path="scripts" element={<ScriptsPage />} />
          <Route path="scripts/:id" element={<ScriptEditorPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
