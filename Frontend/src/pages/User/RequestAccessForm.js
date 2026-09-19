import { useEffect } from "react"
import { Form, Input, Modal, Select, Popconfirm, message } from "antd"
import { requestAccess } from "../../apiCall/paymentsApi"
import { CALLBACK_DAY_OPTIONS, CALLBACK_SLOT_OPTIONS } from "./callbackOptions"

// manual payment mode: the student leaves a callback request; an admin collects payment and grants access
function RequestAccessForm({ visible, onClose, quote, defaultName, defaultPhone, onAddSuccess }) {
    const [form] = Form.useForm()

    // Pre-fill from the account
    useEffect(() => {
        if (visible) {
            form.setFieldsValue({ name: defaultName, phone: defaultPhone })
        }
    }, [visible, defaultName, defaultPhone, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            // the amount is NOT sent — the server recomputes it from tier + coupon
            const payload = {
                tier: quote.tier,
                coupon: quote.coupon,
                name: values.name,
                phone: values.phone,
                callbackDay: values.callbackDay,
                callbackSlot: values.callbackSlot,
            }

            const response = await requestAccess(payload)
            message.success("Access request submitted successfully")
            onAddSuccess(response.data.data)

            form.resetFields()
        } catch (error) {
            if (error?.errorFields) return // antd validation error, already shown inline
            message.error(
                error.response?.data?.message || "Something went wrong"
            )
        }
    }

    if (!quote) return null

    return (
        <Modal
            open={visible}
            title={`Request access — Tier ${quote.tier}`}
            onCancel={onClose}
            footer={[
                <button type="button" key="cancel" onClick={onClose}>Cancel</button>,
                <Popconfirm
                    key="submit"
                    title={`Send this request for ₹${quote.finalAmountInr}?`}
                    okText="Send request"
                    cancelText="Not yet"
                    onConfirm={handleSubmit}
                >
                    <button type="button">Submit request</button>
                </Popconfirm>,
            ]}
        >
            <p>
                Amount to pay: <strong>₹{quote.finalAmountInr}</strong>
                {quote.isFinancialAid && " (your approved financial aid rate)"}
                {!quote.isFinancialAid && quote.discountPct > 0 && ` (${quote.discountPct}% off with ${quote.coupon})`}
            </p>
            <p>Leave your details and our team will call you to complete the payment.</p>

            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: "Please enter your name" }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="phone"
                    label="Phone number"
                    rules={[
                        { required: true, message: "Please enter phone number" },
                        { pattern: /^[0-9]{10}$/, message: "Enter a valid 10-digit phone number" }
                    ]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="callbackDay"
                    label="Which day should we call?"
                    rules={[{ required: true, message: "Please pick a day" }]}
                >
                    <Select options={CALLBACK_DAY_OPTIONS} placeholder="Pick a day" />
                </Form.Item>
                <Form.Item
                    name="callbackSlot"
                    label="Best time to call you"
                    rules={[{ required: true, message: "Please pick a time" }]}
                >
                    <Select options={CALLBACK_SLOT_OPTIONS} placeholder="Pick a time" />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default RequestAccessForm
