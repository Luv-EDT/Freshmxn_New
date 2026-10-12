// COMBINED CAREERS (owner, Round 10) — real careers that join two fields, like Wildlife Photographer
// (photographer × forest & wildlife officer) or Sports Nutritionist. Hand-checked in
// data/combined_careers.json; never invented per student.
//
// EXACTLY TWO PROFESSIONS (owner, Round 28). Each combined career names two of our professions,
// parentA and parentB — not groups of related careers, and never job roles. Before, a side was a group
// ("photo & film" = photographer, cinematographer, filmmaker, content creator, film editor) and lit
// when ANY of them was anywhere in the list, which offered combinations far from what the student was
// shown. Now the server returns every combined career whose two professions are BOTH in the ranked
// list; the report shows only those whose two professions are both in the top 15 it is showing, so the
// combinations follow the student's own filters and sorts.
//
// Its fit is the mean of the two professions' fits, so "why it fits you" reads the same way as for
// any career. It is shown BESIDE the ranking, never ranked into it.
//
// Pure, like the rest of the engine.
const MAX_SHOWN = 5

const findCombined = ({ ranked, universe, data }) => {
    if (!data || !Array.isArray(data.careers) || !Array.isArray(ranked) || ranked.length === 0) return []

    const position = new Map(ranked.map((entry, index) => [entry.professionId, index + 1]))
    const entryById = new Map((universe || ranked).map((entry) => [entry.professionId, entry]))
    const parent = (id) => (position.has(id) ? { id, position: position.get(id), entry: entryById.get(id) } : null)

    return data.careers
        .map((career) => {
            const a = parent(career.parentA)
            const b = parent(career.parentB)
            if (!a || !b || a.id === b.id) return null

            const fits = [a.entry && a.entry.comfortScore, b.entry && b.entry.comfortScore].filter((value) => typeof value === "number")
            const nameOf = (side) => (side.entry ? side.entry.profession : side.id)
            return {
                combinedId: career.id,
                profession: career.name,
                oneLiner: career.oneLiner,
                howToGetThere: career.howToGetThere,
                blueCollar: Boolean(career.blueCollar),
                sideA: { label: nameOf(a), via: nameOf(a), viaId: a.id },
                sideB: { label: nameOf(b), via: nameOf(b), viaId: b.id },
                parentIds: [a.id, b.id],
                comfortScore: fits.length > 0 ? Math.round((fits.reduce((sum, value) => sum + value, 0) / fits.length) * 10000) / 10000 : null,
                // the strengths that put each profession in the list, for "why it fits you"
                supportingFactors: [...((a.entry && a.entry.supportingFactors) || []).slice(0, 2), ...((b.entry && b.entry.supportingFactors) || []).slice(0, 2)],
                rankScore: a.position + b.position,
            }
        })
        .filter(Boolean)
        .sort((left, right) => left.rankScore - right.rankScore || left.combinedId.localeCompare(right.combinedId))
}

module.exports = { findCombined, MAX_SHOWN }
