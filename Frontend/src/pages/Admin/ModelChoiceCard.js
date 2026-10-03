import { useState, useEffect, useCallback } from "react"
import { Button, Popconfirm, message } from "antd"
import dayjs from "dayjs"
import { getModelChoiceForAdmin, setResearchModelForAdmin } from "../../apiCall/dataUpdatesApi"
import { runHousekeepingForAdmin } from "../../apiCall/followUpsApi"

// "Model for the monthly jobs" (owner, Round 12). Run the comparison once — the same 20 careers asked
// of both models, nothing filed — then choose. The choice applies to the refresh, the study bot, the
// scout and career drafting from their next run. REFRESH_MODEL on Render, if set, still wins.
const NAMES = { "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5" }
const money = (value) => (typeof value === "number" ? `$${value.toFixed(2)}` : "—")

function ModelChoiceCard() {
    const [data, setData] = useState(null)
    const [showCareers, setShowCareers] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            const response = await getModelChoiceForAdmin()
            setData(response.data.data)
        } catch (error) {
            message.error("Could not load the model choice")
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const runComparison = async () => {
        try {
            const response = await runHousekeepingForAdmin("model_compare")
            message.success(`${response.data.message} (about 10–20 minutes)`)
        } catch (error) {
            message.error(error.response?.data?.message || "Could not start the comparison")
        }
    }

    const choose = async (model) => {
        try {
            const response = await setResearchModelForAdmin(model)
            message.success(response.data.message)
            fetchAll()
        } catch (error) {
            message.error(error.response?.data?.message || "Could not save")
        }
    }

    if (!data) return null
    const comparison = data.comparison

    return (
        <details className="faq-item">
            <summary>Model for the monthly jobs: {NAMES[data.inUse] || data.inUse}{data.fromEnvironment ? " (set by REFRESH_MODEL on Render)" : ""}</summary>
            {!comparison && <p>No comparison yet. It asks the same 20 careers of both models, files nothing, and costs a few dollars once.</p>}
            {comparison && (
                <>
                    <p className="report-small">Compared {dayjs(comparison.createdAt).format("DD MMM YYYY")} on {comparison.careers.length} careers · the two agreed on what to change for {comparison.summary.agreement ?? "—"}% of them</p>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th /><th>Changes it would propose</th><th>Pages cited (average)</th><th>Failed</th><th>Cost per career</th><th>A month of the refresh</th><th>Seconds per career</th></tr>
                            </thead>
                            <tbody>
                                {comparison.models.map((model) => {
                                    const row = comparison.summary.perModel[model]
                                    return (
                                        <tr key={model}>
                                            <th>{NAMES[model] || model}</th>
                                            <td>{row.changes}</td>
                                            <td>{row.averageSources}</td>
                                            <td>{row.failures}</td>
                                            <td>{money(row.costPerCareer)}</td>
                                            <td>{money(row.monthlyCost)} (half in a batch)</td>
                                            <td>{row.averageSeconds}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p><button type="button" className="tap" onClick={() => setShowCareers(!showCareers)}>{showCareers ? "Hide" : "Show"} each career side by side</button></p>
                    {showCareers && (
                        <div className="table-scroll">
                            <table>
                                <thead><tr><th>Career</th>{comparison.models.map((model) => <th key={model}>{NAMES[model] || model}</th>)}</tr></thead>
                                <tbody>
                                    {comparison.careers.map((career) => (
                                        <tr key={career.id}>
                                            <td>{career.name}</td>
                                            {comparison.models.map((model) => {
                                                const result = career.results[model]
                                                return (
                                                    <td key={model}>
                                                        {result.error || result.unreadable || result.refused
                                                            ? <em>{result.error ? "error" : result.refused ? "declined" : "unreadable"}</em>
                                                            : result.changes.length === 0 ? "no change" : result.changes.map((change) => <div key={change.field}>{change.field}: {change.from || "—"} → <strong>{change.to}</strong></div>)}
                                                        <div className="report-small">{result.sources} pages · {money(result.cost)}</div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
            <p>
                <Popconfirm title="Ask 20 careers of both models? Costs a few dollars; nothing is filed." onConfirm={runComparison}>
                    <Button>{comparison ? "Run the comparison again" : "Run the comparison"}</Button>
                </Popconfirm>{" "}
                {data.models.map((model) => (
                    <span key={model}>
                        <Button type={data.chosen === model ? "primary" : "default"} disabled={!comparison} onClick={() => choose(model)}>
                            {data.chosen === model ? `Using ${NAMES[model]}` : `Use ${NAMES[model]}`}
                        </Button>{" "}
                    </span>
                ))}
            </p>
        </details>
    )
}

export default ModelChoiceCard
