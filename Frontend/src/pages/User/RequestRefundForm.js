import { useState, useEffect } from "react"
import { Form, Input, Modal, Radio, Popconfirm, message } from "antd"
import { requestRefund, getRefundOptions } from "../../apiCall/paymentsApi"

// The student says why, and — if they're on Tier 2 — whether they want everything back or just
// the Mentorship part. Both amounts come from the server; the browser never names a figure.
function RequestRefundForm({ visible, onClose, onAddSuccess }) {
    const [form] = Form.useForm()
    const [options, setOptions] = useState(null)
    const [refundType, setRefundType] = useState("full")

    useEffect(() => {
        if (!visible) return

        fetchOptions()
        setRefundType("full")
        form.setFieldsValue({ refundType: "full" })
    }, [visible])

    const fetchOptions = async () => {
        try {
            const response = await getRefundOptions()
            setOptions(response.data.data)
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to load your refund options")
        }
    }

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                reason: values.reason,
                refundType: values.refundType || "full",
            }

            const response = await requestRefund(payload)
            message.success("Refund request submitted successfully")
            onAddSuccess(response.data.data)

            form.resetFields()
        } catch (error) {
            if (error?.errorFields) return // antd validation error, already shown inline
            message.error(
                error.response?.data?.message || "Something went wrong"
            )
        }
    }

    // ₹2,700, not ₹2700 — the amounts are the server's, the commas are ours
    const inr = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

    const chosenAmountInr = options
        ? (refundType === "rollover" ? options.rolloverAmountInr : options.fullAmountInr)
        : 0

    return (
        <Modal
            open={visible}
            title="Request a refund"
            onCancel={onClose}
            footer={[
                <button type="button" key="cancel" onClick={onClose}>Cancel</button>,
                <Popconfirm
                    key="submit"
                    title={refundType === "rollover"
                        ? `Ask to move back to Career Discovery and get ${inr(chosenAmountInr)} back?`
                        : `Ask for a full refund of ${inr(chosenAmountInr)}? This ends your access.`}
                    okText="Send request"
                    cancelText="Not yet"
                    onConfirm={handleSubmit}
                >
                    <button type="button" className="btn btn-primary">Send request</button>
                </Popconfirm>,
            ]}
        >
            <p>Please tell us why. Our team reads every request and will get back to you.</p>

            <Form form={form} layout="vertical" initialValues={{ refundType: "full" }}>
                {options && options.canRollover && (
                    <Form.Item name="refundType" label="What would you like to do?">
                        {/* Round 13: each choice is one aligned card — radio and words on one line */}
                        <Radio.Group className="refund-options" onChange={(e) => setRefundType(e.target.value)}>
                            <Radio value="rollover" className="refund-option">
                                <strong>Move back to Career Discovery</strong>
                                <span>Get {inr(options.rolloverAmountInr)} back and keep your Career Discovery access.</span>
                            </Radio>
                            <Radio value="full" className="refund-option">
                                <strong>Full refund</strong>
                                <span>Get {inr(options.fullAmountInr)} back. Your access ends.</span>
                            </Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {options && !options.canRollover && (
                    <p>Amount you'd get back: <strong>{inr(options.fullAmountInr)}</strong>. Your access would end.</p>
                )}

                <Form.Item
                    name="reason"
                    label="Why do you want a refund?"
                    rules={[{ required: true, message: "Please tell us why" }]}
                >
                    <Input.TextArea rows={5} />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default RequestRefundForm
