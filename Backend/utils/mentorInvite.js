// THE MENTOR INVITE (owner, Rounds 28 and 34) — one wording for the email the mentor gets on a match and
// the WhatsApp message the admin sends with one tap. It names what the mentor needs to prepare (the
// student's first name, the career and role, what they want help with), the 2.5 days to prepare, and
// the three things the mentor tells us on WhatsApp (Round 35, owner): slots opened, the student's booking
// (with its dates and times), the session done. The student books from the mentor's Calendly links. The
// student's contact is NOT in it: the mentor sees it on their mentor page only after agreeing to keep it
// private there. (Round 35, owner: the longer list of privacy points was taken out.)

const PRIVACY_RULES = [
    "Keep what the student tells you private.",
]

// what the mentor tells us on WhatsApp, at each stage (owner, Round 35)
const TELL_US = [
    "when you've opened slots on your Calendly links;",
    "when the student has booked — with the date and time of the main session and the follow-up;",
    "when the session is done.",
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
    `Please read their brief on ${site()}/mentor within 2.5 days and prepare. They book from your Calendly links — please keep the slots you opened free. ${PRIVACY_RULES.join(" ")}`,
    "",
    "Please tell us here, on WhatsApp:",
    ...TELL_US.map((step, index) => `${index + 1}. ${step}`),
].filter((line) => line !== null).join("\n")

// digits only, with India's code added to a bare 10-digit number
const waNumber = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "")
    return digits.length === 10 ? `91${digits}` : digits
}

const whatsappLink = (phone, facts) => (waNumber(phone) ? `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(whatsappText(facts))}` : null)

module.exports = { PRIVACY_RULES, TELL_US, inviteFacts, whatsappText, whatsappLink, firstName }
