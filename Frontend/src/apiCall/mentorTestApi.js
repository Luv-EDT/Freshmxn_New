import axiosInstance from "./axiosInstance"

// Round 34: the mentor competence test — the mentor's own, and the admin's review

const call = async (request) => {
    try {
        return await request()
    } catch (error) {
        return error.response
    }
}

export const getMyTest = () => call(() => axiosInstance.get("/mentorTest/getMine"))
export const saveMyTest = (payload) => call(() => axiosInstance.put("/mentorTest/saveMine", payload))
export const getVideoUploadUrl = (payload) => call(() => axiosInstance.post("/mentorTest/videoUploadUrl", payload))
// Round 35: the booking links after the test (they're asked only on the Test tab)
export const saveMyLinks = (payload) => call(() => axiosInstance.put("/mentorTest/saveMyLinks", payload))
export const submitMyTest = () => call(() => axiosInstance.post("/mentorTest/submitMine", {}))

export const getMentorTestForAdmin = (mentorUserId) => call(() => axiosInstance.get(`/mentorTest/getForAdmin/${mentorUserId}`))
export const decideMentorTestForAdmin = (mentorUserId, payload) => call(() => axiosInstance.put(`/mentorTest/decideForAdmin/${mentorUserId}`, payload))
