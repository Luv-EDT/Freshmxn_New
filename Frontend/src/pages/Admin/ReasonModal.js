import { useState, useEffect } from "react"
import { Modal, Input } from "antd"

// EVERY "NO" COMES WITH A REASON (owner, Round 28): declining a refund, financial aid or a retake
// request opens this box; the server refuses an empty reason, emails it to the student and shows it
// in their history.
function ReasonModal({ open, title, onCancel, onSubmit }) {
    const [reason, setReason] = useState("")
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (open) setReason("")
    }, [open])

    const submit = async () => {
        setSending(true)
        await onSubmit(reason.trim())
        setSending(false)
    }

    return (
        <Modal
            open={open}
            title={title}
            okText="Send"
            okButtonProps={{ disabled: reason.trim() === "", loading: sending }}
            onOk={submit}
            onCancel={onCancel}
        >
            <p>The student is emailed this reason and sees it in their history.</p>
            <Input.TextArea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} showCount />
        </Modal>
    )
}

export default ReasonModal
