const express = require("express")
const jwt = require("jsonwebtoken")
const { OAuth2Client } = require("google-auth-library")
const User = require("../model/userModel")

const router = express.Router()

// Google sign-in, server-side redirect flow. No passport, no sessions:
//   /auth/google → Google consent screen → /auth/google/callback → our JWT → back to the frontend.
// These paths are fixed by the redirect URI registered in Google Cloud, so they are not RPC-style.
// Both handlers answer with browser redirects, not JSON, because the browser navigates here directly.

// GOOGLE_CALLBACK_URL must match the redirect URI in Google Cloud exactly
// (http://localhost:5000/auth/google/callback in dev, the Render URL later)
const getGoogleClient = (req) => {
    return new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get("host")}/auth/google/callback`,
    })
}

const redirectWithError = (res, reason) => {
    return res.redirect(`${process.env.FRONTEND_URL}/login?oauthError=${encodeURIComponent(reason)}`)
}


// ========================
// Start Google Sign-In
// ========================

router.get("/google", async (req, res) => {
    try {
        // state is a short-lived signed token, checked on the way back (CSRF protection without a session)
        const state = jwt.sign({ purpose: "google_oauth" }, process.env.JWT_SECRET, { expiresIn: "10m" })

        const authUrl = getGoogleClient(req).generateAuthUrl({
            access_type: "online",
            scope: ["openid", "email", "profile"],
            prompt: "select_account",
            state,
        })

        return res.redirect(authUrl)

    } catch (error) {
        console.log("Google sign-in start failed:", error.message)
        return redirectWithError(res, "Google sign-in failed")
    }
})


// ========================
// Google Callback
// ========================

router.get("/google/callback", async (req, res) => {
    try {
        const { code, state, error } = req.query

        if (error) {
            return redirectWithError(res, "Google sign-in was cancelled")
        }

        // Verify State
        const decodedState = jwt.verify(state || "", process.env.JWT_SECRET)

        if (decodedState.purpose !== "google_oauth") {
            return redirectWithError(res, "Google sign-in failed")
        }

        // Exchange the one-time code for Google's tokens, then verify the ID token
        const googleClient = getGoogleClient(req)
        const { tokens } = await googleClient.getToken(code)

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        })

        const payload = ticket.getPayload()   // { sub, email, email_verified, name }

        if (!payload.email || payload.email_verified !== true) {
            return redirectWithError(res, "Your Google email is not verified")
        }

        const normalizedEmail = payload.email.trim().toLowerCase()

        let user = await User.findOne({ googleId: payload.sub })

        if (!user) {
            const existingUser = await User.findOne({ email: normalizedEmail })

            if (existingUser) {
                // existing password account signing in with Google → link the two
                user = await User.findByIdAndUpdate(
                    existingUser._id,
                    { googleId: payload.sub, isEmailVerified: true },
                    { returnDocument: "after" }
                )
            } else {
                // first Google sign-in → new student. No age or journey yet → Complete Profile.
                user = await User.create({
                    name: payload.name || normalizedEmail.split("@")[0],
                    email: normalizedEmail,
                    googleId: payload.sub,
                    isEmailVerified: true,
                    role: "student",
                    paid: false,
                    currentTier: 0,
                })
            }
        }

        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })

        const jwtToken = jwt.sign(
            {
                userId: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        )

        // the token goes in the URL fragment (#), which browsers never send to any server
        return res.redirect(`${process.env.FRONTEND_URL}/oauth-success#token=${jwtToken}`)

    } catch (error) {
        console.log("Google callback failed:", error.message)
        return redirectWithError(res, "Google sign-in failed")
    }
})

module.exports = router
