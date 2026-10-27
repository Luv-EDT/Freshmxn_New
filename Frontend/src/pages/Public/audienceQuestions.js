import { Link } from "react-router-dom"

// WHAT EACH OF THEM ASK US (owner, Round 36) — the landing page's questions, one set per audience (school,
// college, early professionals) and one set everyone asks, from the owner's question bank. Same rules as the
// Round 33 questions they replace: a fact keeps its source, and an answer only ever promises what is built
// (help with internships, jobs and a starter kit is a waitlist; AI exposure is shown, never "AI-proof").
// A number the owner gave without a source we could check is left out, not guessed (Round 36).

// a logged-in student's journey → their audience
export const AUDIENCE_OF_JOURNEY = { class9_10: "school", class11_12: "school", college: "college", early_professional: "professional" }

export const AUDIENCE_NAMES = {
    school: { title: "School students", tag: "Class 9 to 12", short: "School students" },
    college: { title: "College students", tag: "Any year, any course", short: "College students" },
    professional: { title: "Early professionals", tag: "The first few years of work", short: "Early professionals" },
}

export const AUDIENCE_QUESTIONS = {
    school: [
        {
            q: "How do I choose a career that AI won't take over?",
            a: (
                <>
                    AI is redrawing the map: AI, data, cloud and cybersecurity are now the most in-demand skills in India,
                    and routine roles are shrinking (India Skills Report 2026). Every career we recommend shows{" "}
                    <strong>how exposed it is to AI</strong> — and which part of the work AI touches — next to how much
                    India needs it, so you can pick work that lasts.
                </>
            ),
        },
        {
            q: "Everyone is taking the same stream. Should I, despite the competition?",
            a: (
                <>
                    A crowded path isn't automatically the safe one. A path with less competition can give you more
                    satisfaction and almost the same financial stability. Your report ranks careers from{" "}
                    <strong>1,000+ careers and job roles</strong> by how they fit <em>you</em> — each with its pay, its
                    demand in India and the road to it — so you choose with your eyes open, not by headcount.
                </>
            ),
        },
        {
            q: "I feel like a misfit — others are doing so much, and teachers pick the ones already doing things.",
            a: (
                <>
                    You've done more than you think. <strong>Virtual Career Counselling</strong> walks through every stage
                    of your life and asks what you did, what you enjoyed and what stuck — small things count, at school,
                    at home or with friends. We find the thread in your own story, not in a list of prizes.
                </>
            ),
        },
        {
            q: "Are arts and humanities doomed?",
            a: (
                <>
                    No. Design, media, performing arts, humanities, education and social impact are all among our 18
                    professional sectors — and each career in them shows the same facts as any other: pay from start to
                    mid-career, demand in India and how exposed it is to AI. Judge by the facts, not the rumour.
                </>
            ),
        },
        {
            q: "I'm from a small town — or a very competitive city. Where do I even start?",
            a: (
                <>
                    From where you're standing. Every career shows the road to it, the exams that lead there, what it costs
                    to qualify and <strong>your next 12 months</strong> — for a school student, in your own class. It all
                    happens online, so it's the same wherever you live.
                </>
            ),
        },
        {
            q: "No one at school or home can guide me — no mentors, no older siblings.",
            a: (
                <>
                    That's exactly who we built this for. Your counselling, assessment and report are done online at your
                    own pace, and with a mentor plan you talk one to one with <strong>a professional in the job role you
                    choose</strong> — like the older sibling who has already walked the road.
                </>
            ),
        },
        {
            q: "Why should I decide my whole future at 15 to 17 through one stream?",
            a: (
                <>
                    You shouldn't have to decide it blind. We show you several careers that fit you, the subjects and exams
                    each needs, and — if you change your mind later — what would carry over and what a switch would cost.
                    A stream is a step, not a life sentence.
                </>
            ),
        },
        {
            q: "I'm preparing for an entrance exam — but what happens after I get in, and after college?",
            a: (
                <>
                    Look past the exam before you spend two years on it. Each career shows how people get there, starting
                    and mid-career pay, demand and AI exposure — so you know what the exam leads to, not just how to clear
                    it.
                </>
            ),
        },
        {
            q: "Am I just following the crowd?",
            a: (
                <>
                    Find out in five minutes. <Link to="/try-demo">Try the free demo</Link>: tell us a little of your story,
                    play three short games, and see two careers your answers point to — then decide whether the crowd's
                    choice is yours too.
                </>
            ),
        },
    ],
    college: [
        {
            q: "Am I buying random courses out of FOMO?",
            a: (
                <>
                    If you don't know where you're going, every course looks necessary. Find the direction first: your
                    report ranks careers from your own story and strengths, and each one says <strong>what to work on</strong>{" "}
                    — so you buy the course that leads somewhere.
                </>
            ),
        },
        {
            q: "Am I heading blindly into my domain's mainstream career — B.Com to CA, B.Tech CS to software?",
            a: (
                <>
                    The obvious next step isn't always yours. We count every career from where you stand: what your degree
                    already covers, what's left, and how many years a different direction would really take — including
                    careers that combine two fields.
                </>
            ),
        },
        {
            q: "I'm confused about how to take action. How do I actually start?",
            a: (
                <>
                    Experiment with structure, not at random: <strong>1.</strong> get clarity on yourself — what you can do
                    and what drives you; <strong>2.</strong> pick one profession and learn the 20% of skills needed to get
                    started; <strong>3.</strong> build projects or do an internship; <strong>4.</strong> decide whether to
                    stay with it or try something else — and if something else, repeat. It costs far less time and money
                    than random exploration, and college is the best time to do it. Freshmxn does step 1 and gives you your
                    next 12 months for each career.
                </>
            ),
        },
        {
            q: "I'm in a tier-3 college. Can I still build a good career?",
            a: (
                <>
                    Yes. Your matches are ranked from your story and 31 factors about you — your college's name isn't one
                    of them. Each career shows the road from where you are now, and the skills and steps that matter more
                    than the name on the gate.
                </>
            ),
        },
        {
            q: "I'm not confident enough to ask seniors or people I know for help.",
            a: (
                <>
                    Many of us aren't. Start where no one is watching: the counselling and assessment are private and at
                    your own pace. And a mentor plan gives you a professional in the role you choose, in a safe one-to-one
                    space — someone whose job is to help.
                </>
            ),
        },
        {
            q: "I have no network, and my parents can't guide me on careers.",
            a: (
                <>
                    Then let the facts and a mentor do it. Your report gives the road, exams, pay, demand and AI exposure
                    for each career, and a mentor who has done the job tells you what it's really like — the network you
                    didn't inherit.
                </>
            ),
        },
        {
            q: "I want a broader profile for my master's applications.",
            a: (
                <>
                    Each career shows whether a master's is needed, helps or usually isn't needed, where studying abroad is
                    a real advantage, and <strong>your next 12 months</strong> — the projects and experiences that build the
                    profile that career looks for.
                </>
            ),
        },
        {
            q: "Will AI take my job?",
            a: (
                <>
                    AI is redrawing the map: AI, data, cloud and cybersecurity are now the most in-demand skills in India,
                    and routine roles are shrinking (India Skills Report 2026). Every career we recommend shows{" "}
                    <strong>how exposed it is to AI</strong> and which part of the work it touches.
                </>
            ),
        },
        {
            q: "Will my degree make me job-ready?",
            a: (
                <>
                    Not on its own. <strong>About 44% of Indian graduates still aren't considered job-ready</strong>{" "}
                    (India Skills Report 2026). Usually it isn't ability — it's a direction that never fit. We count every
                    career from where you stand: what your degree already covers, and what's left.
                </>
            ),
        },
        {
            q: "Is that expensive master's or course worth it?",
            a: (
                <>
                    Check before you pay. Each career shows the <strong>cost to qualify, starting and mid-career pay</strong>{" "}
                    in India, and whether a master's is needed, helps, or usually isn't needed.
                </>
            ),
        },
        {
            q: "How do I get job- and interview-ready?",
            a: (
                <>
                    Start with the right target. Your first steps for each career are right on its card, a mentor who does
                    the job can tell you what they look for — and help with internships, jobs and a starter skill kit is on
                    our waitlist.
                </>
            ),
        },
        {
            q: "Where do I go if I don't make it into the usual competitive paths?",
            a: (
                <>
                    Somewhere better suited, often. <strong>Only 8.25% of Indian graduates work in jobs that match their
                    qualifications</strong> (NITI Aayog, citing the Economic Survey 2024–25) — so the "usual path" isn't
                    where most people end up anyway. Your report shows the careers that fit you, beyond the two or three
                    everyone chases.
                </>
            ),
        },
        {
            q: "Nine of us are chasing the same seat. What happens to the rest?",
            a: (
                <>
                    In a batch of ten aiming for the same thing, one gets in — and too often the other nine settle. You
                    don't have to. We rank careers from 1,000+ by how they fit you, including ones you've never heard of
                    and careers that combine two fields, so "plan B" can be a plan you actually want.
                </>
            ),
        },
    ],
    professional: [
        {
            q: "Will AI take my job?",
            a: (
                <>
                    AI is redrawing the map: AI, data, cloud and cybersecurity are now the most in-demand skills in India,
                    and routine roles are shrinking (India Skills Report 2026). Every career we show you carries{" "}
                    <strong>how exposed it is to AI</strong> and which part of the work it touches — including the one
                    you're in.
                </>
            ),
        },
        {
            q: "I don't have a strong network. How do I get a referral and move forward?",
            a: (
                <>
                    Start with one real conversation. A mentor plan connects you with <strong>a professional in the job role
                    you choose</strong> — a one-hour session and a follow-up. We don't promise referrals; we give you someone
                    who knows the road and can tell you how people really get in.
                </>
            ),
        },
        {
            q: "My job isn't what I expected. How do I know the drawbacks before I start the next one?",
            a: (
                <>
                    Ask before you leap. Each career shows the honest parts too — <strong>what to work on</strong>, the
                    money at each stage, demand and AI exposure, and notes worth knowing — and a mentor who does that job
                    tells you what a normal week is really like.
                </>
            ),
        },
        {
            q: "Do I keep upskilling to fit the system — or keep switching paths? Is there a third way?",
            a: (
                <>
                    There is: build your own path. Most people either keep upskilling along the one road their degree
                    shows, or hop from path to path. We start from your story and strengths, show where your experience
                    carries over — including careers that combine two fields — and what each move would really cost.
                </>
            ),
        },
        {
            q: "I'm already working. Isn't it too late — or too risky — to explore?",
            a: (
                <>
                    The first one to four years after graduating are early to switch — you've only just started. And{" "}
                    <strong>only 8.25% of Indian graduates work in jobs that match their qualifications</strong> (NITI
                    Aayog, citing the Economic Survey 2024–25), so why stay stuck to a degree? We show what carries over,
                    how many years a switch would leave behind, and how long from now each career takes.
                </>
            ),
        },
    ],
}

