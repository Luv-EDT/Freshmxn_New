const express = require("express")
const rateLimit = require("express-rate-limit")
const CorporateEnquiry = require("../model/corporateEnquiriesModel")
const { sendEmail, escapeHtml } = require("../utils/mailer")

const router = express.Router()

// THE COMPANY CONTACT FORM (owner, Round 40b) — on /corporates; this prefix differs from the page. No login: a
// company writes once. Stored first, then emailed to the founder; a hidden box only bots fill, and a few tries an
// hour per address.

const FOUNDER_EMAIL = "luvgoel@freshmxn.com"
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEAM_SIZES = ["1–50", "51–200", "201–1,000", "1,000+"]

const enquiryRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests — please try again in an hour, or write to luvgoel@freshmxn.com" },
})

const clean = (value, max) => String(value === undefined || value === null ? "" : value).trim().slice(0, max)


// ========================
// Send A Request
// ========================

router.post("/send", enquiryRateLimiter, async (req, res) => {
    try {
        // the hidden "website" box: a person never fills it, so a filled one is quietly thanked and dropped
        if (clean(req.body.website, 200)) {
            return res.status(200).json({ success: true, message: "Thanks — we'll be in touch", data: null })
        }

        const name = clean(req.body.name, 100)
        const email = clean(req.body.email, 200).toLowerCase()
        const company = clean(req.body.company, 150)
        const phone = clean(req.body.phone, 30)
        const teamSize = TEAM_SIZES.includes(req.body.teamSize) ? req.body.teamSize : ""
        const message = clean(req.body.message, 2000)

        if (!name || !emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Please give your name and a work email" })
        }

        const enquiry = await CorporateEnquiry.create({ name, email, company, phone, teamSize, message })

        const result = await sendEmail({
            to: FOUNDER_EMAIL,
            subject: `[Freshmxn for companies] ${company || name}`,
            html: `<p>A request from the companies page:</p>
                <p><strong>Name:</strong> ${escapeHtml(name)}<br>
                <strong>Email:</strong> ${escapeHtml(email)}<br>
                <strong>Company:</strong> ${escapeHtml(company) || "—"}<br>
                <strong>Phone:</strong> ${escapeHtml(phone) || "—"}<br>
                <strong>Team size:</strong> ${escapeHtml(teamSize) || "—"}</p>
                <p><strong>What they'd like:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>") || "—"}</p>`,
        })

        if (result.sent) {
            enquiry.emailed = true
            await enquiry.save()
        }

        return res.status(201).json({ success: true, message: "Thanks — we'll be in touch", data: null })

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to send your request — please email luvgoel@freshmxn.com", error: error.message })
    }
})

module.exports = router
module.exports.TEAM_SIZES = TEAM_SIZES
