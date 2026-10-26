// THE MENTOR INVITE (owner, Rounds 28 and 34) — one wording for the email the mentor gets on a match and
// the WhatsApp message the admin sends with one tap. It names what the mentor needs to prepare (the
// student's first name, the career and role, what they want help with), the 2.5 days to prepare, and
// the privacy rules. The student books from the mentor's Calendly links, so nobody needs to message
// anybody to arrange it. The student's contact is NOT in it: the mentor sees it on their mentor page
// only after accepting the rules there.

const PRIVACY_RULES = [
    "Use the student's name and contact only to arrange and hold these sessions.",
    "Never share them with anyone, add the student to a group, or contact them about anything else.",
    "Keep what the student tells you private.",
    "Delete the chat and the contact after the follow-up session.",
]

const FOCUS_WORDS = { career: "making it their career", passion: "pursuing it as an interest, alongside whatever pays", both: "both as a career and as an interest" }

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "the student"

// { firstName, profession, jobRole, focus, helpWanted } — all plain text
const inviteFacts = (row, student) => ({
    firstName: firstName(student && student.name),
    profession: row.chosenProfessionName || row.otherRequest || "",
    jobRole: row.chosenJobRole || "",
    focus: FOCUS_WORDS[row.helpFocus] || "",
    helpWanted: row.helpWanted || "",
})

const site = () => process.env.FRONTEND_URL || "https://www.freshmxn.com"

const whatsappText = (facts) => [
    "Hi, this is Freshmxn. You have a new student.",
    `Student: ${facts.firstName}`,
    `Career: ${facts.profession}${facts.jobRole ? ` — ${facts.jobRole}` : ""}`,
    facts.focus ? `Help with: ${facts.focus}` : null,
    facts.helpWanted ? `They'd like to know: ${facts.helpWanted}` : null,
    "",
    `Please read their brief on ${site()}/mentor within 2.5 days and prepare. They book from your Calendly links — please keep the slots you opened free. Tell us here when the session is done.`,
    "",
    "Privacy rules:",
    ...PRIVACY_RULES.map((rule) => `• ${rule}`),
].filter((line) => line !== null).join("\n")

// digits only, with India's code added to a bare 10-digit number
const waNumber = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "")
    return digits.length === 10 ? `91${digits}` : digits
}

const whatsappLink = (phone, facts) => (waNumber(phone) ? `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(whatsappText(facts))}` : null)

module.exports = { PRIVACY_RULES, inviteFacts, whatsappText, whatsappLink, firstName }
