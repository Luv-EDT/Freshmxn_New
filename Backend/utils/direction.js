// "ARE YOU STILL HEADING THE SAME WAY, OR LOOKING FOR SOMETHING NEW?" (owner, Round 11)
//
// Asked whenever a student rebuilds their report themselves — a resubmit, or "Update my report" —
// because only a NEW direction should restart the 6/12-month follow-up: a student who presses Update
// by mistake, or just wants the improved matching, is still on the road they were on, and asking them
// "how did it go?" six months from the FIRST report is the right question.
//
// The first submit always starts the clock; nothing is asked then.
const DIRECTIONS = ["same", "new"]

// The user update for one answer, or null when a needed answer is missing.
const directionUpdate = ({ via, direction, firstTime, now = new Date() }) => {
    if (firstTime) return { $set: { followUpAnchorAt: now } }
    if (!DIRECTIONS.includes(direction)) return null

    const update = { $push: { directionChanges: { $each: [{ at: now, via, choice: direction }], $slice: -50 } } }
    if (direction === "new") update.$set = { followUpAnchorAt: now }
    return update
}

module.exports = { DIRECTIONS, directionUpdate }
