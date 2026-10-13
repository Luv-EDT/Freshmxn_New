import { useEffect, useState } from "react"
import { getMyNotifications } from "../apiCall/notificationsApi"

// How many notifications a student has, for the bell in the menu bar (Round 29). Refreshed when the
// Profile clears some.
const useNotificationCount = (enabled) => {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!enabled) return undefined
        let live = true
        const load = () => getMyNotifications().then((response) => {
            if (live) setCount((response && response.data && response.data.data && response.data.data.length) || 0)
        })
        load()
        window.addEventListener("notifications-changed", load)
        return () => {
            live = false
            window.removeEventListener("notifications-changed", load)
        }
    }, [enabled])

    return count
}

export default useNotificationCount
