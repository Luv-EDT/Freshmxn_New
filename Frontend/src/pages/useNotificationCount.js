import { useEffect, useState } from "react"
import { getMyNotifications } from "../apiCall/notificationsApi"

// How many NEW notifications a student has, for the bell in the menu bar (Round 29). Round 35 (owner):
// only the ones not seen yet — opening the notifications marks them seen, and the count starts again
// from the next one. Refreshed when the Profile clears or sees them.
const useNotificationCount = (enabled) => {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!enabled) return undefined
        let live = true
        const load = () => getMyNotifications().then((response) => {
            if (live) setCount(((response && response.data && response.data.data) || []).filter((item) => !item.seen).length)
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
