import axiosInstance from "./axiosInstance"

// Round 36 (owner): read a résumé into activity names — the file is never stored
const call = async (request) => {
    try {
        return await request()
    } catch (error) {
        return error.response
    }
}

export const readResumeForDemo = (payload) => call(() => axiosInstance.post("/resumeReader/demo", payload))
export const readMyResume = (payload) => call(() => axiosInstance.post("/resumeReader/mine", payload))
