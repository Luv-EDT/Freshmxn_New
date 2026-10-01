// THE IN-HOUSE REASONING TEST (owner, Round 10, item 1) — it replaces the AssessmentDay upload.
//
// Sixteen items in the four kinds the International Cognitive Ability Resource uses (Condon &
// Revelle, 2014): matrix puzzles, letter–number series, verbal reasoning and 3D rotation, four of
// each, interleaved and getting harder as they go.
//
// GENERATED, NOT COPIED. ICAR's own items are released to researchers, not for a product like this,
// so three of the four kinds are built here from their published rules (matrices: Matzen et al. 2010's
// attribute rules; rotation: Shepard & Metzler 1971's cube figures) and the verbal items are written
// for this test. Every item comes from a seed stored on the student's block, so it can be rebuilt on
// the server at any time — and THE ANSWER NEVER LEAVES THE SERVER: `publicItem` strips it, and the
// marking happens in submissionsRouter against the rebuilt item.
//
// PROVISIONAL. These items have not been calibrated on students yet, so the score is the share
// answered correctly, flagged provisional, until norms exist (V2).
//
// Pure: no I/O, no clock. The same seed always gives the same sixteen items.

const ITEM_COUNT = 16
const TYPES = ["matrix", "series", "verbal", "rotation"]

// ── a small seeded random generator (mulberry32) ────────────────────────────────────────────────
const rng = (seed) => {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const pick = (random, list) => list[Math.floor(random() * list.length)]

const shuffle = (random, list) => {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1))
        ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
    }
    return copy
}

const permutationsOf3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]

// ── 1. MATRIX PUZZLES ────────────────────────────────────────────────────────────────────────────
// A 3×3 grid of cells, each a number of identical shapes with a fill. The bottom-right cell is
// missing. Each level adds a rule: (1) the count rises along each row; (2) plus the shape follows a
// Latin square; (3) plus the fill does too; (4) all three are Latin squares running different ways.
const SHAPES = ["circle", "square", "triangle", "diamond"]
const FILLS = ["empty", "solid", "striped"]

const sameCell = (left, right) => left.shape === right.shape && left.count === right.count && left.fill === right.fill

const matrixItem = (random, level) => {
    const shapes = shuffle(random, SHAPES).slice(0, 3)
    const fills = shuffle(random, FILLS)
    const shapePerm = pick(random, permutationsOf3)
    const fillPerm = pick(random, permutationsOf3)
    const countPerm = pick(random, permutationsOf3)
    const fixedFill = pick(random, FILLS)

    const cellAt = (row, column) => {
        const latin = (perm, step) => perm[(row + column * step) % 3]
        if (level === 1) return { shape: shapes[row], count: column + 1, fill: fixedFill }
        if (level === 2) return { shape: shapes[latin(shapePerm, 1)], count: column + 1, fill: fixedFill }
        if (level === 3) return { shape: shapes[latin(shapePerm, 1)], count: column + 1, fill: fills[latin(fillPerm, 2)] }
        return { shape: shapes[latin(shapePerm, 1)], count: latin(countPerm, 2) + 1, fill: fills[(row * 2 + column + fillPerm[0]) % 3] }
    }

    const cells = []
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) cells.push(row === 2 && column === 2 ? null : cellAt(row, column))
    }

    const answer = cellAt(2, 2)
    const candidates = [
        cellAt(2, 1),
        cellAt(1, 2),
        { ...answer, shape: shapes.find((shape) => shape !== answer.shape) },
        { ...answer, count: answer.count === 3 ? 2 : answer.count + 1 },
        { ...answer, fill: FILLS.find((fill) => fill !== answer.fill) },
        { ...answer, shape: shapes.filter((shape) => shape !== answer.shape)[1] || answer.shape, fill: FILLS.filter((fill) => fill !== answer.fill)[1] },
    ]

    const distractors = []
    candidates.forEach((cell) => {
        if (!sameCell(cell, answer) && !distractors.some((existing) => sameCell(existing, cell))) distractors.push(cell)
    })

    const options = shuffle(random, [answer, ...distractors.slice(0, 5)])

    return {
        type: "matrix",
        prompt: "Which picture completes the pattern?",
        payload: { cells },
        options,
        answer: options.findIndex((cell) => sameCell(cell, answer)),
    }
}

// ── 2. LETTER–NUMBER SERIES ──────────────────────────────────────────────────────────────────────
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