// what all three ask — shown inside each audience's own list, after its questions (owner, Round 37: not a
// separate block). None repeats a question an audience already asks in its own words.
export const COMMON_QUESTIONS = [
    {
        q: "I don't know what I want, what I'm capable of, or what fits my values.",
        a: (
            <>
                That's where everyone starts. <strong>Virtual Career Counselling</strong> walks through four stages of your
                life — what you did, what stuck and why — and the assessment measures <strong>31 factors</strong> about how
                you think and what drives you. Together they point to careers that fit you, not a generic list.
            </>
        ),
    },
    {
        q: "I don't know what I'm interested in — I've hardly been exposed to anything.",
        a: (
            <>
                With your story, not a quiz. Small things count — what you did at school, at home, with friends. We find the
                thread and show you careers from <strong>1,000+ careers and job roles</strong>, many you've never heard of.
                Try the free 5-minute <Link to="/try-demo">demo</Link> to see how it works.
            </>
        ),
    },
    {
        q: "Can I talk to someone who's done it?",
        a: (
            <>
                Yes. With a mentor plan you get <strong>a professional in the job role you choose</strong> — a one-hour
                clarity session and a 20-minute follow-up, matched within 20 business days. Real experience, not generic
                advice.
            </>
        ),
    },
    {
        q: "Why do I only know a handful of careers?",
        a: (
            <>
                Because nobody shows you the rest. <strong>93% of Indian students are aware of only seven career
                options</strong> (India Today survey). We rank your matches from <strong>1,000+ careers and job
                roles</strong> — including ones you've never heard of, and careers that combine two fields.
            </>
        ),
    },
    {
        q: "Too many options — I'm scared of missing out on the right one.",
        a: (
            <>
                Narrow it with facts, not fear. Your list is ranked by how each career fits you, and you can sort it, filter
                it by sector and <strong>compare two or three side by side</strong> — pay, demand, AI exposure and how long
                each takes from where you are.
            </>
        ),
    },
    {
        q: "My parents or society expect something else from me.",
        a: (
            <>
                You're not alone, and it doesn't have to be a fight. Your report puts the facts on the table — the road,
                the cost, the pay and the demand for each career that fits you — which makes an honest conversation at home
                much easier.
            </>
        ),
    },
    {
        q: "How do I build a particular career from where I am — and what are its challenges?",
        a: (
            <>
                Every career card shows <strong>how people get there</strong> from your stage, the exams, the money, what to
                work on and <strong>your next 12 months</strong> — and a mentor in that role can tell you the challenges no
                brochure mentions.
            </>
        ),
    },
    {
        q: "Athletes and marketers have trackers for their performance. What tells me where to go in the first place?",
        a: (
            <>
                A map of you, before any profession's tracker. Our assessment measures <strong>31 factors</strong> — the four
                core fundamentals, personality, thinking abilities (our own reasoning puzzles, memory games and a focus game
                timed to the millisecond), the areas you're drawn to and how you solve problems — each built on established
                research, which the assessment explains part by part. Tests are taken once, because a second try scores
                higher from practice alone, and anything we couldn't measure is marked "not measured", never low.
            </>
        ),
    },
    {
        q: "I've found something new I love — how do I make it real?",
        a: (
            <>
                Every career shows the path and your next 12 months, and your mentor can help you make it your work — or
                carry it forward as a passion alongside whatever pays.
            </>
        ),
    },
    {
        q: "My past choices feel wrong — is it too late?",
        a: (
            <>
                No. Your past doesn't define you. We show what carries over, how many years a switch would leave behind and
                how long from now each career takes — so a change is a plan, not a leap.
            </>
        ),
    },
    {
        q: "I went to a career counsellor before, and the results didn't match my interests.",
        a: (
            <>
                That's why we start differently. Our counselling asks <strong>your story first</strong> and recommends
                careers on that basis; it doesn't box you in by an intelligence score; and it shows you the gaps between
                you and each career we recommend — then helps you fill them.
            </>
        ),
    },
    {
        q: "What is a Freshmxn mentor like?",
        a: (
            <>
                A personalised, safe space with someone like an older sibling — <strong>a mid-level professional</strong> in
                the job role you choose. We choose mentors for how empathetic they are, not just on merit.
            </>
        ),
    },
    // the practical ones (owner, Round 37) — how long, the price, privacy, and a difficulty never counting against you
    {
        q: "How long does it take?",
        a: (
            <>
                About 60–75 minutes of counselling and about 81 minutes of assessment, at your own pace — your answers save
                as you go, so you can stop and come back on any device. Want a taste first? The{" "}
                <Link to="/try-demo">free demo</Link> takes 5 minutes.
            </>
        ),
    },
    {
        q: "What if I can't afford it — or don't like my results?",
        a: (
            <>
                After signing up you can <strong>ask for financial aid</strong> — we look at every request. And if you don't
                like your results, give us quick feedback and <strong>we'll refund you</strong>, on any plan.
            </>
        ),
    },
    {
        q: "Who sees my answers?",
        a: (
            <>
                Your answers are used to build your analysis and, without your name, to improve our career data — never
                sold, never used for advertising. A résumé you
                attach is read once to list its activities and then deleted. With a mentor plan, your mentor sees a short
                brief to prepare — your education and a few highlights — never your scores.
            </>
        ),
    },
    {
        q: "I have a learning difficulty or a disability. Will it count against me?",
        a: (
            <>
                Never. Tell us about it and the timed tests it affects are set aside — marked "not measured", never a low
                score. It never ranks, hides or scores a career.
            </>
        ),
    },
]

// a parent often decides with a school student (owner, Round 37: the parents' questions are for school only)
const PARENT_QUESTIONS = [
    {
        q: "I'm a parent. How does this help my child?",
        a: (
            <>
                Your child tells their own story and takes the assessment online, at their own pace. The report shows the
                careers that fit them — with the subjects, exams, cost, pay, demand and AI exposure of each — so the
                conversation at home starts from facts. If your child is under 18, we email you to confirm your permission.
            </>
        ),
    },
    {
        q: "My child wants a career I know little about. What should we do?",
        a: (
            <>
                Read its card together: what the work is, how people get there, what it costs and pays, and how in demand
                it is. With a mentor plan, your child can talk one to one with someone who does that job.
            </>
        ),
    },
]

// one audience's whole list: its own questions (school: then the parents'), then what everyone asks
export const questionsFor = (audience) => [
    ...AUDIENCE_QUESTIONS[audience],
    ...(audience === "school" ? PARENT_QUESTIONS : []),
    ...COMMON_QUESTIONS.filter((item) => !AUDIENCE_QUESTIONS[audience].some((own) => own.q === item.q)),
]
