import axiosInstance from "./axiosInstance"

export async function saveInterest(payload) {
    const response = await axiosInstance.post("/submissions/saveInterest", payload)
    return response
}

export async function getMySubmission() {
    const response = await axiosInstance.get("/submissions/getMySubmission")
    return response
}

export async function savePsychometric(payload) {
    const response = await axiosInstance.post("/submissions/savePsychometric", payload)
    return response
}

export async function submitPsychometric() {
    const response = await axiosInstance.post("/submissions/submitPsychometric", {})
    return response
}

export async function digitSpanNext() {
    const response = await axiosInstance.post("/submissions/digitSpanNext", {})
    return response
}

export async function digitSpanAnswer(payload) {
    const response = await axiosInstance.post("/submissions/digitSpanAnswer", payload)
    return response
}

export async function openStory() {
    const response = await axiosInstance.post("/story/openStory", {})
    return response
}

export async function getStoryState() {
    const response = await axiosInstance.get("/story/storyState")
    return response
}

export async function submitStoryRecall(payload) {
    const response = await axiosInstance.post("/story/submitStoryRecall", payload)
    return response
}

export async function getExternalState() {
    const response = await axiosInstance.get("/external/externalState")
    return response
}

// The screenshot is already downsized by the browser before it gets here, so this stays inside the
// default axios timeout on a phone connection. A vision call takes a few seconds, which is why the
// upload screen shows what it is doing rather than a bare spinner.
export async function uploadTestResult(payload) {
    const response = await axiosInstance.post("/external/uploadResult", payload)
    return response
}

export async function confirmTestResult(payload) {
    const response = await axiosInstance.post("/external/confirmResult", payload)
    return response
}
