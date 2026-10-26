import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import dayjs from "dayjs"
import { getMyNotifications, clearNotification, clearAllNotifications, markNotificationsSeen } from "../../apiCall/notificationsApi"

// YOUR NOTIFICATIONS (owner, Round 29) — everything we email you also appears here: a retake to take,
// an improvement to your report, your story's clock, payments and refunds, your mentor. Clear them
// yourself; a cleared one is deleted for good. Round 35 (owner): opening them marks them seen — the bell's
// count goes back to nothing and starts again from the next one; the new ones keep a "New" tag here.
function Notifications() {
    const [items, setItems] = useState(null)

    const load = async () => {
        const response = await getMyNotifications()
        const rows = (response && response.data && response.data.data) || []
        setItems(rows)
        if (rows.some((item) => !item.seen)) {
            await markNotificationsSeen()
            window.dispatchEvent(new Event("notifications-changed"))
        }
    }
    useEffect(() => { load() }, [])

    const clearOne = async (id) => {
        setItems((current) => current.filter((item) => item.id !== id))
        await clearNotification(id)
        window.dispatchEvent(new Event("notifications-changed"))
    }

    const clearAll = async () => {
        setItems([])
        await clearAllNotifications()
        window.dispatchEvent(new Event("notifications-changed"))
    }

    if (items === null) return null

    return (
        <section id="notifications" className="notifications">
            <div className="notifications-head">
                <h3>🔔 Notifications {items.length > 0 && <span className="notifications-count">{items.length}</span>}</h3>
                {items.length > 0 && <button type="button" className="link-button" onClick={clearAll}>Clear all notifications</button>}
            </div>
            {items.length === 0 ? (
                <p className="report-small">Nothing new. We'll tell you here (and by email) when something needs you.</p>
            ) : (
                <ul className="notification-list">
                    {items.map((item) => (
                        <li key={item.id} className={`notification${item.seen ? "" : " notification-new"}`}>
                            <div>
                                <strong>{item.title}</strong>{!item.seen && <span className="notification-new-tag">New</span>}
                                <p>{item.body}</p>
                                <span className="report-small">
                                    {dayjs(item.createdAt).format("D MMM, h:mm a")}
                                    {item.link && <>{" · "}<Link to={item.link}>Open →</Link></>}
                                </span>
                            </div>
                            <button type="button" className="notification-clear" aria-label="Clear this notification" onClick={() => clearOne(item.id)}>✕</button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default Notifications
