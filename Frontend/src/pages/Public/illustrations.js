// Small inline SVG illustrations for the public pages — no image files, so they stay sharp on any
// screen, inherit the brand colours and cost nothing to load. Navy strokes, teal and pink fills.

const NAVY = "#1E2A38"
const TEAL = "#007582"
const PINK = "#FFB3C7"

const stroke = { fill: "none", stroke: NAVY, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" }

const ICONS = {
    // 01 · we get to know you — a speech bubble
    listen: (
        <>
            <path d="M10 14c0-4 3-7 7-7h30c4 0 7 3 7 7v20c0 4-3 7-7 7H28l-11 9v-9h0c-4 0-7-3-7-7z" fill={PINK} />
            <path d="M10 14c0-4 3-7 7-7h30c4 0 7 3 7 7v20c0 4-3 7-7 7H28l-11 9v-9h0c-4 0-7-3-7-7z" {...stroke} />
            <circle cx="22" cy="24" r="2.5" fill={NAVY} />
            <circle cx="32" cy="24" r="2.5" fill={NAVY} />
            <circle cx="42" cy="24" r="2.5" fill={NAVY} />
        </>
    ),
    // 02 · we measure what you're wired for — a head with a spark
    measure: (
        <>
            <path d="M34 8c11 0 19 8 19 18 0 6-3 10-6 13v11H27v-6h-6c-3 0-5-2-5-5v-6l-5-2 5-8c1-9 8-15 18-15z" fill="#FFFFFF" />
            <path d="M34 8c11 0 19 8 19 18 0 6-3 10-6 13v11H27v-6h-6c-3 0-5-2-5-5v-6l-5-2 5-8c1-9 8-15 18-15z" {...stroke} />
            <path d="M33 16l-4 10h8l-4 10" fill="none" stroke={TEAL} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
    ),
    // 03 · where you fit — a compass
    compass: (
        <>
            <circle cx="32" cy="32" r="22" fill="#FFFFFF" />
            <circle cx="32" cy="32" r="22" {...stroke} />
            <path d="M41 23l-5 13-13 5 5-13z" fill={TEAL} stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="32" cy="32" r="2.5" fill="#FFFFFF" />
        </>
    ),
    // 04 · someone who's been there — two people
    mentor: (
        <>
            <circle cx="23" cy="22" r="8" fill={PINK} />
            <circle cx="23" cy="22" r="8" {...stroke} />
            <circle cx="43" cy="20" r="9" fill={TEAL} />
            <circle cx="43" cy="20" r="9" {...stroke} />
            <path d="M9 52c0-8 6-14 14-14s14 6 14 14" {...stroke} />
            <path d="M28 52c1-9 7-16 15-16s15 7 15 16" {...stroke} />
        </>
    ),
}

export function StepIcon({ name }) {
    return (
        <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
            {ICONS[name]}
        </svg>
    )
}

// a loose, hand-drawn arrow — the brand mark's motion, as a doodle beside the hero card
export function ArrowDoodle({ className }) {
    return (
        <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
            <path
                d="M8 70c10-30 36-52 66-54 14-1 26 4 34 12"
                fill="none"
                stroke={NAVY}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <path d="M98 12l12 16-19 4" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 82c6-2 12-2 18 0" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
        </svg>
    )
}
