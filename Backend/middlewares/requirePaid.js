// runs AFTER authMiddleware. Passes for any paid student, whichever payment mode granted access.

const requirePaid = async (req, res, next) => {
    try {

        if (req.user.paid !== true) {
            return res.status(401).json({
                success: false,
                message: "Payment required"
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

module.exports = requirePaid
