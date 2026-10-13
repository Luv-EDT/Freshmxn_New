import axiosInstance from "./axiosInstance"

// Auth API functions catch and return error.response, so a 400/401/404 still resolves
// and the page can branch on response.data.message

export async function registerUser(payload) {
    try {
        const response = await axiosInstance.post("/user/register", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function loginUser(payload) {
    try {
        const response = await axiosInstance.post("/user/login", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function forgotPassword(payload) {
    try {
        const response = await axiosInstance.post("/user/forgotPassword", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function resetPassword(token, payload) {
    try {
        const response = await axiosInstance.post(`/user/resetPassword/${token}`, payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function getCurrentUser() {
    try {
        const response = await axiosInstance.get("/user/getCurrentUser")
        return response
    } catch (error) {
        return error.response
    }
}

export async function getCurrentAdmin() {
    try {
        const response = await axiosInstance.get("/user/getCurrentAdmin")
        return response
    } catch (error) {
        return error.response
    }
}

export async function getCurrentMentor() {
    try {
        const response = await axiosInstance.get("/user/getCurrentMentor")
        return response
    } catch (error) {
        return error.response
    }
}

export async function updateProfile(payload) {
    try {
        const response = await axiosInstance.put("/user/updateProfile", payload)
        return response
    } catch (error) {
        return error.response
    }
}

export async function verifyEmail(token) {
    try {
        const response = await axiosInstance.post(`/user/verifyEmail/${token}`, {})
        return response
    } catch (error) {
        return error.response
    }
}

export async function resendVerification() {
    try {
        const response = await axiosInstance.post("/user/resendVerification", {})
        return response
    } catch (error) {
        return error.response
    }
}

// Round 25: change the account's email — the new address must be confirmed from its own inbox


export async function getAllUsersForAdmin() {
    const response = await axiosInstance.get("/user/getAllForAdmin")
    return response
}

export async function updateStudentForAdmin(id, payload) {
    const response = await axiosInstance.put(`/user/updateForAdmin/${id}`, payload)
    return response
}

// Google sign-in is a full-page redirect through the backend, not an axios call
export function getGoogleSignInUrl(as) {
    // same-origin in production, where REACT_APP_API_URL is unset — without the fallback the link
    // compiled to "undefined/auth/google" and Google sign-in silently bounced back to the start.
    // as = "mentor" from the mentor pages (Round 28): a NEW account is then made a mentor
    return `${process.env.REACT_APP_API_URL || ""}/auth/google${as === "mentor" ? "?as=mentor" : ""}`
}

// Round 26: delete an account and everything stored for it — the admin types its email to confirm
export async function deleteAccountForAdmin(id, confirmEmail) {
    const response = await axiosInstance.delete(`/user/deleteForAdmin/${id}`, { data: { confirmEmail } })
    return response
}
