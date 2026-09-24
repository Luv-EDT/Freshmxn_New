import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login.js"
import Register from "./pages/Register.js"
import ForgotPassword from "./pages/ForgotPassword.js"
import ResetPassword from "./pages/ResetPassword.js"
import OAuthSuccess from "./pages/OAuthSuccess.js"
import VerifyEmail from "./pages/VerifyEmail.js"
import RootRoute from "./pages/RootRoute.js"
import ProtectedRoute from "./pages/User/ProtectedRoute.js"
import CompleteProfile from "./pages/User/CompleteProfile.js"
import Paywall from "./pages/User/Paywall.js"
import Profile from "./pages/User/Profile.js"
import Mentorship from "./pages/User/Mentorship.js"
import AdminHome from "./pages/Admin/AdminHome.js"
import AdminProtectedRoute from "./pages/Admin/AdminProtectedRoute.js"
import InterestForm from "./pages/Interest/InterestForm.js"
import AssessmentShell from "./pages/Assessment/AssessmentShell.js"
import ReportPage from "./pages/Report/ReportPage.js"
import SuccessStories from "./pages/Public/SuccessStories.js"
import MentorWaitlistPublic from "./pages/Public/MentorWaitlistPublic.js"
import MentorRegister from "./pages/Mentor/MentorRegister.js"
import MentorLogin from "./pages/Mentor/MentorLogin.js"
import MentorHome from "./pages/Mentor/MentorHome.js"
import MentorProtectedRoute from "./pages/Mentor/MentorProtectedRoute.js"

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/oauth-success" element={<OAuthSuccess />} />
                <Route path="/verify-email/:token" element={<VerifyEmail />} />

                {/* Public site — no login */}
                <Route path="/success-stories" element={<SuccessStories />} />
                <Route path="/mentor-waitlist" element={<MentorWaitlistPublic />} />

                {/* Landing page for visitors, the dashboard for anyone logged in */}
                <Route path="/" element={<RootRoute />} />

                {/* Mentors — their own login and pages (API lives under /mentors, not /mentor) */}
                <Route path="/mentor/register" element={<MentorRegister />} />
                <Route path="/mentor/login" element={<MentorLogin />} />
                <Route path="/mentor" element={
                    <MentorProtectedRoute>
                        <MentorHome />
                    </MentorProtectedRoute>
                } />

                <Route path="/complete-profile" element={
                    <ProtectedRoute>
                        <CompleteProfile />
                    </ProtectedRoute>
                } />

                <Route path="/paywall" element={
                    <ProtectedRoute>
                        <Paywall />
                    </ProtectedRoute>
                } />

                <Route path="/profile" element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } />

                <Route path="/mentorship" element={
                    <ProtectedRoute>
                        <Mentorship />
                    </ProtectedRoute>
                } />

                {/* Stage 1 — only after payment */}
                <Route path="/interest" element={<Navigate to="/interest/start" replace />} />
                <Route path="/interest/:step" element={
                    <ProtectedRoute requirePaid={true}>
                        <InterestForm />
                    </ProtectedRoute>
                } />

                {/* Stage 2 — the psychometric assessment */}
                <Route path="/assessment" element={<Navigate to="/assessment/start" replace />} />
                <Route path="/assessment/:module" element={
                    <ProtectedRoute requirePaid={true}>
                        <AssessmentShell />
                    </ProtectedRoute>
                } />

                {/* Stage 3 — the report */}
                <Route path="/report" element={
                    <ProtectedRoute requirePaid={true}>
                        <ReportPage />
                    </ProtectedRoute>
                } />

                <Route
                    path="/admin"
                    element={<AdminProtectedRoute>
                        <AdminHome />
                    </AdminProtectedRoute>}
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
