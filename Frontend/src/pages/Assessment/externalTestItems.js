// The two external tests, as the student meets them — 04_Item_Bank.md §7.
//
// ONE CONFIG, TWO TESTS. They differ in the link, the warning, the extra typed field and which
// numbers are read back; everything else — the warning screen, the upload, the confirmation — is
// identical, and building them twice would mean fixing every upload bug twice.
//
// THE PRE-TEST WARNING IS QUOTED FROM THE SPEC and shown before the link, not after it. §7 puts it
// "before every external link" for a reason a student feels rather than reads: once the test has
// started there is no undo, and telling someone afterwards that they only had one attempt is not a
// warning, it is an apology.

export const EXTERNAL_TESTS = {
    extReasoning: {
        key: "extReasoning",
        title: "Reasoning test",
        url: "https://www.assessmentday.co.uk/logic/free/LogicalReasoningTest1/",
        siteName: "AssessmentDay",
        minutes: 15,
        what: "Ten logic puzzles with shapes. There is nothing to revise — it is about spotting the pattern.",
        // The typed field exists because it is the ONLY validity gate on this instrument, and the
        // screenshot does not always show it. The server prefers whatever it can read off the
        // image; this is the fallback. See extractTestResult.js.
        asksSeconds: true,
        secondsLabel: "Average time per question, as shown on your results page (in seconds)",
        measures: "how you work out patterns you have never been taught",
        // Which extracted fields to read back for confirmation, and how to say them.
        readBack: [
            { field: "percentile", label: "Percentile" },
            { field: "score_raw", label: "Score", suffix: " out of 10" },
            { field: "seconds_per_question", label: "Average time per question", suffix: " seconds" },
        ],
        shotOf: "the results page showing your percentile and your score out of 10",
    },
    extVerbal: {
        key: "extVerbal",
        title: "Word memory test",
        url: "https://mindcrowd.org/",
        siteName: "MindCrowd",
        minutes: 10,
        what: "You are shown pairs of words, then asked to recall them. It is a memory task, not a vocabulary one.",
        asksSeconds: false,
        measures: "how much you hold on to after a delay",
        readBack: [
            { field: "your_score", label: "Your score", suffix: " out of 36" },
            { field: "peer_average", label: "Average for your age", suffix: " out of 36" },
        ],
        shotOf: "the results page showing your score and the averages next to it",
    },
}

export const EXTERNAL_KEYS = Object.keys(EXTERNAL_TESTS)

// ── the screenshot, made small enough to send ───────────────────────────────────────────────────
//
// A SCREENSHOT FROM A PHONE IS NOT A SMALL FILE. A modern Android screenshot is 1080×2400 PNG, and
// a photo of a laptop screen taken with the same phone is 4000×3000 and eight megabytes. Sent
// straight up, that is a minute of upload on a slow connection, a rejected request at the body
// limit, and a bill for tokens spent on pixels nobody needed — the numbers are legible at a
// fraction of the size.
//
// SO THE RESIZE HAPPENS HERE, on the device, before anything is sent. It is also the difference
// between the upload working and not working at all on the phones this product is actually used
// on, which is why it is not an optimisation.
//
// JPEG AT 0.85, NOT PNG. Text on a flat background survives it, and the file is five to ten times
// smaller than the equivalent PNG.

const MAX_EDGE = 1600      // enough to read a results table, small enough to send on 3G
const QUALITY = 0.85

export const shrinkImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error("That file could not be opened"))

    reader.onload = () => {
        const image = new Image()

        image.onerror = () => reject(new Error("That file is not an image we can read"))

        image.onload = () => {
            const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
            const width = Math.round(image.width * scale)
            const height = Math.round(image.height * scale)

            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height

            const context = canvas.getContext("2d")

            // A screenshot with transparency (PNG) goes black on a JPEG background otherwise, and a
            // black results page is unreadable to the model and to the student checking it.
            context.fillStyle = "#ffffff"
            context.fillRect(0, 0, width, height)
            context.drawImage(image, 0, 0, width, height)

            try {
                resolve({ dataUrl: canvas.toDataURL("image/jpeg", QUALITY), width, height })
            } catch (error) {
                // Older mobile browsers throw on a canvas they consider tainted. Falling back to
                // the original file is worse than failing loudly here, because it would send eight
                // megabytes over a phone connection and time out with no explanation.
                reject(new Error("This browser could not prepare the image — try uploading from another device"))
            }
        }

        image.src = reader.result
    }

    reader.readAsDataURL(file)
})
