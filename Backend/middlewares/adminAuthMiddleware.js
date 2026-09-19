// runs AFTER authMiddleware, so req.user is already loaded

const adminAuthMiddleware = async (req, res, next) => {
    try {

        const isAdmin = req.user.role === "admin"

        if (!isAdmin) {
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

module.exports = adminAuthMiddleware