const seriesItem = (random, level) => {
    let terms
    let answer
    let near

    if (level === 1) {
        const start = 2 + Math.floor(random() * 9)
        const step = 3 + Math.floor(random() * 7)
        terms = [0, 1, 2, 3, 4].map((index) => String(start + index * step))
        answer = String(start + 5 * step)
        near = [start + 5 * step + 1, start + 5 * step - 1, start + 4 * step + step * 2, start + 5 * step + step].map(String)
    } else if (level === 2) {
        const start = Math.floor(random() * 6)
        const positions = [start]
        for (let gap = 2; positions.length < 6; gap += 1) positions.push(positions[positions.length - 1] + gap)
        terms = positions.slice(0, 5).map((position) => LETTERS[position])
        answer = LETTERS[positions[5]]
        near = [positions[5] - 1, positions[5] + 1, positions[5] - 2, positions[5] + 2, positions[5] - 3]
            .filter((position) => position >= 0 && position <= 25)
            .map((position) => LETTERS[position])
    } else if (level === 3) {
        const up = 2 + Math.floor(random() * 5)
        const down = 2 + Math.floor(random() * 5)
        const first = 1 + Math.floor(random() * 6)
        const second = 30 + Math.floor(random() * 10)
        const sequence = []
        for (let index = 0; index < 4; index += 1) sequence.push(first + index * up, second - index * down)
        terms = sequence.slice(0, 7).map(String)
        answer = String(sequence[7])
        near = [sequence[7] - down, sequence[6] + up, sequence[7] + 1, sequence[7] + down].map(String)
    } else {
        const startLetter = 20 + Math.floor(random() * 6)
        const letterStep = 2 + Math.floor(random() * 2)
        const startNumber = 2 + Math.floor(random() * 3)
        const sequence = [0, 1, 2, 3, 4].map((index) => `${LETTERS[startLetter - index * letterStep]}${startNumber * 2 ** index}`)
        terms = sequence.slice(0, 4)
        answer = sequence[4]
        const nextLetter = LETTERS[startLetter - 4 * letterStep]
        const nextNumber = startNumber * 16
        near = [
            `${nextLetter}${nextNumber / 2 * 3}`,
            `${LETTERS[startLetter - 4 * letterStep + 1]}${nextNumber}`,
            `${nextLetter}${nextNumber + startNumber}`,
            `${LETTERS[startLetter - 4 * letterStep - 1]}${nextNumber}`,
        ]
    }

    // a numeric answer always has neighbours to fall back on, so there are always four distractors
    const fallback = /^\d+$/.test(answer) ? [1, -1, 2, -2, 3].map((delta) => String(Number(answer) + delta)) : []
    const distractors = [...new Set([...near, ...fallback].filter((value) => value !== answer))].slice(0, 4)
    const options = shuffle(random, [answer, ...distractors])

    return {
        type: "series",
        prompt: "What comes next?",
        payload: { terms },
        options,
        answer: options.indexOf(answer),
    }
}

// ── 3. VERBAL REASONING ──────────────────────────────────────────────────────────────────────────
// Written for this test, three per level; one of each level is dealt to each student.
const VERBAL = [
    [
        { prompt: "Bird is to nest as bee is to …", options: ["honey", "hive", "flower", "swarm", "wax"], answer: 1 },
        { prompt: "Which word does not belong with the others?", options: ["kilometre", "litre", "gram", "thermometer", "metre"], answer: 3 },
        { prompt: "Doctor is to hospital as teacher is to …", options: ["student", "book", "school", "lesson", "exam"], answer: 2 },
    ],
    [
        { prompt: "Ravi is taller than Sunil. Sunil is taller than Arjun. Arjun is taller than Kabir. Who is the second shortest?", options: ["Ravi", "Sunil", "Arjun", "Kabir", "Cannot be told"], answer: 2 },
        { prompt: "If the day after tomorrow is Sunday, what day was yesterday?", options: ["Wednesday", "Thursday", "Friday", "Saturday", "Tuesday"], answer: 1 },
        { prompt: "Which is the odd one out?", options: ["ladder", "staircase", "lift", "escalator", "bridge"], answer: 4 },
    ],
    [
        { prompt: "All the students in the debate club read the newspaper. Meera reads the newspaper. What must be true?", options: ["Meera is in the debate club", "Meera is not in the debate club", "Nothing certain follows about whether Meera is in the club", "Everyone who reads the newspaper is in the club", "Only debaters read the newspaper"], answer: 2 },
        { prompt: "If CAT is written as DBU, how is DOG written?", options: ["EPH", "EOH", "DPH", "FQI", "CNF"], answer: 0 },
        { prompt: "Asha walks 5 km north, then 3 km east, then 5 km south. How far is she from where she started?", options: ["3 km", "5 km", "8 km", "10 km", "13 km"], answer: 0 },
    ],
    [
        { prompt: "Pointing to a man, Neha says: \"His mother is my mother's only daughter.\" How is the man related to Neha?", options: ["Brother", "Son", "Nephew", "Cousin", "Father"], answer: 1 },
        { prompt: "No fruit sold at this stall is imported. Some mangoes are sold at this stall. Which must be true?", options: ["All mangoes are imported", "Some mangoes are not imported", "No mangoes are imported", "Some imported fruit is sold at this stall", "All fruit at this stall is a mango"], answer: 1 },
        { prompt: "In a row of children, Kiran is 7th from the left and 12th from the right. How many children are in the row?", options: ["17", "18", "19", "20", "21"], answer: 1 },
    ],
]

const verbalItem = (random, level) => {
    const source = pick(random, VERBAL[level - 1])
    const order = shuffle(random, source.options.map((option, index) => index))
    return {
        type: "verbal",
        prompt: source.prompt,
        payload: {},
        options: order.map((index) => source.options[index]),
        answer: order.indexOf(source.answer),
    }
}

