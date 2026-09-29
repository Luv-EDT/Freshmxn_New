import PublicNav from "./PublicNav"
import PublicFooter from "./PublicFooter"

export const LAST_UPDATED = "24 September 2026"

export const COMPANY = {
    name: "Freshmxn Education India Private Limited",
    cin: "U85500DL2025PTC453582",
    address: "3477, Sarwan Building, Nicholson Road, Chandni Chowk, Delhi 110006, India",
    email: "luvgoel@freshmxn.com",
    phone: "8882756287",
}

// The shared layout for /terms and /privacy: a readable single column, a table of contents that
// jumps to each section, and the date the text last changed. Sections are data so the contents
// list can never drift from the headings it points at.
function LegalPage({ title, intro, sections }) {
    return (
        <div>
            <PublicNav />

            <main>
                <section className="page-hero">
                    <div className="page">
                        <h1>{title}</h1>
                        <p>Last updated {LAST_UPDATED}</p>
                    </div>
                </section>

                <section className="section">
                    <div className="page legal">
                        {intro}

                        <nav className="legal-toc" aria-label="Contents">
                            <p className="legal-toc-title">Contents</p>
                            <ol>
                                {sections.map((section) => (
                                    <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
                                ))}
                            </ol>
                        </nav>

                        {sections.map((section, index) => (
                            <section key={section.id} id={section.id} className="legal-section">
                                <h2>{index + 1}. {section.title}</h2>
                                {section.body}
                            </section>
                        ))}
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}

export default LegalPage
