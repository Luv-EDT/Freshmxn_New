// when our team should ring the student — used by the access request and the financial aid form,
// and rendered back on the admin tables. The values must match CALLBACK_DAYS / CALLBACK_SLOTS
// in Backend/Routers/paymentsRouter.js

export const CALLBACK_DAY_OPTIONS = [
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "day_after", label: "Day after tomorrow" },
]

export const CALLBACK_SLOT_OPTIONS = [
    { value: "morning", label: "Morning (9am–1pm)" },
    { value: "afternoon", label: "Afternoon (1–5pm)" },
    { value: "evening", label: "Evening (5–9pm)" },
]

export const formatCallback = (day, slot) => {
    const dayLabel = CALLBACK_DAY_OPTIONS.find((option) => option.value === day)
    const slotLabel = CALLBACK_SLOT_OPTIONS.find((option) => option.value === slot)

    if (!dayLabel && !slotLabel) return "—"

    return `${dayLabel ? dayLabel.label : day}, ${slotLabel ? slotLabel.label : slot}`
}
