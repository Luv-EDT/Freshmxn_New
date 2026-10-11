import { useState } from "react"
import { Button, Modal, Select, Input, message } from "antd"
import { grantFreeForAdmin } from "../../apiCall/paymentsApi"
import { deleteAccountForAdmin } from "../../apiCall/userApi"
import { PLAN_NAMES } from "../plans"

// Two admin actions on a student row (owner, Round 26):
// • GIVE FREE ACCESS — a plan without paying (a scholarship, a tester, a friend). It is recorded as a ₹0
//   payment marked "free, by admin", so the student's plan and history read the normal way and there is
//   nothing to refund.
// • DELETE ACCOUNT — the account and everything stored for it, in every collection. Type the email to
//   confirm; admin accounts are refused by the server.
export function GiveFreeAccess({ student, onDone }) {
    const [open, setOpen] = useState(false)
    const [tier, setTier] = useState(1)
    const [note, setNote] = useState("")

    const give = async () => {
        try {
            const response = await grantFreeForAdmin(student._id, tier, note)
            message.success(response.data.message)
            setOpen(false)
            onDone(response.data.data.user)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not give free access")
        }
    }

    return (
        <>
            <Button size="small" onClick={() => setOpen(true)}>Give free access</Button>
            <Modal open={open} title={`Give ${student.name} a plan for free`} okText="Give it free" onOk={give} onCancel={() => setOpen(false)}>
                <p>Recorded as a ₹0 payment marked "free, by admin". Nothing to refund later.</p>
                <Select value={tier} onChange={setTier} style={{ width: "100%" }} options={[1, 2, 3].map((value) => ({ value, label: PLAN_NAMES[value] }))} />
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
