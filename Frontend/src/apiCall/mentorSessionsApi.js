import axiosInstance from "./axiosInstance"

// Rounds 28 and 34: around a mentor session — the mentor's students, the student's feedback and report

const call = async (request) => {
    try {
        return await request()
    } catch (error) {
        return error.response
    }
}

// the mentor
export const getMyStudents = () => call(() => axiosInstance.get("/mentorSessions/getMyStudents"))
export const acceptPrivacy = (id) => call(() => axiosInstance.put(`/mentorSessions/acceptPrivacy/${id}`, { accept: true }))

// the student
export const getMySessionState = () => call(() => axiosInstance.get("/mentorSessions/getMine"))
export const saveMyReview = (payload) => call(() => axiosInstance.post("/mentorSessions/saveMyReview", payload))
export const reportMentor = (payload) => call(() => axiosInstance.post("/mentorSessions/reportMentor", payload))

// admin
export const markWhatsappInviteForAdmin = (studentId) => call(() => axiosInstance.put(`/mentorSessions/markWhatsappInviteForAdmin/${studentId}`, {}))
export const getMentorFeedbackForAdmin = () => call(() => axiosInstance.get("/mentorSessions/getFeedbackForAdmin"))
export const resolveMentorReportForAdmin = (id, payload) => call(() => axiosInstance.put(`/mentorSessions/resolveReportForAdmin/${id}`, payload))
