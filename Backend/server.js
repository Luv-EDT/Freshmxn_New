const express = require("express")
const dotenv = require("dotenv")

dotenv.config()

// every login signs a JWT with this — refuse to start without it rather than fail on the first signup
if (!process.env.JWT_SECRET) {
    console.log("JWT_SECRET is missing in Backend/.env — the server cannot start without it.")
    process.exit(1)
}

// email isn't fatal like the JWT secret, but a silent misconfiguration means password resets and
// email confirmations vanish with no sign of it, so say so at boot
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.log("RESEND_API_KEY or EMAIL_FROM is missing in Backend/.env — reset and confirmation emails will fail.")
}

const userRouter = require("./Routers/userRouter")
const authRouter = require("./Routers/authRouter")
const paymentsRouter = require("./Routers/paymentsRouter")
const couponsRouter = require("./Routers/couponsRouter")
const submissionsRouter = require("./Routers/submissionsRouter")
const professionsRouter = require("./Routers/professionsRouter")
const reportsRouter = require("./Routers/reportsRouter")
const storyRouter = require("./Routers/storyRouter")
const externalTestsRouter = require("./Routers/externalTestsRouter")

const cors = require("cors")
const path = require("path")

const db = require("./config/MongoDBCon.js") // writing db is optional. Just the require(), runs the entire file.

const app = express()

// Render sits in front of the server — without this every request looks like it comes from Render's IP,
// and the login rate limiter would lock out every student at once
app.set("trust proxy", 1)

const allowedOrigins = [
    "http://localhost:3000",
    process.env.FRONTEND_URL,
]

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true)
            } else {
                callback(new Error("Not allowed by CORS"))
            }
        },
        credentials: true,
    })
)

const PORT = process.env.PORT
// console.log(process.env.PORT)

// mounted BEFORE express.json() — the Razorpay webhook needs the raw body for its signature check.
// every other route in this router adds express.json() itself.
app.use("/payments", paymentsRouter)

// Screenshots of external test results arrive as base64 inside a JSON body, and base64 is a third
// larger than the bytes it carries. The default 100 kB limit rejects every real phone screenshot
// with a bare 413, so this one route gets its own parser BEFORE the default one is mounted. The
// limit is not global on purpose: every other endpoint takes answers, and a 6 MB body anywhere else
// is a mistake or an attack, not a student.
app.use("/external", express.json({ limit: "8mb" }), externalTestsRouter)

app.use(express.json())
app.use("/user", userRouter)
app.use("/auth", authRouter)
app.use("/coupons", couponsRouter)
app.use("/submissions", submissionsRouter)
app.use("/professions", professionsRouter)
app.use("/reports", reportsRouter)
app.use("/story", storyRouter)

// serve the built React app — Frontend/build only exists after `npm run build`
const buildPath = path.join(__dirname, "../Frontend/build")
app.use(express.static(buildPath))

// Express 5: a bare "*" crashes, and "/*splat" skips "/". "/{*splat}" matches everything, root included.
// registered after every API router so it can never swallow an API call
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"), (err) => {
        if (err) {
            res.status(404).json({
                success: false,
                message: "Not found"
            })
        }
    })
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})

// ── the workers, hosted in this process on the free tier ────────────────────────────────────────
//
// Render's free plan runs web services only; a background worker is a paid service each. So when
// RUN_WORKERS_IN_WEB is "true" the two BullMQ workers run here, inside the web process, instead of
// as their own processes. Nothing about them changes — same queue, same retries, same code; start()
// is exactly what `npm run worker:score` / `worker:report` call. Leave the flag unset locally and
// keep running the workers in their own terminals; flip it off in production once the workers
// move to their own paid services, with no code change.
//
// Started after listen() so a slow Redis can never hold up the site itself.
const workers = []

if (process.env.RUN_WORKERS_IN_WEB === "true") {
    Promise.all([
        require("./workers/scoreProfileWorker").start(),
        require("./workers/generateReportWorker").start(),
    ])
        .then((started) => workers.push(...started))
        .catch((error) => console.log("Workers failed to start inside the web process:", error.message))
}

// Render sends SIGTERM on every redeploy and gives ~30 s before killing the process. close() lets
// an in-flight job finish rather than orphaning it. A job that outlives the grace period is not
// lost: its lock expires and the next instance's stalled-job sweep puts it back on the queue.
process.on("SIGTERM", async () => {
    await Promise.all(workers.map((worker) => worker.close().catch(() => null)))
    process.exit(0)
})
