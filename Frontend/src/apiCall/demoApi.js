import axiosInstance from "./axiosInstance"

// "Try the demo" (owner, Round 32) — no login; every call carries the demo's own token.
export async function startDemo(payload) {
    return axiosInstance.post("/demo/start", payload)
}

export async function getDemoState(token) {
    return axiosInstance.get("/demo/state", { params: { token } })
}

export async function saveDemoInterests(payload) {
    return axiosInstance.put("/demo/saveInterests", payload)
}

// the four puzzles dealt to this visitor, without answers (Round 33)
export async function getDemoPuzzles(token) {
    return axiosInstance.get("/demo/puzzles", { params: { token } })
}

// the three tasks' answers, sent once — worked out on the server, only the small result kept
export async function saveDemoTests(payload) {
    return axiosInstance.post("/demo/saveTests", payload)
}

// Round 36 (owner): the result only after an account — sign up with an emailed code, or log in
export async function demoRegister(payload) {
    return axiosInstance.post("/demoAccount/register", payload)
}

export async function demoVerify(payload) {
    return axiosInstance.post("/demoAccount/verify", payload)
}

export async function demoResendCode(payload) {
    return axiosInstance.post("/demoAccount/resendCode", payload)
}

export async function demoLogin(payload) {
    return axiosInstance.post("/demoAccount/login", payload)
}

export async function loadDemoResult(token) {
    return axiosInstance.get("/demo/result", { params: { token } })
}

// after buying — carry the demo's story and its two careers into the real account (Rounds 32-33)
export async function getMyDemo() {
    return axiosInstance.get("/demoResume/getMine")
}

export async function importMyDemo() {
    return axiosInstance.post("/demoResume/import")
}

export async function declineMyDemo() {
    return axiosInstance.post("/demoResume/decline")
}
