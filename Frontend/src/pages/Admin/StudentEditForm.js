import { useEffect, useState } from "react"
import { Form, Input, InputNumber, Modal, Popconfirm, message } from "antd"
import { updateStudentForAdmin } from "../../apiCall/userApi"
import StageFields, { detailForForm } from "../StageFields"

// One editor, used from the Students, Access Requests and Refund Requests tabs alike. It always
// writes the USER document, which is the single copy all three tables display — so a corrected
// name can never show as "Ram" on one tab and "Rama" on another.
// Contact details and the stage: paid, tier, role and every amount stay server-owned and change only
// through Grant / Refund / Downgrade, so an edit can't contradict the payment trail.
// Round 25 (owner): the stage's DETAILS are editable here too (degree, Class-12 year, current
// profession…) with the same fields the student sees — the server keeps only what belongs to the
// stage, and a change offers the student "Update my report".
function StudentEditForm({ visible, onClose, student, onSaved }) {
    const [form] = Form.useForm()
    const [journey, setJourney] = useState("")
    const [detail, setDetail] = useState(detailForForm(null))

    useEffect(() => {
        if (visible && student) {
            form.setFieldsValue({
                name: student.name,
                phone: student.phone,
                age: student.age,
            })
            setJourney(student.journey || "")
            setDetail(detailForForm(student.journeyDetail))
        }
    }, [visible, student, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                name: values.name,
                phone: values.phone || "",
                age: values.age,
                journey: journey,
                journeyDetail: detail,
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
            </Form>
            <div className="admin-stage-fields">
                <StageFields journey={journey} setJourney={setJourney} detail={detail} setDetail={setDetail} />
            </div>
        </Modal>
    )
}

export default StudentEditForm
