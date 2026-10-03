const mongoose = require("mongoose")

// SETTINGS THE ADMIN CHOOSES ON SCREEN (Round 12) — one row per key. Today only one:
//
//     research_model   the model the monthly research jobs use, chosen after the one-time
//                      comparison (housekeeping/modelCompare.js). REFRESH_MODEL in the
//                      environment still wins over it (utils/researchModel.js).

const appSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
        },
        setBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

const AppSetting = mongoose.model("AppSetting", appSettingSchema)

module.exports = AppSetting
