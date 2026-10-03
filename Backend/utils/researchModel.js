// WHICH MODEL THE MONTHLY RESEARCH JOBS USE (Round 12). In order:
//   1. REFRESH_MODEL in the environment — set on Render, it always wins
//   2. the admin's choice after the one-time comparison (AppSetting "research_model")
//   3. Claude Opus 5.5
// The scout and career drafting use it too, so all research runs on one model.

const mongoose = require("mongoose")

const DEFAULT_RESEARCH_MODEL = "claude-opus-5-5"
const RESEARCH_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"]

const researchModel = async () => {
    if (process.env.REFRESH_MODEL) return process.env.REFRESH_MODEL
    try {
        if (mongoose.connection.readyState !== 1) return DEFAULT_RESEARCH_MODEL
        const AppSetting = require("../model/appSettingsModel")
        const setting = await AppSetting.findOne({ key: "research_model" }).lean()
        return setting && RESEARCH_MODELS.includes(setting.value) ? setting.value : DEFAULT_RESEARCH_MODEL
    } catch (error) {
        console.error(`researchModel: could not read the setting — ${error.message}`)
        return DEFAULT_RESEARCH_MODEL
    }
}

module.exports = { researchModel, DEFAULT_RESEARCH_MODEL, RESEARCH_MODELS }
