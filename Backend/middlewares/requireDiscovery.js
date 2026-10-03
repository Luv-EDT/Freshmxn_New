// runs AFTER authMiddleware. Passes for a paid student whose plan includes Career Discovery — the
// interest form, the assessment, the report and everything built on them (Round 12). A Mentor Only
// student (tier 3) is paid but has none of that; requirePaid alone would have let them in.

const { grants } = require("../utils/plans")

const requireDiscovery = async (req, res, next) => {
    try {

        if (req.user.paid !== true) {
            return res.status(401).json({
                success: false,
                message: "Payment required"
            })
        }

        if (!grants(Number(req.user.currentTier)).discovery) {
            return res.status(403).json({
                success: false,
                message: "Career Discovery isn't in your plan — add it from the plans page"
            })
        }

        next()

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Payment required",
            error: error.message,
        })

    }
}

module.exports = requireDiscovery
