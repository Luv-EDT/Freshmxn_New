const mongoose = require("mongoose")
const AppSetting = require("../model/appSettingsModel")

// HOW FULL THE DATABASE IS (owner, Round 29). Atlas's free tier (M0) holds 512 MB of storage — data
// plus indexes, as stored. The admin's AI usage card shows the share used and the biggest collections;
// it turns amber at 70%, and at 85% the admin is emailed once a month. DB_LIMIT_MB changes the limit
// after a move to a paid tier.
const limitMb = () => Number(process.env.DB_LIMIT_MB) || 512
const AMBER_AT = 0.7
const ALERT_AT = 0.85

const mb = (bytes) => Math.round(((bytes || 0) / 1048576) * 10) / 10

// the share used, the colour it shows in, and whether the admin should be told (pure — fixtures)
const dbLevel = (usedMb, limit = limitMb()) => {
    const share = limit > 0 ? usedMb / limit : 0
    return { share: Math.round(share * 1000) / 10, amber: share >= AMBER_AT, alert: share >= ALERT_AT }
}

const dbStats = async () => {
    const db = mongoose.connection.db
    const stats = await db.stats()
    const usedMb = mb((stats.storageSize || stats.dataSize || 0) + (stats.indexSize || 0))

    // the five biggest collections — a database that can't report one simply leaves it out
    const sizes = []
    for (const { name } of await db.listCollections().toArray()) {
        try {
            const coll = await db.command({ collStats: name })
            sizes.push({ name, mb: mb((coll.storageSize || coll.size || 0) + (coll.totalIndexSize || 0)) })
        } catch (error) {
            // not every server answers collStats
        }
    }
    sizes.sort((left, right) => right.mb - left.mb)

    const level = dbLevel(usedMb)
    if (level.alert) {
        const key = `db_alert:${new Date().toISOString().slice(0, 7)}`
        const sent = await AppSetting.findOneAndUpdate({ key }, { $setOnInsert: { value: true } }, { upsert: true, returnDocument: "before" }).lean()
        if (!sent) {
            require("./mailer").notifyAdmin("The database is 85% full", `<p>The database uses ${usedMb} MB of ${limitMb()} MB (${level.share}%). Move to a paid Atlas tier, or trim old history — DEPLOY.md says how.</p>`)
        }
    }

    return { usedMb, limitMb: limitMb(), collections: stats.collections, ...level, biggest: sizes.slice(0, 5) }
}

module.exports = { dbStats, dbLevel }
