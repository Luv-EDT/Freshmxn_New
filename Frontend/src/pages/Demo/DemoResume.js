import { useState } from "react"
import ResumeAttach from "../ResumeAttach"
import { readResumeForDemo } from "../../apiCall/resumeApi"

// GOT A RÉSUMÉ? (owner, Round 37) — its own page, right after the first name. The file is read once to fill
// in a few answers on the next page (the past and present boxes); they can change any of them, and the
// résumé is not kept. Skipping is just as fine.
function DemoResume({ name, token, onFound, onNext }) {
    const [found, setFound] = useState(0)

    return (
        <section className="demo-step demo-resume">
            <h2>Got a résumé, {name}?</h2>
            <p className="demo-lead">
                Attach it and we'll use it only to fill in a few answers on the next page, for your ease. You can change
                or remove any of them. We delete your résumé as soon as it's read.
            </p>
            <ResumeAttach
                read={(payload) => readResumeForDemo({ token, ...payload })}
                onRead={(lists) => {
                    const added = onFound(lists)
                    setFound(added)
                    return added
                }}
                title={null}
                addedNote={(added) => `Found ${added} activities — they're waiting for you on the next page.`}
            />
            <div className="btn-row">
                <button type="button" className="btn btn-primary tap" onClick={onNext}>{found > 0 ? "Continue" : "Continue without a résumé"}</button>
            </div>
        </section>
    )
}

export default DemoResume
