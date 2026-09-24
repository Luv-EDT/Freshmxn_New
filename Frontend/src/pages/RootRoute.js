import ProtectedRoute from "./User/ProtectedRoute"
import Home from "./User/Home"
import Landing from "./Public/Landing"

// "/" is two pages: the public landing page for visitors, the dashboard for anyone logged in.
// Read synchronously so a visitor never sees a "Loading..." flash or a bounce through /login.
// ProtectedRoute is left exactly as it was — the admin bounce, the /complete-profile gap-fill and
// requirePaid all still run for a logged-in user.
function RootRoute() {
    const token = localStorage.getItem("token")

    if (!token) return <Landing />

    return (
        <ProtectedRoute>
            <Home />
        </ProtectedRoute>
    )
}

export default RootRoute
