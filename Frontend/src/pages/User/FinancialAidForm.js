import { useEffect } from "react"
import { Form, Input, Modal, Select, Popconfirm, message } from "antd"
import { requestFinancialAid } from "../../apiCall/paymentsApi"
import { CALLBACK_DAY_OPTIONS, CALLBACK_SLOT_OPTIONS } from "./callbackOptions"

// A student who can't afford a tier asks for a call. The admin agrees a figure on the phone and
// approves it; from then on the paywall quotes that figure instead of the list price.
function FinancialAidForm({ visible, onClose, tier, defaultName, defaultPhone, onAddSuccess }) {
    const [form] = Form.useForm()

    useEffect(() => {
        if (visible) {
            form.setFieldsValue({ name: defaultName, phone: defaultPhone })
        }
    }, [visible, defaultName, defaultPhone, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                tier,
                reason: values.reason,
                name: values.name,
                phone: values.phone,
                callbackDay: values.callbackDay,
                callbackSlot: values.callbackSlot,
            }

            const response = await requestFinancialAid(payload)
            message.success("We'll call you soon")
            onAddSuccess(response.data.data)

            form.resetFields()
        } catch (error) {
            if (error?.errorFields) return // antd validation error, already shown inline
            message.error(
                error.response?.data?.message || "Something went wrong"
            )
        }
    }

    return (
        <Modal
            open={visible}
            title="💙 Ask about financial aid"
            onCancel={onClose}
            footer={[
                <button type="button" key="cancel" onClick={onClose}>Cancel</button>,
                <Popconfirm
                    key="submit"
                    title="Send this request? We'll call you at the time you picked."
                    okText="Send request"
                    cancelText="Not yet"
                    onConfirm={handleSubmit}
                >
                    <button type="button">Send request</button>
                </Popconfirm>,
            ]}
        >
            <p>
                Tell us a little about your situation and pick a time for a quick call.
                If the need is genuine, we'll offer you a subsidised rate.
            </p>

            <Form form={form} layout="vertical">
                <Form.Item
                    name="reason"
                    label="Tell us about your situation"
                    rules={[{ required: true, message: "Please tell us a little about your situation" }]}
                >
                    <Input.TextArea rows={4} />
                </Form.Item>
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

export default FinancialAidForm
