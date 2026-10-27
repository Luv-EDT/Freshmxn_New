import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { setUser } from "../../store/userSlice"
import { getCurrentUser } from "../../apiCall/userApi"
import { AUDIENCE_OF_JOURNEY } from "./audienceQuestions"

// A LOGGED-IN STUDENT'S CATEGORY (owner, Rounds 36-37) — their journey decides which questions the home page and
// the FAQ page show them. Public pages don't load the user on their own, so this does when there is a session.
// null for a visitor (or anyone who isn't a student): they see all three audiences.
function useMyAudience() {
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.user)
    const hasToken = Boolean(localStorage.getItem("token"))

    useEffect(() => {
        if (!hasToken || user) return
        const load = async () => {
            const response = await getCurrentUser()
            if (response && response.data && response.data.success) dispatch(setUser({ user: response.data.userData }))
        }
        load()
    }, [hasToken, user, dispatch])

    const mine = user && user.role === "student" ? AUDIENCE_OF_JOURNEY[user.journey] || null : null
    return mine
}

export default useMyAudience
