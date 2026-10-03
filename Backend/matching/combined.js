// COMBINED CAREERS (owner, Round 10) — real careers that join two fields, like Wildlife Photographer
// (photography × nature) or Sports Nutritionist. Hand-checked in data/combined_careers.json; never
// invented per student.
//
// Each has TWO SIDES, and each side is a GROUP of our careers, often from different sectors. A side
// is "lit" for a student when any career in its group is in their ranked list — and only careers
// their own activities point to reach that list, so a lit side is the student's own evidence, not a
// guess. When both sides are lit the combined career is shown, at most MAX_SHOWN, ordered by how high
// each side's best career sits (the sum of the two positions, lower first).
//
// Its fit is the mean of the two sides' best fits, so "why it fits you" reads the same way as for
// any career. It is shown BESIDE the ranking, never ranked into it.
//
// Pure, like the rest of the engine.
const MAX_SHOWN = 5

const findCombined = ({ ranked, universe, data }) => {
    if (!data || !Array.isArray(data.careers) || !Array.isArray(ranked) || ranked.length === 0) return []

    const position = new Map(ranked.map((entry, index) => [entry.professionId, index + 1]))
    const entryById = new Map((universe || ranked).map((entry) => [entry.professionId, entry]))

    // the best (highest-placed) career of a side, or null if the side is not lit
    const bestOf = (groupKey) => {
        const group = data.groups[groupKey]
        if (!group) return null
        let best = null
        group.careers.forEach((id) => {
            const at = position.get(id)
            if (at && (!best || at < best.position)) best = { id, position: at }
        })
        return best ? { ...best, label: group.label, entry: entryById.get(best.id) } : null
    }

    return data.careers
        .map((career) => {
            const a = bestOf(career.sideA)
            const b = bestOf(career.sideB)
            if (!a || !b || a.id === b.id) return null

            const fits = [a.entry && a.entry.comfortScore, b.entry && b.entry.comfortScore].filter((value) => typeof value === "number")
            return {
                combinedId: career.id,
                profession: career.name,
                oneLiner: career.oneLiner,
                howToGetThere: career.howToGetThere,
                blueCollar: Boolean(career.blueCollar),
                sideA: { label: a.label, via: a.entry ? a.entry.profession : a.id, viaId: a.id },
                sideB: { label: b.label, via: b.entry ? b.entry.profession : b.id, viaId: b.id },
                parentIds: [a.id, b.id],
                comfortScore: fits.length > 0 ? Math.round((fits.reduce((sum, value) => sum + value, 0) / fits.length) * 10000) / 10000 : null,
                // the strengths that put each side in the list, for "why it fits you"
                supportingFactors: [...((a.entry && a.entry.supportingFactors) || []).slice(0, 2), ...((b.entry && b.entry.supportingFactors) || []).slice(0, 2)],
                rankScore: a.position + b.position,
            }
        })
        .filter(Boolean)
        .sort((left, right) => left.rankScore - right.rankScore || left.combinedId.localeCompare(right.combinedId))
        .slice(0, MAX_SHOWN)
}

module.exports = { findCombined, MAX_SHOWN }
