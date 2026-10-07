import { useState, useEffect, useMemo } from "react"
import { getMyReport, retryMyReport, updateMyReport } from "../../apiCall/reportsApi"
import { getProfessions } from "../../apiCall/professionsApi"

// THE REPORT'S DATA, shared by the overview (ReportPage.js) and the full list (MatchesPage.js) since
// Round 19: the report itself, polling while it is being built, "Try again", "Update my report", and
// one detail request for every career in it.
function useReportData() {
    const [state, setState] = useState({ loading: true, data: null, error: "" })
    const [details, setDetails] = useState({})        // professionId → the full student-facing record
    const [detailsLoaded, setDetailsLoaded] = useState(false)
    // Bumped after a retry so the polling effect below starts again.
    const [reloadKey, setReloadKey] = useState(0)
    const [retrying, setRetrying] = useState(false)
    const [updateOpen, setUpdateOpen] = useState(false)
    const [updating, setUpdating] = useState(false)

    // Polls while the pipeline is running, and stops the moment it is not. A student who has just
    // pressed Submit is looking at this page NOW — telling them to come back later and leaving it
    // frozen is the difference between "it is working" and "it is broken", and they cannot tell
    // which from a static screen.
    useEffect(() => {
        let cancelled = false
        let timer = null

        const load = async () => {
            try {
                const response = await getMyReport()
                if (cancelled) return

                const data = response.data.data
                setState({ loading: false, data, error: "" })

                // Only "generating" polls. A report built by older scoring or matching is NOT rebuilt
                // behind the student's back (owner, Round 11) — it offers "Update my report" instead.
                if (data.status === "generating") timer = setTimeout(load, 5000)
            } catch (error) {
                if (!cancelled) setState({ loading: false, data: null, error: "Could not load your report" })
            }
        }

        load()

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [reloadKey])

    // The pipeline gave up (status "failed", or rebuildFailed on an older report). Queue it again
    // and go back to polling — the page shows "preparing" until the new report lands.
    const retry = async () => {
        setRetrying(true)
        try {
            const response = await retryMyReport()
            if (response && response.data && response.data.success === false) throw new Error(response.data.message)
            setState({ loading: false, data: { status: "generating" }, error: "" })
            setReloadKey((key) => key + 1)
        } catch (error) {
            window.alert("We could not restart it just now. Please try again in a minute, or message us on WhatsApp.")
        }
        setRetrying(false)
    }

    // "Update my report" — only on the student's word, after "same way or something new?"
    const startUpdate = async (direction) => {
        setUpdating(true)
        try {
            const response = await updateMyReport(direction)
            if (response && response.data && response.data.success === false) throw new Error(response.data.message)
            setUpdateOpen(false)
            setState({ loading: false, data: { status: "generating" }, error: "" })
            setReloadKey((key) => key + 1)
        } catch (error) {
            window.alert("We could not start the update just now. Please try again in a minute, or message us on WhatsApp.")
        }
        setUpdating(false)
    }

    // ONE REQUEST FOR EVERY PROFESSION IN THE REPORT, fired once the ranking arrives rather than on
    // each expand. Forty accordion rows fetching themselves individually is forty round trips on a
    // phone connection, and the first tap would feel broken. The taxonomy is static, so this is a
    // read of shared data, not of anything belonging to the student.
    const ranked = state.data && state.data.ranked ? state.data.ranked : null
    const switchList = state.data && state.data.worthTheSwitch ? state.data.worthTheSwitch : null

    // ⚠ BOTH LISTS, NOT JUST THE RANKING. This fetched only `ranked` ids, and worth-the-switch cards
    // sat on "Loading…" forever — because the whole point of that list is to surface professions
    // that are NOT in the ranking. `alreadyRanked: false` is the common case there, so the entries
    // most worth reading were exactly the ones with no detail to read.
    //
    // Still one request. The union is at most a few dozen ids and the route takes up to 60.
    const detailIds = useMemo(() => {
        const ids = new Set()
        ;(ranked || []).forEach((entry) => ids.add(entry.professionId))
        ;(switchList || []).forEach((entry) => ids.add(entry.professionId))
        return [...ids]
    }, [ranked, switchList])

    // A stable key, so the effect does not refire on every render just because the array is new.
    const detailKey = detailIds.join(",")

    useEffect(() => {
        if (detailIds.length === 0) return

        let cancelled = false

        const loadDetails = async () => {
            try {
                const response = await getProfessions(detailIds)
                if (cancelled) return

                const byId = {}
                response.data.data.professions.forEach((profession) => { byId[profession.id] = profession })
                setDetails(byId)
                setDetailsLoaded(true)
            } catch (error) {
                // Answered, badly. The card must stop saying "Loading…" or it implies something is
                // still on its way that never is — it says the details could not be loaded instead.
                setDetailsLoaded(true)
            }
        }

        loadDetails()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailKey])

    return {
        state, ranked, switchList, details, detailsLoaded,
        retry, retrying, updateOpen, setUpdateOpen, updating, startUpdate,
    }
}

export default useReportData
