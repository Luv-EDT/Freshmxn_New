import { useEffect } from "react"
import { Form, Input, InputNumber, Switch, DatePicker, Modal, message } from "antd"
import dayjs from "dayjs"
import { addCoupon } from "../../apiCall/couponsApi"

function CouponsForm({ visible, onClose, initialData, onAddSuccess, onUpdateSuccess }) {
    const [form] = Form.useForm()
    const isEditMode = !!initialData

    // Pre-fill form when editing
    useEffect(() => {
        if (initialData) {
            form.setFieldsValue({
                ...initialData,
                expiresAt: initialData.expiresAt
                    ? dayjs(initialData.expiresAt)
                    : null,
            })
        } else {
            form.resetFields()
        }
    }, [initialData, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                ...values,
                expiresAt: values.expiresAt
                    ? values.expiresAt.toISOString()
                    : null,
            }

            if (isEditMode) {
                // Trigger update in CouponsList
                await onUpdateSuccess(initialData._id, payload)
            } else {
                // Add new coupon
                const response = await addCoupon(payload)
                message.success("Coupon added successfully")
                onAddSuccess(response.data.data)
            }

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
            title={isEditMode ? "Edit coupon" : "Add coupon"}
            onOk={handleSubmit}
            onCancel={onClose}
        >
            <Form form={form} layout="vertical" initialValues={{ isActive: true, usageLimit: 0 }}>
                <Form.Item
                    name="code"
                    label="Code"
                    rules={[{ required: true, message: "Please enter a coupon code" }]}
                >
                    <Input placeholder="e.g., EARLY25" />
                </Form.Item>
                <Form.Item
                    name="discountPct"
                    label="Discount %"
                    rules={[{ required: true, message: "Please enter the discount" }]}
                >
                    <InputNumber min={0} max={100} />
                </Form.Item>
                <Form.Item name="usageLimit" label="Usage limit (0 = unlimited)">
                    <InputNumber min={0} />
                </Form.Item>
                <Form.Item name="expiresAt" label="Expires on (optional)">
                    <DatePicker />
                </Form.Item>
                <Form.Item name="isActive" label="Active" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default CouponsForm
