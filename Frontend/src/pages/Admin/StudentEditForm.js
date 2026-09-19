import { useEffect } from "react"
import { Form, Input, InputNumber, Modal, Select, Popconfirm, message } from "antd"
import { updateStudentForAdmin } from "../../apiCall/userApi"
import { JOURNEY_OPTIONS } from "../journeyOptions"

// One editor, used from the Students, Access Requests and Refund Requests tabs alike. It always
// writes the USER document, which is the single copy all three tables display — so a corrected
// name can never show as "Ram" on one tab and "Rama" on another.
// Contact details only: paid, tier, role and every amount stay server-owned and change only
// through Grant / Refund / Downgrade, so an edit can't contradict the payment trail.
function StudentEditForm({ visible, onClose, student, onSaved }) {
    const [form] = Form.useForm()

    useEffect(() => {
        if (visible && student) {
            form.setFieldsValue({
                name: student.name,
                phone: student.phone,
                age: student.age,
                journey: student.journey,
            })
        }
    }, [visible, student, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                name: values.name,
                phone: values.phone || "",
                age: values.age,
                journey: values.journey,
                journeyDetail: student.journeyDetail,   // untouched here — the student owns their own stage detail
            }

            const response = await updateStudentForAdmin(student._id, payload)
            message.success("Student updated successfully")
            onSaved(response.data.data)

            form.resetFields()
        } catch (error) {
            if (error?.errorFields) return // antd validation error, already shown inline
            message.error(error.response?.data?.message || "Something went wrong")
        }
    }

    if (!student) return null

    return (
        <Modal
            open={visible}
            title={`Edit ${student.name}`}
            onCancel={onClose}
            footer={[
                <button type="button" key="cancel" onClick={onClose}>Cancel</button>,
                <Popconfirm
                    key="save"
                    title="Save these details? They update everywhere at once."
                    okText="Save"
                    cancelText="Cancel"
                    onConfirm={handleSubmit}
                >
                    <button type="button">Save</button>
                </Popconfirm>,
            ]}
        >
            <p>{student.email}</p>

            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: "Please enter a name" }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="phone"
                    label="Phone number"
                    rules={[{ pattern: /^[0-9]{10}$/, message: "Enter a valid 10-digit phone number" }]}
                >
                    <Input placeholder="10 digits, or leave blank" />
                </Form.Item>
                <Form.Item name="age" label="Age">
                    <InputNumber min={8} max={100} />
                </Form.Item>
                <Form.Item name="journey" label="Stage">
                    <Select options={JOURNEY_OPTIONS} />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default StudentEditForm
