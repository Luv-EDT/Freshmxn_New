import { useEffect } from "react"

// WHILE A ONE-ATTEMPT TEST IS RUNNING (Round 17, owner). A list of words, a digit sequence, a timed
// puzzle or a focus run can't be shown again, so leaving in the middle is warned about first: the
// browser's own "Leave this page?" for a refresh, a closed tab or the address bar, and a plain question
// for any link on the page (the menu, the logo). If they leave anyway, the server flags the test as
// interrupted for the admin.
export const LEAVE_MESSAGE = "Leaving now ends this part of the test — it can't be shown again. Leave anyway?"

const useLeaveWarning = (active) => {
    useEffect(() => {
        if (!active) return undefined

        const onBeforeUnload = (event) => {
            event.preventDefault()
            event.returnValue = LEAVE_MESSAGE
            return LEAVE_MESSAGE
        }
        // capture phase, so it runs before the router's own click handler on a <Link>
        const onClick = (event) => {
            const link = event.target.closest && event.target.closest("a[href]")
            if (!link) return
            if (!window.confirm(LEAVE_MESSAGE)) {
                event.preventDefault()
                event.stopPropagation()
            }
        }

        window.addEventListener("beforeunload", onBeforeUnload)
        document.addEventListener("click", onClick, true)
        return () => {
            window.removeEventListener("beforeunload", onBeforeUnload)
            document.removeEventListener("click", onClick, true)
        }
    }, [active])
}

export default useLeaveWarning
