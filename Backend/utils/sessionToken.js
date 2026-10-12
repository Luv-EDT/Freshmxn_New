const jwt = require("jsonwebtoken")
const User = require("../model/userModel")

// ONE DEVICE AT A TIME (owner, Round 27). Every login — password, Google, a new sign-up — moves the
// user's sessionVersion on by one and writes the new number into the pass it hands out. authMiddleware
// refuses a pass whose number is behind, so the device logged in before is signed out instead of
// quietly overwriting answers saved from the newer one. A password reset moves it on too.
const OTHER_DEVICE_MESSAGE = "You signed in on another device"

const startSession = async (userId) => {
    const user = await User.findByIdAndUpdate(userId, { $inc: { sessionVersion: 1 } }, { new: true }).lean()
    return jwt.sign(
        {
            userId: userId,
            sv: user.sessionVersion,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    )
}

// a pass made before Round 27 has no number: it stays good until that user's next login
const isCurrentSession = (decoded, user) => {
    const current = user.sessionVersion || 0
    return decoded.sv === undefined ? current === 0 : decoded.sv === current
}

module.exports = { startSession, isCurrentSession, OTHER_DEVICE_MESSAGE }
