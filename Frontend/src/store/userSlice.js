import { createSlice } from "@reduxjs/toolkit"

// the logged-in user, including paid / currentTier / progress (the staged-flow state)
const userSlice = createSlice({
    name: "user",
    initialState: {
        user: null,
    },
    reducers: {
        setUser(state, action) {
            return action.payload
        },
    },
})

export const { setUser } = userSlice.actions
export default userSlice.reducer
