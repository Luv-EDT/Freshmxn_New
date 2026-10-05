import { Button, Popconfirm, message } from "antd"
import { removeOpinionForAdmin } from "../../apiCall/mentorReviewsApi"

// One topic's stack of mentor opinions, as the admin sees it in the monthly review (Round 17): who
// wants a change and who agrees with what we show, with their words, links and years in the field.
// "Remove as wrong" — shown only when `onRemoved` is given, i.e. in Data updates — is the one way an
// opinion leaves the stack; it is logged.
const DIRECTION_WORDS = { higher: "should be higher", lower: "should be lower" }

function MentorOpinions({ professionId, topic, opinions, onRemoved }) {
    const remove = async (opinion) => {
        try {
            const response = await removeOpinionForAdmin(professionId, opinion.mentor, topic)
            message.success(response.data.message)
            onRemoved()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not remove it")
        }
    }

    return (
        <ul className="mentor-opinions">
            {opinions.map((opinion) => (
                <li key={`${opinion.mentor}-${topic}`} className={opinion.agrees ? "is-agree" : ""}>
                    <strong>{opinion.mentorName || "A mentor"}</strong>
                    {typeof opinion.years === "number" && <span className="report-small"> · {opinion.years} yrs</span>}
                    {": "}
                    {opinion.agrees ? "agrees with what we show" : DIRECTION_WORDS[opinion.direction] || "wants a change"}
                    {opinion.note && <span> — “{opinion.note}”</span>}
                    {opinion.sourceUrl && <> · <a href={opinion.sourceUrl} target="_blank" rel="noreferrer">their link</a></>}
                    {onRemoved && opinion.mentor && (
                        <Popconfirm title="Remove this opinion as wrong? It stops counting and is logged." okText="Remove" cancelText="Keep" onConfirm={() => remove(opinion)}>
                            <Button size="small" type="link" danger>Remove as wrong</Button>
                        </Popconfirm>
                    )}
                </li>
            ))}
        </ul>
    )
}

export default MentorOpinions
