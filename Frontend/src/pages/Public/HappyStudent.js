// The landing hero's picture (owner, Round 10): a happy student, in place of the text-heavy
// "ranked matches" card. Inline SVG in the brand colours — no external image, nothing to load, and
// it scales cleanly from a phone to a desktop. Purely decorative, so it is hidden from screen readers.
function HappyStudent({ className }) {
    return (
        <svg className={className} viewBox="0 0 360 380" role="img" aria-hidden="true" focusable="false">
            {/* soft ground shadow */}
            <ellipse cx="180" cy="352" rx="118" ry="14" fill="#1E2A38" opacity="0.08" />

            {/* backpack, behind the body */}
            <rect x="104" y="176" width="58" height="110" rx="22" fill="#0B5C66" />
            <rect x="112" y="226" width="40" height="36" rx="10" fill="#007582" />

            {/* legs and shoes */}
            <rect x="148" y="282" width="26" height="62" rx="12" fill="#1E2A38" />
            <rect x="186" y="282" width="26" height="62" rx="12" fill="#1E2A38" />
            <ellipse cx="158" cy="346" rx="22" ry="9" fill="#FFB3C7" />
            <ellipse cx="202" cy="346" rx="22" ry="9" fill="#FFB3C7" />

            {/* body — a teal hoodie */}
            <path d="M126 202c0-30 24-52 54-52s54 22 54 52v80c0 10-8 16-18 16h-72c-10 0-18-6-18-16z" fill="#007582" />
            <path d="M160 152h40v18c0 11-9 20-20 20s-20-9-20-20z" fill="#0B5C66" />

            {/* the arm raised in a cheer */}
            <path d="M228 196c14-8 26-30 30-58" stroke="#007582" strokeWidth="22" strokeLinecap="round" fill="none" />
            <circle cx="259" cy="132" r="13" fill="#C98B62" />

            {/* the other arm holding a phone */}
            <path d="M134 208c-10 18-8 40 4 54" stroke="#007582" strokeWidth="22" strokeLinecap="round" fill="none" />
            <rect x="140" y="240" width="30" height="46" rx="6" fill="#1E2A38" transform="rotate(-12 155 263)" />
            <rect x="145" y="246" width="20" height="30" rx="3" fill="#E6F4F5" transform="rotate(-12 155 263)" />
            <circle cx="143" cy="268" r="11" fill="#C98B62" />

            {/* head */}
            <rect x="171" y="128" width="18" height="22" rx="8" fill="#B87A52" />
            <circle cx="180" cy="104" r="38" fill="#C98B62" />
            {/* hair */}
            <path d="M142 100c0-26 18-42 40-42 20 0 36 12 38 34-10-8-22-12-36-10-14 2-26 10-42 18z" fill="#1E2A38" />
            {/* eyes closed in a smile, cheeks, grin */}
            <path d="M162 104q6-6 12 0" stroke="#1E2A38" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M188 104q6-6 12 0" stroke="#1E2A38" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="160" cy="116" r="6" fill="#FFB3C7" opacity="0.8" />
            <circle cx="202" cy="116" r="6" fill="#FFB3C7" opacity="0.8" />
            <path d="M168 120q12 14 26 0z" fill="#1E2A38" />
            <path d="M172 121q9 7 18 0z" fill="#FFFFFF" />

            {/* sparkles of "got it" around the raised hand */}
            <path d="M286 92l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#FFB3C7" />
            <path d="M246 82l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#007582" />
            <path d="M300 150l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#1E2A38" opacity="0.6" />

            {/* a path rising behind them, the brand's arrow motif */}
            <path d="M54 300c40-10 60-60 96-82" stroke="#1E2A38" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 12" fill="none" opacity="0.35" />
            <path d="M40 250l26-26M66 224h-20M66 224v20" stroke="#007582" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    )
}

export default HappyStudent
