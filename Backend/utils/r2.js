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

const configured = () => Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET)

const s3 = () => {
    if (!client) {
        const { S3Client } = require("@aws-sdk/client-s3")
        client = new S3Client({
            region: "auto",
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
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
    return signed(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType }))
}

const viewUrl = (key) => {
    const { GetObjectCommand } = require("@aws-sdk/client-s3")
    return signed(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
}

// never throws: a failed delete is logged and reported, and the daily clean-up tries again
const removeObject = async (key) => {
    if (!key || !configured()) return { deleted: false }
    try {
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3")
        await s3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
        return { deleted: true }
    } catch (error) {
        console.error(`R2: could not delete ${key}: ${error.message}`)
        return { deleted: false, error: error.message }
    }
}

module.exports = { configured, uploadUrl, viewUrl, removeObject, MAX_BYTES, VIDEO_TYPES, LINK_SECONDS }
