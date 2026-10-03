import { useState } from "react"
import { Modal } from "antd"

// "Are you still heading the same way, or looking for something new?" (owner, Round 11)
//
// Asked whenever a student rebuilds their own report — "Update my report" or submitting the
// assessment again. Only "something new" restarts the 6- and 12-month follow-up, so a mistaken
// click, or a student who just wants the improved matching, keeps their original clock
// (Backend/utils/direction.js).
function DirectionModal({ open, title, okText, busy, onCancel, onConfirm }) {
    const [direction, setDirection] = useState(null)

    return (
        <Modal
            open={open}
            title={title}
            okText={okText}
            cancelText="Not now"
            okButtonProps={{ disabled: !direction, loading: busy }}
            onCancel={onCancel}
            onOk={() => onConfirm(direction)}
            destroyOnHidden
        >
            <p>Before we rebuild it — which is closer to where you are?</p>
            <div className="choices" role="radiogroup" aria-label="Which way are you heading">
                <label className="choice">
                    <input type="radio" name="direction" checked={direction === "same"} onChange={() => setDirection("same")} />
                    <span>I'm still heading the same way</span>
                </label>
                <label className="choice">
                    <input type="radio" name="direction" checked={direction === "new"} onChange={() => setDirection("new")} />
                    <span>I'm looking for something new</span>
                </label>
            </div>
        </Modal>
    )
}

export default DirectionModal
