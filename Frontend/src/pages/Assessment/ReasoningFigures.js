// The pictures for the in-house reasoning test (Round 10). Pure SVG drawn from the item's data —
// the server sends shapes and cube positions, never images, so nothing about an item is hidden in a
// file name or an image the browser has to fetch.

const NAVY = "#1E2A38"
const TEAL = "#007582"

// ── matrix cells: 1-3 identical shapes, empty, solid or striped ─────────────────────────────────
function Shape({ shape, fill, x, y, size, patternId }) {
    const paint = fill === "solid" ? NAVY : fill === "striped" ? `url(#${patternId})` : "none"
    const common = { fill: paint, stroke: NAVY, strokeWidth: 2 }
    const half = size / 2

    if (shape === "circle") return <circle cx={x} cy={y} r={half} {...common} />
    if (shape === "square") return <rect x={x - half} y={y - half} width={size} height={size} {...common} />
    if (shape === "triangle") return <polygon points={`${x},${y - half} ${x + half},${y + half} ${x - half},${y + half}`} {...common} />
    return <polygon points={`${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}`} {...common} />
}

export function MatrixCell({ cell, size = 90, id }) {
    const patternId = `stripes-${id}`
    const shapeSize = size * 0.22
    const gap = size * 0.3
    const startX = size / 2 - ((cell ? cell.count : 1) - 1) * gap / 2

    return (
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label={cell ? `${cell.count} ${cell.fill} ${cell.shape}${cell.count > 1 ? "s" : ""}` : "missing"}>
            <defs>
                <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke={NAVY} strokeWidth="2" />
                </pattern>
            </defs>
            <rect x="1" y="1" width={size - 2} height={size - 2} rx="8" fill="#ffffff" stroke="#D1D5DB" strokeWidth="2" />
            {cell
                ? Array.from({ length: cell.count }, (_, index) => (
                    <Shape key={index} shape={cell.shape} fill={cell.fill} x={startX + index * gap} y={size / 2} size={shapeSize} patternId={patternId} />
                ))
                : <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fontSize="30" fontWeight="900" fill={TEAL}>?</text>}
        </svg>
    )
}

// ── 3D cube figures (Shepard–Metzler), drawn in isometric view ──────────────────────────────────
const COS30 = Math.cos(Math.PI / 6)
const SIN30 = 0.5

const project = ([x, y, z]) => [(x - z) * COS30, -(y) + (x + z) * SIN30]

const FACES = [
    { tone: "#7FC4CB", corners: (x, y, z) => [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },   // top
    { tone: "#2F8F99", corners: (x, y, z) => [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]] },   // right
    { tone: "#0B5C66", corners: (x, y, z) => [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },   // left
]

export function CubeFigure({ cubes, size = 140, label }) {
    // farthest first, so nearer cubes paint over the faces they hide
    const ordered = [...cubes].sort((left, right) => (left[0] + left[1] + left[2]) - (right[0] + right[1] + right[2]))
    const polygons = []
    ordered.forEach(([x, y, z], cubeIndex) => {
        FACES.forEach((face, faceIndex) => {
            polygons.push({ key: `${cubeIndex}-${faceIndex}`, tone: face.tone, points: face.corners(x, y, z).map(project) })
        })
    })

    const all = polygons.flatMap((polygon) => polygon.points)
    const minX = Math.min(...all.map((point) => point[0]))
    const maxX = Math.max(...all.map((point) => point[0]))
    const minY = Math.min(...all.map((point) => point[1]))
    const maxY = Math.max(...all.map((point) => point[1]))
    const pad = 0.4

    return (
        <svg
            viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
            width={size}
            height={size}
            role="img"
            aria-label={label || "a figure made of cubes"}
            style={{ maxWidth: "100%" }}
        >
            {polygons.map((polygon) => (
                <polygon
                    key={polygon.key}
                    points={polygon.points.map((point) => point.join(",")).join(" ")}
                    fill={polygon.tone}
                    stroke={NAVY}
                    strokeWidth="0.05"
                    strokeLinejoin="round"
                />
            ))}
        </svg>
    )
}
