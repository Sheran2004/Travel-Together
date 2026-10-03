import { Component, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { Layout } from './components/Navbar';
import CallModal from './components/CallModal';
import { ProtectedRoute, PageLoader } from './components/ui';
import Home from './pages/Home';
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail, ConfirmEmail } from './pages/Auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Explore = lazy(() => import('./pages/Explore'));
const TripDetails = lazy(() => import('./pages/TripDetails'));
const TripForm = lazy(() => import('./pages/TripForm'));
const ManageTrip = lazy(() => import('./pages/ManageTrip'));
const MyTrips = lazy(() => import('./pages/MyTrips'));
const Saved = lazy(() => import('./pages/Saved'));
const Partners = lazy(() => import('./pages/Partners'));
const TravelerProfile = lazy(() => import('./pages/TravelerProfile'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Network = lazy(() => import('./pages/Network'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Safety = lazy(() => import('./pages/Safety'));
const Destination = lazy(() => import('./pages/Destination'));
const Admin = lazy(() => import('./pages/Admin'));
const Static = lazy(() => import('./pages/Static'));

class Boundary extends Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  render() { return this.state.e ? <div className="grid min-h-[60vh] place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Something broke on this page</h1><p className="mt-2 text-muted">The rest of the app still works.</p><a href="/" className="btn-primary mt-4">Back to home</a></div></div> : this.props.children; }
}
const Themed = ({ children }) => { const { user } = useAuth(); return <ThemeProvider user={user}>{children}</ThemeProvider>; };
const P = ({ children, admin }) => <ProtectedRoute admin={admin}>{children}</ProtectedRoute>;

export default function App() {
  return (
    <ToastProvider><AuthProvider><Themed><SocketProvider><CallProvider>
      <Boundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} /><Route path="register" element={<Register />} />
              <Route path="verify-email/:token" element={<VerifyEmail />} /><Route path="confirm-email/:token" element={<ConfirmEmail />} />
              <Route path="forgot-password" element={<ForgotPassword />} /><Route path="reset-password/:token" element={<ResetPassword />} />
              <Route path="explore" element={<Explore />} /><Route path="map" element={<Explore initialView="map" />} />
              <Route path="trips/new" element={<P><TripForm /></P>} />
              <Route path="trips/:slug" element={<TripDetails />} />
              <Route path="trips/:slug/edit" element={<P><TripForm edit /></P>} />
              <Route path="trips/:slug/manage" element={<P><ManageTrip /></P>} />
              <Route path="destinations/:slug" element={<Destination />} />
              <Route path="travelers/:username" element={<TravelerProfile />} />
              <Route path="dashboard" element={<P><Dashboard /></P>} />
              <Route path="my-trips" element={<P><MyTrips /></P>} /><Route path="saved" element={<P><Saved /></P>} />
              <Route path="partners" element={<P><Partners /></P>} />
              <Route path="messages" element={<P><Messages /></P>} /><Route path="messages/:id" element={<P><Messages /></P>} />
              <Route path="notifications" element={<P><Notifications /></P>} /><Route path="network" element={<P><Network /></P>} />
              <Route path="profile" element={<P><Profile /></P>} /><Route path="settings" element={<P><Settings /></P>} />
              <Route path="safety" element={<Safety />} />
              <Route path="admin" element={<P admin><Admin /></P>} />
              {['about', 'help', 'contact', 'privacy', 'terms'].map((p) => <Route key={p} path={p} element={<Static page={p} />} />)}
              <Route path="*" element={<div className="container-x py-24 text-center"><h1 className="text-4xl font-extrabold">Page not found</h1><p className="mt-2 text-muted">That route doesn't exist.</p><a href="/" className="btn-primary mt-6">Go home</a></div>} />
            </Route>
          </Routes>
        </Suspense>
      </Boundary>
      <CallModal />
    </CallProvider></SocketProvider></Themed></AuthProvider></ToastProvider>
  );
}
