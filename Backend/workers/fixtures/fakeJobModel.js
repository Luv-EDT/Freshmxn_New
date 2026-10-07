// An in-memory stand-in for model/jobsModel.js, for the JOB QUEUE fixtures (Round 22). These fixtures
// never open a database, so this answers exactly the queries workers/jobQueue.js makes — equality,
// $lte / $lt / $gte, sort, $set / $unset / $inc — and enforces the one-at-a-time unique index on
// { queue, activeKey }. Anything else it is asked throws, so a new query cannot pass by accident.

const matches = (row, filter) => Object.entries(filter).every(([field, wanted]) => {
    const value = row[field]
    // a plain object is an operator query; an ObjectId or a Date is a value
    if (wanted && typeof wanted === "object" && Object.getPrototypeOf(wanted) === Object.prototype) {
        return Object.entries(wanted).every(([op, operand]) => {
            const left = value instanceof Date ? value.getTime() : value
            const right = operand instanceof Date ? operand.getTime() : operand
            if (op === "$lte") return left !== null && left !== undefined && left <= right
            if (op === "$lt") return left !== null && left !== undefined && left < right
            if (op === "$gte") return left !== null && left !== undefined && left >= right
            throw new Error(`fakeJobModel: unsupported operator ${op}`)
        })
    }
    return String(value) === String(wanted)
})

const apply = (row, update) => {
    Object.keys(update).forEach((op) => {
        if (!["$set", "$unset", "$inc"].includes(op)) throw new Error(`fakeJobModel: unsupported update ${op}`)
    })
    Object.entries(update.$set || {}).forEach(([field, value]) => { row[field] = value })
    Object.keys(update.$unset || {}).forEach((field) => { delete row[field] })
    Object.entries(update.$inc || {}).forEach(([field, by]) => { row[field] = (row[field] || 0) + by })
}

const createFakeJobModel = () => {
    const rows = []
    let nextId = 1

    const checkUnique = (candidate) => {
        if (candidate.activeKey === undefined) return
        if (rows.some((row) => row !== candidate && row.queue === candidate.queue && row.activeKey === candidate.activeKey)) {
            const error = new Error("E11000 duplicate key")
            error.code = 11000
            throw error
        }
    }

    const sorted = (list, sort) => {
        if (!sort) return list
        const [[field, direction]] = Object.entries(sort)
        return list.slice().sort((left, right) => (new Date(left[field]).getTime() - new Date(right[field]).getTime()) * direction)
    }

    // a query that ends in .lean(), optionally after .sort() / .select()
    const query = (resolve) => {
        const chain = { sortBy: null }
        chain.sort = (sort) => { chain.sortBy = sort; return chain }
        chain.select = () => chain
        chain.lean = async () => resolve(chain.sortBy)
        return chain
    }

    const Job = {
        rows,
        findOne: (filter) => query((sort) => {
            const found = sorted(rows.filter((row) => matches(row, filter)), sort)[0]
            return found ? { ...found } : null
        }),
        findOneAndUpdate: (filter, update, options = {}) => query(() => {
            const found = sorted(rows.filter((row) => matches(row, filter)), options.sort)[0]
            if (!found) return null
            apply(found, update)
            return { ...found }
        }),
        create: async (doc) => {
            const row = { _id: `job${nextId++}`, status: "waiting", attemptsMade: 0, stalls: 0, lockedUntil: null, ...doc }
            if (row.activeKey === undefined) row.activeKey = `none#${row._id}`
            checkUnique(row)
            rows.push(row)
            return { ...row }
        },
        updateOne: async (filter, update) => {
            const found = rows.find((row) => matches(row, filter))
            if (!found) return { matchedCount: 0 }
            const before = { ...found }
            apply(found, update)
            try { checkUnique(found) } catch (error) { Object.keys(found).forEach((key) => delete found[key]); Object.assign(found, before); throw error }
            return { matchedCount: 1 }
        },
        countDocuments: async (filter) => rows.filter((row) => matches(row, filter)).length,
    }
    return Job
}

module.exports = { createFakeJobModel }
