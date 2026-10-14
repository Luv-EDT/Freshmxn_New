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

export async function saveDemoOpenness(payload) {
    return axiosInstance.put("/demo/saveOpenness", payload)
}

export async function demoReasoningNext(token) {
    return axiosInstance.post("/demo/reasoningNext", { token })
}

export async function demoReasoningAnswer(payload) {
    return axiosInstance.post("/demo/reasoningAnswer", payload)
}

export async function getDemoResult(payload) {
    return axiosInstance.post("/demo/result", payload)
}

export async function loadDemoResult(token) {
    return axiosInstance.get("/demo/result", { params: { token } })
}

// after buying — carry the demo's answers into the real account (Round 32)
export async function getMyDemo() {
    return axiosInstance.get("/demoResume/getMine")
}

export async function importMyDemo() {
    return axiosInstance.post("/demoResume/import")
}

export async function declineMyDemo() {
    return axiosInstance.post("/demoResume/decline")
}
