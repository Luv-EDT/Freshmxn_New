const express = require("express")
const authMiddleware = require("../middlewares/authMiddleware")

const router = express.Router()

// the 223-profession taxonomy, read once at startup. Only what the search needs is kept in memory.
const allProfessions = require("../data/ALL-professions.json").professions.map((profession) => ({
    id: profession.id,
    profession: profession.profession,
    professionalSector: profession.professional_sector,
    jobRoles: profession.job_roles || [],
}))


// ========================
// Search Professions
// ========================

// autocomplete for the aspirational-professions question. Matches profession names first, then job roles.
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const query = String(req.query.q || "").trim().toLowerCase()

        if (query.length < 2) {
            return res.status(200).json({
                success: true,
                message: "Type at least 2 letters",
                data: [],
            })
        }

        const scored = []

        allProfessions.forEach((profession) => {
            const name = profession.profession.toLowerCase()
            const matchedRole = profession.jobRoles.find((role) => role.toLowerCase().includes(query))

            let score = 0
            if (name.startsWith(query)) score = 3
            else if (name.includes(query)) score = 2
            else if (matchedRole) score = 1

            if (score > 0) {
                scored.push({
                    id: profession.id,
                    profession: profession.profession,
                    professionalSector: profession.professionalSector,
                    matchedRole: score === 1 ? matchedRole : null,
                    score,
                })
            }
        })

        const results = scored
            .sort((a, b) => b.score - a.score || a.profession.localeCompare(b.profession))
            .slice(0, 10)

        return res.status(200).json({
            success: true,
            message: "Professions fetched successfully",
            data: results,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to search professions",
            error: error.message,
        })
    }
})

module.exports = router