// ── 4. 3D ROTATION ───────────────────────────────────────────────────────────────────────────────
// Shepard–Metzler figures: a chain of cubes bending in three dimensions. Exactly one option is the
// same object turned; the others are its MIRROR IMAGE turned (which no rotation can produce — that
// is the whole test) or a different object. Levels 1-2 turn it about the vertical axis only.
const ROTATIONS = (() => {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    const results = []
    const signs = [1, -1]
    for (const x of axes) for (const y of axes) {
        if (x === y) continue
        for (const sx of signs) for (const sy of signs) {
            const X = x.map((value) => value * sx)
            const Y = y.map((value) => value * sy)
            const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]]
            results.push([X, Y, Z])
        }
    }
    return results
})()

const ABOUT_VERTICAL = ROTATIONS.filter(([X, Y, Z]) => Y[1] === 1)   // turns that keep "up" up

const applyRotation = ([X, Y, Z], cube) => [
    X[0] * cube[0] + Y[0] * cube[1] + Z[0] * cube[2],
    X[1] * cube[0] + Y[1] * cube[1] + Z[1] * cube[2],
    X[2] * cube[0] + Y[2] * cube[1] + Z[2] * cube[2],
]

const normalise = (cubes) => {
    const min = [0, 1, 2].map((axis) => Math.min(...cubes.map((cube) => cube[axis])))
    return cubes.map((cube) => cube.map((value, axis) => value - min[axis])).sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2])
}

const keyOf = (cubes) => JSON.stringify(normalise(cubes))
const isTurnOf = (shape, other) => ROTATIONS.some((rotation) => keyOf(shape.map((cube) => applyRotation(rotation, cube))) === keyOf(other))
const mirror = (cubes) => cubes.map(([x, y, z]) => [-x, y, z])

const DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

const chain = (random) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const cubes = [[0, 0, 0]]
        let previous = null
        let ok = true
        for (let arm = 0; arm < 4 && ok; arm += 1) {
            const choices = DIRECTIONS.filter((direction) => !previous || direction.every((value, axis) => value * previous[axis] === 0))
            const direction = pick(random, choices)
            const length = arm === 0 || arm === 3 ? 2 : 2 + Math.floor(random() * 2)
            for (let step = 0; step < length; step += 1) {
                const last = cubes[cubes.length - 1]
                const next = last.map((value, axis) => value + direction[axis])
                if (cubes.some((cube) => cube.every((value, axis) => value === next[axis]))) { ok = false; break }
                cubes.push(next)
            }
            previous = direction
        }
        // must use all three dimensions, and must not be its own mirror image
        const spans = [0, 1, 2].map((axis) => new Set(cubes.map((cube) => cube[axis])).size)
        if (ok && spans.every((span) => span > 1) && !isTurnOf(cubes, mirror(cubes))) return normalise(cubes)
    }
    throw new Error("could not build a rotation figure")
}

const rotationItem = (random, level) => {
    const target = chain(random)
    const turns = level <= 2 ? ABOUT_VERTICAL.filter(([X]) => X[0] !== 1) : ROTATIONS.filter(([X, Y]) => !(X[0] === 1 && Y[1] === 1))
    const turned = (shape) => {
        const rotation = pick(random, turns)   // one turn for the whole object
        return normalise(shape.map((cube) => applyRotation(rotation, cube)))
    }

    let other = chain(random)
    for (let attempt = 0; attempt < 50 && (isTurnOf(other, target) || isTurnOf(other, mirror(target))); attempt += 1) other = chain(random)

    const correct = turned(target)
    const mirrored = turned(mirror(target))
    let mirroredAgain = turned(mirror(target))
    for (let attempt = 0; attempt < 30 && keyOf(mirroredAgain) === keyOf(mirrored); attempt += 1) mirroredAgain = turned(mirror(target))
    const options = shuffle(random, [correct, mirrored, mirroredAgain, turned(other)])

    return {
        type: "rotation",
        prompt: "Which one is the same object as the first, just turned?",
        payload: { target },
        options,
        answer: options.findIndex((option) => isTurnOf(option, target)),
    }
}

// ── the sixteen ──────────────────────────────────────────────────────────────────────────────────
const BUILDERS = { matrix: matrixItem, series: seriesItem, verbal: verbalItem, rotation: rotationItem }

// item i: kind TYPES[i % 4], level 1 + floor(i / 4) — four rounds, each a little harder
const itemFor = (seed, index) => {
    if (index < 0 || index >= ITEM_COUNT) return null
    const type = TYPES[index % TYPES.length]
    const level = 1 + Math.floor(index / TYPES.length)
    const item = BUILDERS[type](rng((seed >>> 0) + index * 1013), level)
    return { id: `R${index + 1}`, index, level, ...item }
}

// what the browser may see — everything but the answer
const publicItem = (item) => {
    if (!item) return null
    const { answer, ...visible } = item
    return visible
}

module.exports = { ITEM_COUNT, TYPES, itemFor, publicItem, isTurnOf, mirror, VERBAL }
