import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login.js"
import Register from "./pages/Register.js"
import ForgotPassword from "./pages/ForgotPassword.js"
import ResetPassword from "./pages/ResetPassword.js"
import OAuthSuccess from "./pages/OAuthSuccess.js"
import VerifyEmail from "./pages/VerifyEmail.js"
import Home from "./pages/User/Home.js"
import ProtectedRoute from "./pages/User/ProtectedRoute.js"
import CompleteProfile from "./pages/User/CompleteProfile.js"
import Paywall from "./pages/User/Paywall.js"
import Profile from "./pages/User/Profile.js"
import Mentorship from "./pages/User/Mentorship.js"
import AdminHome from "./pages/Admin/AdminHome.js"
import AdminProtectedRoute from "./pages/Admin/AdminProtectedRoute.js"
import InterestForm from "./pages/Interest/InterestForm.js"

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

                <Route path="/" element={
                    <ProtectedRoute>
                        <Home />
                    </ProtectedRoute>
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
