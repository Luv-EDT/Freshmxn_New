// The "one attempt only" notice, shown before every section that cannot be retaken.
//
// FOUR SECTIONS SHARE THIS RULE and they must not each say it differently. A student who meets a
// firm warning on the reasoning test and a mild aside on the number task will read the mild one as
// a suggestion — and only find out it was not when they come back to redo it.
//
// IT GOES BEFORE, NEVER AFTER. 04_Item_Bank.md §7 puts the warning ahead of the link for a reason a
// student feels rather than reads: once it has started there is no undo, and telling someone
// afterwards that they had one attempt is not a warning, it is an apology.
//
// WHY THESE FOUR CANNOT BE RETAKEN, and it is the same reason every time: a second attempt does not
// measure the same thing. You now know the format, the pace, and roughly what is coming. That
// raises the score independently of the ability being measured, so a retaken score is not
// comparable with anyone else's — including your own from the first time.

function OneAttemptWarning({ minutes, reason }) {
    return (
        <div style={{ border: "2px solid #b00", padding: "16px", margin: "16px 0" }}>
            <h3 style={{ marginTop: 0 }}>One attempt only. You cannot retake this.</h3>

            <p>Find a quiet place and take your time. Most people need about {minutes} minutes.</p>

            <p>Rushing produces a score that does not reflect you, and we cannot undo it.</p>

            {reason && <p style={{ marginBottom: 0 }}>{reason}</p>}
        </div>
    )
}

export default OneAttemptWarning
