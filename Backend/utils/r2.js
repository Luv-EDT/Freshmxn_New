// CLOUDFLARE R2 — where a mentor's test video waits for the admin (owner, Round 34). R2 speaks the S3
// protocol, so the AWS SDK talks to it. The bucket is private: the mentor's browser uploads straight to
// it on a 15-minute signed link (the video never passes through our server), the admin watches it on
// another 15-minute signed link, and the file is deleted as soon as the admin decides.
//
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET. Without them `configured()`
// is false and the test page asks for a link (Loom, Google Drive) instead — nothing breaks.

const LINK_SECONDS = 15 * 60
const MAX_BYTES = 1024 * 1024 * 1024   // Round 35: 1 GB — a 10-minute phone video (.MOV) is often 400–700 MB
const VIDEO_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }

let client = null

// Round 35: the values as pasted on Render, forgiving stray spaces, and an account id pasted as the
// whole endpoint ("https://<id>.r2.cloudflarestorage.com") — either made every upload "drop"
const env = (name) => String(process.env[name] || "").trim()
const accountId = () => env("R2_ACCOUNT_ID").replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/\/.*$/, "")
const bucket = () => env("R2_BUCKET")

const configured = () => Boolean(accountId() && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && bucket())

const s3 = () => {
    if (!client) {
        const { S3Client } = require("@aws-sdk/client-s3")
        client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId()}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
            // https://<account>.r2.cloudflarestorage.com/<bucket>/<key> — the address form R2 always accepts
            forcePathStyle: true,
            // Round 35: newer AWS SDKs bake a checksum of the EMPTY body into every signed upload link,
            // so R2 refused the real video ("The upload didn't finish"). Checksums only when an
            // operation needs one.
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
        })
    }
    return client
}

const signed = (command) => require("@aws-sdk/s3-request-presigner").getSignedUrl(s3(), command, { expiresIn: LINK_SECONDS })

const uploadUrl = (key, contentType) => {
    const { PutObjectCommand } = require("@aws-sdk/client-s3")
    return signed(new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }))
}

const viewUrl = (key) => {
    const { GetObjectCommand } = require("@aws-sdk/client-s3")
    return signed(new GetObjectCommand({ Bucket: bucket(), Key: key }))
}

// never throws: a failed delete is logged and reported, and the daily clean-up tries again
const removeObject = async (key) => {
    if (!key || !configured()) return { deleted: false }
    try {
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3")
        await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
        return { deleted: true }
    } catch (error) {
        console.error(`R2: could not delete ${key}: ${error.message}`)
        return { deleted: false, error: error.message }
    }
}

// THE ADMIN'S STORAGE CHECK (Round 35): can the server write and delete with these keys, and what do the
// bucket's CORS rules allow (a browser upload needs PUT and the Content-Type header from our site)?
const check = async () => {
    const result = { configured: configured(), accountId: accountId() ? `${accountId().slice(0, 6)}…` : null, bucket: bucket() || null }
    if (!result.configured) return result
    const { PutObjectCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3")
    const key = `storage-check/server-${Date.now()}.txt`
    try {
        await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: "ok", ContentType: "text/plain" }))
        result.serverWrite = { ok: true }
        await removeObject(key)
    } catch (error) {
        result.serverWrite = { ok: false, error: `${error.name || "Error"}: ${error.message}` }
    }
    try {
        const cors = await s3().send(new GetBucketCorsCommand({ Bucket: bucket() }))
        result.cors = { rules: cors.CORSRules || [] }
    } catch (error) {
        result.cors = { error: `${error.name || "Error"}: ${error.message}` }
    }
    return result
}

module.exports = { configured, uploadUrl, viewUrl, removeObject, check, MAX_BYTES, VIDEO_TYPES, LINK_SECONDS }
