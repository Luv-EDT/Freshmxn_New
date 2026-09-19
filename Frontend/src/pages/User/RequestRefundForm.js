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
                        ? `Ask to move back to Career Discovery and get ₹${chosenAmountInr} back?`
                        : `Ask for a full refund of ₹${chosenAmountInr}? This ends your access.`}
                    okText="Send request"
                    cancelText="Not yet"
                    onConfirm={handleSubmit}
                >
                    <button type="button">Send request</button>
                </Popconfirm>,
            ]}
        >
            <p>Please tell us why. Our team reads every request and will get back to you.</p>

            <Form form={form} layout="vertical" initialValues={{ refundType: "full" }}>
                {options && options.canRollover && (
                    <Form.Item name="refundType" label="What would you like to do?">
                        <Radio.Group onChange={(e) => setRefundType(e.target.value)}>
                            <Radio value="rollover" style={{ display: "block" }}>
                                Move back to Career Discovery — get <strong>₹{options.rolloverAmountInr}</strong> back
                                and keep your Tier 1 access
                            </Radio>
                            <Radio value="full" style={{ display: "block" }}>
                                Full refund — get <strong>₹{options.fullAmountInr}</strong> back, and your access ends
                            </Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {options && !options.canRollover && (
                    <p>Amount you'd get back: <strong>₹{options.fullAmountInr}</strong>. Your access would end.</p>
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
