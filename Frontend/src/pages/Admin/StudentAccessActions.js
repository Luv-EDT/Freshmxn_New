import { useState } from "react"
import { Button, Modal, Select, Input, message } from "antd"
import { grantFreeForAdmin, grantMentorSessionForAdmin } from "../../apiCall/paymentsApi"
import { deleteAccountForAdmin } from "../../apiCall/userApi"
import { PLAN_NAMES } from "../plans"

// Two admin actions on a student row (owner, Round 26):
// • GIVE FREE ACCESS — a plan without paying (a scholarship, a tester, a friend). It is recorded as a ₹0
//   payment marked "free, by admin", so the student's plan and history read the normal way and there is
//   nothing to refund. Round 35 (owner): on EVERY student, offering what fits where they are — any plan
//   for someone who hasn't paid; mentorship (one session) on top of Career Discovery; Career Discovery on
//   top of Mentor Only; and another mentor session, free, once the current one is done.
// • DELETE ACCOUNT — the account and everything stored for it, in every collection. Type the email to
//   confirm; admin accounts are refused by the server.
const freeChoices = (student) => {
    if (!student.paid) return [1, 2, 3].map((tier) => ({ value: `plan:${tier}`, label: PLAN_NAMES[tier] }))
    const tier = Number(student.currentTier)
    if (tier === 1) return [{ value: "plan:2", label: "Add mentorship — one mentor session (moves them to Discovery + Mentor)" }]
    if (tier === 3) return [
        { value: "session", label: "Another mentor session, free (once the current one is done)" },
        { value: "plan:2", label: "Add Career Discovery (moves them to Discovery + Mentor)" },
    ]
    return [{ value: "session", label: "Another mentor session, free (once the current one is done)" }]
}

export function GiveFreeAccess({ student, onDone }) {
    const [open, setOpen] = useState(false)
    const choices = freeChoices(student)
    const [choice, setChoice] = useState(choices[0].value)
    const [note, setNote] = useState("")

    const give = async () => {
        try {
            if (choice === "session") {
                const response = await grantMentorSessionForAdmin(student._id, { free: true, note })
                message.success(`${response.data.message} — the student starts it from their mentorship page`)
                setOpen(false)
                onDone({ _id: student._id })
                return
            }
            const response = await grantFreeForAdmin(student._id, Number(choice.split(":")[1]), note)
            message.success(response.data.message)
            setOpen(false)
            onDone(response.data.data.user)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not give free access")
        }
    }

    return (
        <>
            <Button size="small" onClick={() => { setChoice(choices[0].value); setOpen(true) }}>Give free access</Button>
            <Modal open={open} title={`Give ${student.name} something free`} okText="Give it free" onOk={give} onCancel={() => setOpen(false)}>
                <p>Recorded as a ₹0 payment marked "free, by admin". Nothing to refund later.</p>
                <Select value={choice} onChange={setChoice} style={{ width: "100%" }} options={choices} />
                <Input.TextArea style={{ marginTop: 12 }} rows={2} maxLength={300} placeholder="Why (for your records) — e.g. scholarship, tester" value={note} onChange={(event) => setNote(event.target.value)} />
            </Modal>
        </>
    )
}

export function DeleteAccount({ student, onDone }) {
    const [open, setOpen] = useState(false)
    const [typed, setTyped] = useState("")

    const remove = async () => {
        try {
            const response = await deleteAccountForAdmin(student._id, typed)
            message.success(response.data.message)
            setOpen(false)
            onDone(student._id)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not delete the account")
        }
    }

    return (
        <>
            <Button size="small" danger onClick={() => { setTyped(""); setOpen(true) }}>Delete account</Button>
            <Modal
                open={open}
                title={`Delete ${student.email}?`}
                okText="Delete for good"
                okButtonProps={{ danger: true, disabled: typed.trim().toLowerCase() !== student.email }}
                onOk={remove}
                onCancel={() => setOpen(false)}
            >
                <p>This removes the account and everything stored for it — answers, scores, report, payments, requests, consent, mentor place. It can't be undone.</p>
                <p>Type <strong>{student.email}</strong> to confirm:</p>
                <Input value={typed} onChange={(event) => setTyped(event.target.value)} />
            </Modal>
        </>
    )
}
