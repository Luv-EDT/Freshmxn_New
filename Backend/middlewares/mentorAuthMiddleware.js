// runs AFTER authMiddleware, so req.user is already loaded

const mentorAuthMiddleware = async (req, res, next) => {
    try {

        const isMentor = req.user.role === "mentor"

        if (!isMentor) {
            return res.status(401).json({
                success: false,
                message: "Permission Not Granted for this request"
            })
        }

        next()

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Permission Not Granted for this request",
            error: error.message,
        })

    }
}

module.exports = mentorAuthMiddleware
