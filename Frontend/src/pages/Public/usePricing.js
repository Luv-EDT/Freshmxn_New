import { useEffect, useState } from "react"
import { getPricing } from "../../apiCall/paymentsApi"

// Prices always come from the server (GET /payments/getPricing), never from the copy docs — the
// docs have already disagreed with each other once (₹6,500 vs ₹7,000).
export const formatInr = (amount) => (typeof amount === "number" ? `₹${amount.toLocaleString("en-IN")}` : "…")

function usePricing() {
    const [pricing, setPricing] = useState(null)

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getPricing()
                setPricing(response.data.data)
            } catch (error) {
                setPricing(null) // the page still reads fine; amounts show as "…"
            }
        }
        load()
    }, [])

    return {
        tier1: pricing?.tiers?.[1]?.amountInr,
        tier2: pricing?.tiers?.[2]?.amountInr,
        upgrade: pricing?.upgradeAmountInr,
    }
}

export default usePricing
