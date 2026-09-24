import axiosInstance from "./axiosInstance"

// The full student-facing records for the professions in a report, fetched in ONE call rather than
// one per expanded row. An accordion over forty rows would otherwise be forty round trips on a
// phone connection, and the first tap would feel broken.
export async function getProfessions(ids) {
    const response = await axiosInstance.post("/professions/getProfessions", { ids })
    return response
}

export async function searchProfessions(query) {
    const response = await axiosInstance.get("/professions/search", { params: { q: query } })
    return response
}
