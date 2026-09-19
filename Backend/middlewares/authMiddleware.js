const jwt = require("jsonwebtoken")
const User = require("../model/userModel")

// 1st check: the token is signed with JWT_SECRET
// 2nd check: the token is not expired
// then load the latest user (without the password) onto req.user

const authMiddleware = async (req, res, next) => {
    try {

        // Authorization: Bearer xxxxxxxxxxxxx
        const authHeader = req.headers.authorization

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Token missing"
            })
        }

        const token = authHeader.split(" ")[1]

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Get latest user from DB
        const user = await User.findById(decoded.userId).select("-password")

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            })
        }

        // Make user available to next middleware/route
        req.user = user

        next()

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Session expired",
            error: error.message,
        })

    }
}

module.exports = authMiddleware
