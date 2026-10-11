import { useState, useEffect } from "react"
import { Table, Input, Collapse, message } from "antd"
import { getRelatedCareersForAdmin } from "../../apiCall/dataUpdatesApi"

// Which careers' work experience carries over into which (Backend/data/related_careers.json, Round 25)
// — a working student moving between related careers pays no switching years for their work. Read
// only: edit the file (or approve mentors' corrections through Export patch), then commit.
function RelatedCareersList() {
    const [data, setData] = useState(null)
    const [search, setSearch] = useState("")

    useEffect(() => {
        getRelatedCareersForAdmin()
            .then((response) => setData(response.data.data))
            .catch(() => message.error("Failed to fetch the related-careers list"))
    }, [])

    if (!data) return <p>Loading…</p>

    const text = search.trim().toLowerCase()
    const rows = data.careers.filter((row) => !text || row.name.toLowerCase().includes(text) || row.related.some((name) => name.toLowerCase().includes(text)))

    return (
        <div>
            <p>{data.rule}</p>
            <p>{data.review.reviewed_by_owner ? "Reviewed by you." : "Not reviewed by you yet — read it once, then set review.reviewed_by_owner to true in the file."}</p>
            <Input.Search placeholder="Search a career" allowClear value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 360, marginBottom: 12 }} />
            <Table
                rowKey="id"
                size="small"
                dataSource={rows}
                pagination={{ pageSize: 25 }}
                columns={[
                    { title: "Career", dataIndex: "name", width: 260 },
                    { title: "Experience from these carries over", dataIndex: "related", render: (list) => (list.length ? list.join(" · ") : "—") },
                ]}
                scroll={{ x: "max-content" }}
            />
            <Collapse
                items={[{
                    key: "removed",
                    label: `Pairs taken out by hand (${data.removed.length})`,
                    children: <ul>{data.removed.map((row) => <li key={`${row.a}|${row.b}`}><strong>{row.a} ↔ {row.b}</strong> — {row.note}</li>)}</ul>,
                }]}
            />
        </div>
    )
}

export default RelatedCareersList
