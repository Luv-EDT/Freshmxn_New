import axios from "axios"
// console.log(process.env.REACT_APP_API_URL)

const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
})

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// one device at a time (Round 27): a pass replaced by a login on another device is cleared, and the
// login page says why. Every other error goes back to the caller unchanged.
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && error.response?.data?.message === "You signed in on another device") {
            localStorage.removeItem("token")
            if (!window.location.pathname.endsWith("/login")) window.location.assign("/login?signedOut=other_device")
        }
        return Promise.reject(error)
    }
)

export default axiosInstance
