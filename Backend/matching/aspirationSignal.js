// THE ASPIRATION SIGNAL — what the report needs in order to say, out loud, what happened to the
// professions the student named when asked what they want to be.
//
// A stated wish is never silently rubber-stamped and never silently dropped. If it ranked first,
// the report says why. If it ranked 40th, the report says why. If it was removed by a hard filter,
// the report says which door is shut and what the record names as the way round. If we could not
// resolve the name to a profession at all, it is still kept and still reported, because an
// unmatched aspiration is information about the student, not a parsing failure to hide.
//
// Unmatched aspirations keep professionId: null by design. They already counted in matching — the
// interest form writes every aspiration into persistentInterests at Medium confidence, so the text
// itself seeded Program-2 candidates even when it named no profession we hold.

const { normalizeActivity } = require("./program1")

const NEAREST_LIMIT = 3

const buildAspirationSignals = ({ aspirations, ranked, filtered }) => {
    const rankedById = new Map(ranked.map((entry) => [entry.professionId, entry]))
    const filteredById = new Map((filtered || []).map((entry) => [entry.professionId, entry]))

    return (aspirations || [])
        .filter((row) => row && String(row.professionText || "").trim() !== "")
        .map((row) => {
            const professionText = String(row.professionText).trim()
            const key = normalizeActivity(professionText)
            const professionId = row.professionId || null

            // Professions this aspiration's own words actually reached in Program 2 — the answer to
            // "you said you want X; here is what that pointed at".
            const reached = ranked
                .filter((entry) => entry.matchedBy.some((hit) => hit.key === key))
                .slice(0, NEAREST_LIMIT)
                .map((entry) => ({
                    professionId: entry.professionId,
                    profession: entry.profession,
                    tier: entry.tier,
                    rankedPosition: entry.rankedPosition,
                    comfortScore: entry.comfortScore,
                }))

            const entry = professionId ? rankedById.get(professionId) : null

            if (entry) {
                return {
                    professionText,
                    professionId,
                    matched: true,
                    outcome: "ranked",
                    tier: entry.tier,
                    rankedPosition: entry.rankedPosition,
                    matchScore: entry.matchScore,
                    comfortScore: entry.comfortScore,
                    comfort: entry.comfort,
                    supportingFactors: entry.supportingFactors,
                    divergingFactors: entry.divergingFactors,
                    alsoReached: reached.filter((hit) => hit.professionId !== professionId),
                }
            }

            const blocked = professionId ? filteredById.get(professionId) : null

            if (blocked) {
                return {
                    professionText,
                    professionId,
                    matched: true,
                    outcome: "blocked",
                    blockedReason: blocked.reason,
                    tier: null,
                    rankedPosition: null,
                    matchScore: null,
                    comfortScore: null,
                    comfort: false,
                    supportingFactors: [],
                    divergingFactors: [],
                    alsoReached: reached,
                }
            }

            return {
                professionText,
                professionId,
                // "unranked" means the name resolved but nothing the student does reached it;
                // "unmatched" means the name never resolved to one of our professions at all.
                matched: Boolean(professionId),
                outcome: professionId ? "unranked" : "unmatched",
                tier: null,
                rankedPosition: null,
                matchScore: null,
                comfortScore: null,
                comfort: false,
                supportingFactors: [],
                divergingFactors: [],
                alsoReached: reached,
            }
        })
}

module.exports = { buildAspirationSignals }
