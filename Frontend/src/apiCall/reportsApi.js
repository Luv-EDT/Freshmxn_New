import axiosInstance from "./axiosInstance"

export async function getMyReport() {
    const response = await axiosInstance.get("/reports/getMyReport")
    return response
}

// the Profile page's psychometric summary — levels in words, never raw numbers
export async function getMyScores() {
    const response = await axiosInstance.get("/reports/getMyScores")
    return response
}

// only offered after the pipeline gave up — see reportsRouter /retryMyReport
export async function retryMyReport() {
    const response = await axiosInstance.post("/reports/retryMyReport")
    return response
}
