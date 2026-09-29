// The shared frame for every sign-in style page: one centred card on a soft brand wash. Purely
// presentational — each page keeps its own form and logic inside.
function AuthCard({ children }) {
    return (
        <div className="auth-shell">
            <div className="auth-card">{children}</div>
        </div>
    )
}

export default AuthCard
