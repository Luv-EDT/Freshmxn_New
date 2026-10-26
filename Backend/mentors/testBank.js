// THE MENTOR COMPETENCE TEST (owner, Round 34) — a revision of how a mentor will mentor our students,
// and their proof to us that they understand the platform. 10 questions:
//
//   3 the same for everyone   the 5-step flow in order · their two Calendly links · a 5–10 minute video
//                             for a sample student
//   7 drawn at random         from the multiple-choice bank below, all from the three training documents
//
// The multiple-choice answers are pre-marked for the admin; the admin decides pass or fail by hand.
// `answer` is the index of the right option and never leaves the server for a mentor.

const STEPS = [
    { id: "profile", text: "Complete your profile and the onboarding inputs" },
    { id: "calendly", text: "Set up your two Calendly links (1-hour main, 20-minute follow-up)" },
    { id: "prepare", text: "Get matched with a student, read their brief and prepare" },
    { id: "session", text: "Run the 60-minute session, and the follow-up if they want one" },
    { id: "after", text: "Tell us it's done — the student's feedback comes in and you're paid" },
]

const BANK = [
    { id: "q-main-length", q: "How long is the main mentoring session?", options: ["20 minutes", "60 minutes", "90 minutes", "2 hours"], answer: 1 },
    { id: "q-followup-length", q: "How long is the follow-up session?", options: ["10 minutes", "20 minutes", "45 minutes", "60 minutes"], answer: 1 },
    { id: "q-main-window", q: "When we tell you about a new student, the main-session slots you open should fall…", options: ["within the next 4 days", "within the next 2 weeks", "any time this month", "only on weekends"], answer: 0 },
    { id: "q-followup-window", q: "The optional follow-up slots should fall…", options: ["on the same day as the main session", "on days 5 and 6 (from day 3 at the earliest)", "a month later", "only if the student pays extra"], answer: 1 },
    { id: "q-slot-count", q: "How many slots should you open for each session type for one student?", options: ["Exactly one", "At least 5", "No more than 2", "It doesn't matter"], answer: 1 },
    { id: "q-prepare-time", q: "After we match you with a student, how long do you have to read their brief and prepare?", options: ["2 hours", "2.5 days", "2 weeks", "No preparation is needed"], answer: 1 },
    { id: "q-calendly-repeat", q: "Each time a new student is matched with you, what do you change in Calendly?", options: ["Create two new event links", "Only the weekly hours (your available slots)", "Nothing — old slots are fine", "Delete your account and start again"], answer: 1 },
    { id: "q-welcome", q: "The first 5 minutes (welcome and rapport) should include…", options: ["Your salary and your company's revenue", "A short intro, \"this is a safe space\", and a light story of your own early doubts", "A test of the student's knowledge", "A sales pitch for our other plans"], answer: 1 },
    { id: "q-overview", q: "In the profession overview, you should describe…", options: ["Only the best parts, so the student stays motivated", "A real day, common misconceptions, how careers grow, and hours, stress and balance", "Only how much money you make", "The history of your company"], answer: 1 },
    { id: "q-journey", q: "When you share your own journey, you should…", options: ["Share only your successes", "Include struggles, breaks and detours, and why you kept going", "Keep it to one minute", "Skip it — it's about the student"], answer: 1 },
    { id: "q-relate", q: "How do you relate your story to the student?", options: ["Use the connection points you prepared from their brief", "Talk about yourself only", "Ask them to read your LinkedIn", "Compare them with other students"], answer: 0 },
    { id: "q-key-question", q: "Which question do you answer in \"Success requirements\"?", options: ["\"What's the easiest job in this field?\"", "\"If you were in the student's position today, what would you do to reach your level or beyond?\"", "\"Which college is the best?\"", "\"How fast can you get rich in this field?\""], answer: 1 },
    { id: "q-8020", q: "In a starter skills roadmap, the 80/20 idea means…", options: ["Spend 80% of your time on theory", "Focus on the 20% of skills that give 80% of the results to get started", "Learn 80 skills in 20 days", "Charge 80% upfront"], answer: 1 },
    { id: "q-brief-look", q: "While reading the student brief, what are you mainly looking for?", options: ["Mistakes to correct", "Connection points with your own journey — shared fears, paths, backgrounds", "Their marks, to judge their ability", "Reasons they shouldn't choose your field"], answer: 1 },
    { id: "q-authenticity", q: "Which matters more in a session?", options: ["A polished, perfect talk", "Your real story — authenticity over perfection", "Covering every possible fact", "Finishing early"], answer: 1 },
    { id: "q-empathy", q: "\"Empathy over advice\" means…", options: ["Understand the student before guiding them", "Never give advice", "Agree with everything the student says", "Talk about feelings only"], answer: 0 },
    { id: "q-guide", q: "Your role is to…", options: ["Decide the student's career for them", "Guide, not prescribe — help them think, not decide for them", "Convince them to join your field", "Sell them courses"], answer: 1 },
    { id: "q-direct-ask", q: "A student asks you directly for a session outside Freshmxn. What do you do?", options: ["Agree and charge them yourself", "Tell us — taking students off the platform gets a mentor blacklisted", "Ignore the message", "Ask them to pay you on UPI"], answer: 1 },
    { id: "q-contact", q: "What may you do with a student's contact details?", options: ["Add them to a WhatsApp group", "Use them only to arrange and hold these sessions, never share them, and delete them after", "Share them with a friend who is hiring", "Keep them to sell courses later"], answer: 1 },
    { id: "q-followup-purpose", q: "What is the follow-up session for?", options: ["A second lecture from you", "The student's own questions and reflections — they should speak more", "Selling the next plan", "Grading the student"], answer: 1 },
    { id: "q-followup-offer", q: "A student didn't book a follow-up. At the end of the main session you…", options: ["Insist they book one", "Ask whether they'd like one — it's optional", "Book it for them", "Charge them for it"], answer: 1 },
    { id: "q-future-followup", q: "A later follow-up (not the first, included one) is paid at…", options: ["Nothing", "30% of your main-session rate", "The full main-session rate", "Double the main rate"], answer: 1 },
    { id: "q-when-paid", q: "When is your payment for a session due?", options: ["When we match you", "When the student's feedback comes in", "At the end of the year", "Before the session"], answer: 1 },
    { id: "q-missed-prep", q: "What happens if you don't open slots or prepare in time?", options: ["Nothing", "We find the student another mentor in the same profession, and it counts against your rating", "The student waits a month", "You're paid anyway"], answer: 1 },
    { id: "q-reschedule", q: "Once a student has booked a slot…", options: ["You may move it whenever you like", "You honour it — rescheduling happens only if both agree, through us", "The student must always adjust", "It's only a suggestion"], answer: 1 },
    { id: "q-noshow", q: "When is a student marked a no-show?", options: ["If they're 1 minute late", "If they haven't joined 10 minutes after the start", "Never", "If they don't turn on their camera"], answer: 1 },
    { id: "q-tier2", q: "How does a mentor reach Tier 2?", options: ["By asking us", "Automatically, after 7 sessions with good ratings", "After one session", "By paying a fee"], answer: 1 },
    { id: "q-tier3", q: "What does Tier 3 need?", options: ["Only 3 sessions", "10+ sessions with good ratings, a skills roadmap and a review of your profession's data", "A referral from another mentor", "A certificate"], answer: 1 },
    { id: "q-stages", q: "In Freshmxn's model — exposure, clarity, action — where do mentors come in?", options: ["Exposure", "Clarity — real careers through your story", "Action — hiring the student", "None of these"], answer: 1 },
    { id: "q-careers", q: "The careers we recommend have three things in common. Which?", options: ["High demand, financially viable, AI-resilient", "Easy, short and cheap", "Only government jobs", "Only jobs abroad"], answer: 0 },
    { id: "q-wrapup", q: "At the wrap-up, which next steps do you mention?", options: ["None — just say goodbye", "Fundamental development, a skills pathway (80/20), and internships or projects", "Only paid courses", "Your personal coaching"], answer: 1 },
    { id: "q-done-signal", q: "After the session, who tells Freshmxn it's done?", options: ["Nobody — it's automatic", "You, on WhatsApp — then we send the student the feedback form", "The student's parents", "Calendly"], answer: 1 },
]

