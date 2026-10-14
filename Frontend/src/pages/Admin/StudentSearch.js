import { Input } from "antd"

// ONE SEARCH BOX FOR EVERY TAB THAT LISTS STUDENTS (owner, Round 31): by name or email, any order of
// words — "riya gmail" finds Riya Sharma <riya.s@gmail.com>. Rows with no student (deleted) never match
// a search, and every row shows when the box is empty.
export const matchesStudent = (person, text) => {
    const words = String(text || "").trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return true
    if (!person) return false
    const haystack = `${person.name || ""} ${person.email || ""}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
}

function StudentSearch({ value, onChange }) {
    return (
        <Input.Search
            allowClear
            className="admin-search"
            placeholder="Search by name or email"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            style={{ maxWidth: 360, margin: "12px 0", display: "block" }}
        />
    )
}

export default StudentSearch
