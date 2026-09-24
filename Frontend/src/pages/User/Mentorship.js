import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import { Modal, message } from "antd"
import dayjs from "dayjs"
import Navbar from "../Navbar"
import MentorRolloverPolicy from "../Public/MentorRolloverPolicy"
import { getMyWaitlist, chooseProfession } from "../../apiCall/mentorWaitlistApi"
import { getMyReport } from "../../apiCall/reportsApi"

// Tier 2's mentor waitlist, after payment (mentor_waitlist_page.md):
//   1. complete Step 1 → 2. choose a career FROM YOUR OWN MATCHES and send it →
//   3. we match a mentor within 20 BUSINESS DAYS OF THAT CHOICE (not of payment).
// The choice is sent once: it starts the clock and our search. Changing it goes through WhatsApp,
// and an admin resets it (Admin → Mentor Matches).

const formatDate = (date) => (date ? dayjs(date).format("D MMM YYYY") : "")

function Mentorship() {
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.user)
    const [waitlist, setWaitlist] = useState(null)
    const [ranked, setRanked] = useState([])
    const [selectedId, setSelectedId] = useState("")
    const [loading, setLoading] = useState(true)

    const isTier2 = user && user.currentTier === 2

    useEffect(() => {
        if (!isTier2) {
            setLoading(false)
            return
        }

        const load = async () => {
            const waitlistResponse = await getMyWaitlist()
            const place = waitlistResponse?.data?.data || null
            setWaitlist(place)

            // the picker is built from the student's own ranked matches — only needed before a choice
            if (place && place.matchStatus === "awaiting_choice") {
                try {
                    const reportResponse = await getMyReport()
                    setRanked(reportResponse.data.data.ranked || [])
                } catch (error) {
                    setRanked([])
                }
            }
            setLoading(false)
        }
        load()
    }, [isTier2])

    const sendChoice = async () => {
        const response = await chooseProfession({ professionId: selectedId })

        if (!response || response.data.success === false) {
            message.error(response?.data?.message || "Could not send your choice")
            return
        }

        message.success(response.data.message)
        setWaitlist((prev) => ({ ...prev, ...response.data.data }))
    }

    const confirmChoice = () => {
        const chosen = ranked.find((entry) => String(entry.professionId) === selectedId)
        if (!chosen) return

        Modal.confirm({
            title: `Send "${chosen.profession}" as your choice?`,
            content: "This starts your 20-business-day mentor match. You can't change it here afterwards — if you need to, message us on WhatsApp.",
            okText: "Send my choice",
            cancelText: "Not yet",
            onOk: sendChoice,
        })
    }

    if (!user) return null

    if (!isTier2) {
        return (
            <div>
                <Navbar />
                <main className="page">
                    <h2>Mentorship</h2>
                    <p>Mentorship comes with Tier 2. Upgrade to join the waitlist.</p>
                    <button type="button" className="tap" onClick={() => navigate("/paywall")}>See plans</button>
                </main>
            </div>
        )
    }

    return (
        <div>
            <Navbar />
            <main className="page">
                <h2>🤝 Mentorship</h2>
                <p><strong>You're on the waitlist.</strong></p>

                {loading && <p>Loading...</p>}

                {!loading && waitlist && waitlist.matchStatus === "awaiting_choice" && (
                    <section>
                        <h3>Choose the career you'd like a mentor in</h3>
                        <p>
                            Pick the profession from your matches that you'd genuinely like to move toward. We'll confirm
                            your mentor and schedule your two sessions within <strong>20 business days</strong> of your choice.
                        </p>

                        {ranked.length === 0 ? (
                            <p>
                                Finish your assessment first — your matches appear here once your report is ready.{" "}
                                <button type="button" className="tap" onClick={() => navigate("/dashboard")}>Go to my journey</button>
                            </p>
                        ) : (
                            <>
                                {ranked.map((entry, index) => (
                                    <label key={entry.professionId} className="choice">
                                        <input
                                            type="radio"
                                            name="profession"
                                            value={String(entry.professionId)}
                                            checked={selectedId === String(entry.professionId)}
                                            onChange={(e) => setSelectedId(e.target.value)}
                                        />
                                        <span>#{index + 1} {entry.profession}</span>
                                    </label>
                                ))}
                                <p>
                                    <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={confirmChoice}>
                                        Send my choice
                                    </button>
                                </p>
                            </>
                        )}
                    </section>
                )}

                {!loading && waitlist && waitlist.matchStatus === "matching" && (
                    <section>
                        <h3>We're finding your mentor</h3>
                        <p>
                            You chose <strong>{waitlist.chosenProfessionName}</strong> on {formatDate(waitlist.choiceSentAt)}.
                            We'll confirm your mentor by <strong>{formatDate(waitlist.dueBy)}</strong> — 20 business days
                            from your choice.
                        </p>
                        <p>
                            Need to change your choice?{" "}
                            <a href="https://wa.me/918882756287" target="_blank" rel="noreferrer">Message us on WhatsApp</a>.
                        </p>
                    </section>
                )}

                {!loading && waitlist && waitlist.matchStatus === "matched" && (
                    <section>
                        <h3>Your mentor is confirmed</h3>
                        {waitlist.mentor && (
                            <p>
                                <strong>{waitlist.mentor.name}</strong> — {waitlist.mentor.currentRole}
                                {waitlist.mentor.discipline ? `, ${waitlist.mentor.discipline}` : ""}
                            </p>
                        )}
                        <p>Career: {waitlist.chosenProfessionName}. We'll contact you to schedule your two sessions.</p>
                    </section>
                )}

                {!loading && waitlist && waitlist.matchStatus === "unmatchable" && (
                    <section>
                        <h3>We couldn't match you in time</h3>
                        <p>
                            {waitlist.resolution === "refunded"
                                ? "We've arranged your full refund."
                                : "Your payment has rolled over — we're still searching, or you can redirect it. We'll be in touch."}
                        </p>
                    </section>
                )}

                <MentorRolloverPolicy />

                <h3>Who your mentor will be</h3>
                <p>
                    Your mentor will be a <strong>mid-level professional</strong> — and that's a deliberate
                    choice, not a compromise. We don't pair you with industry veterans or highly qualified
                    outliers, because the further someone is from where you're standing, the harder it is to
                    relate to them.
                </p>
                <p>
                    We want someone whose own start is still near enough in time to be useful to you — an
                    older-sibling kind of relationship rather than a lecture. They will be competent; that
                    part is a given. What we're really after is relatability, and above all a good
                    mentor–mentee relationship.
                </p>

                <h3>How it works</h3>
                <p>
                    We connect the two of you here and you have a couple of sessions together. After that you
                    can book further sessions whenever you want more clarity. In the best case, they simply
                    become your mentor for the long run.
                </p>

                <button type="button" className="tap" onClick={() => navigate("/dashboard")}>Back to home</button>
            </main>
        </div>
    )
}

export default Mentorship