// sample students the video is recorded for — fictional, and written so any mentor can relate to them
const SAMPLES = [
    {
        id: "sample-riya",
        text: "Riya, 17, Class 12 (Science). She loves drawing and sketches the buildings on her way to school, and won her school's poster competition. She's anxious because her parents want her to take an engineering entrance, and she isn't sure she's \"good enough\" for a creative career. She chose a job role in your profession.",
    },
    {
        id: "sample-arjun",
        text: "Arjun, 20, second year of a B.Com. He enjoys explaining things to friends and ran his college's quiz club. He's worried that he picked the wrong degree and has fallen behind people who knew what they wanted early. He chose a job role in your profession.",
    },
    {
        id: "sample-sana",
        text: "Sana, 24, working in customer support for two years. She's curious, teaches herself things from YouTube, and was praised for fixing a broken process at work. She feels stuck and wonders whether it's too late to switch. She chose a job role in your profession.",
    },
]

const DRAWN = 7

// a fair draw: Fisher–Yates on a copy, then the first n
const draw = (items, n, random = Math.random) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, n)
}

const byId = new Map(BANK.map((question) => [question.id, question]))

// each mentor sees each question's options in their own order (`orders[id]`, kept on their test), so
// the right answer isn't always in the same place. An answer is the index AS SHOWN.
const shownOrder = (test, id) => {
    const order = test.orders && test.orders[id]
    return Array.isArray(order) && order.length === 4 ? order : [0, 1, 2, 3]
}
const publicQuestion = (test, { id, q, options }) => ({ id, q, options: shownOrder(test, id).map((index) => options[index]) })

// how many of the drawn questions the mentor got right, and whether the steps are in order
const markTest = (test) => {
    const drawn = (test.drawnIds || []).map((id) => byId.get(id)).filter(Boolean)
    const picked = (question) => shownOrder(test, question.id)[Number((test.answers || {})[question.id])]
    const correct = drawn.filter((question) => picked(question) === question.answer).length
    const stepsInOrder = (test.stepOrder || []).join(",") === STEPS.map((step) => step.id).join(",")
    return { correct, of: drawn.length, stepsInOrder }
}

module.exports = { STEPS, BANK, SAMPLES, DRAWN, draw, byId, shownOrder, publicQuestion, markTest }
