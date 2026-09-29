# CODING_STYLE.md

This guide describes how I write code, so that a new project reads like my existing ones. It covers structure and code conventions only. It does not cover what the app does or how it looks: styling, CSS, layout and colours are deliberately left out.

Every code example is copied from my existing code. `// …` marks lines I cut; everything else is exactly as written, quirks included.

---

## 0. Quick reference

| Topic | Default |
|---|---|
| Backend stack | Express 5, Mongoose, bcrypt, jsonwebtoken, dotenv, cors (CommonJS). nodemon is the only dev dependency |
| Frontend stack | Create React App, React Router, Redux Toolkit, axios, antd, dayjs (ES modules) |
| Quotes | double `"` |
| Semicolons | none in most files (see §4.3) |
| Indent | 4 spaces |
| Backend layers | router file → Mongoose model. No controllers, no services |
| Route paths | camelCase action names: `/getAll`, `/add`, `/update/:id`, `/delete/:id` |
| Response shape | `{ success, message, data }` |
| Components | `function Name() {}` with `export default Name` on the last line, `.js` extension |
| API calls | `src/apiCall/<entity>Api.js`, one exported `async function` per endpoint |
| Global state | Redux holds only the logged-in user; everything else is `useState` |
| Auth | JWT in `localStorage` under `"token"`, sent as `Authorization: Bearer`, backend puts the user on `req.user` |

---

## 1. Structure

### 1.1 Folder layout

```
<project>/
├── .gitignore                 # one, at the root
├── Backend/
│   ├── .env.example
│   ├── package.json
│   ├── server.js              # entry point (no separate app.js)
│   ├── config/
│   │   └── MongoDBCon.js
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── adminAuthMiddleware.js
│   │   └── profileAuthMiddleware.js
│   ├── model/
│   │   ├── moviesModel.js
│   │   ├── showsModel.js
│   │   └── userModel.js …
│   └── Routers/
│       ├── moviesRouter.js
│       ├── showsRouter.js
│       └── userRouter.js …
└── Frontend/                  # Create React App
    ├── .env.example
    ├── package.json
    └── src/
        ├── index.js           # wraps <App /> in the Redux <Provider>
        ├── App.js             # every route lives here
        ├── apiCall/
        │   ├── axiosInstance.js
        │   ├── moviesApi.js
        │   └── userApi.js …
        ├── store/
        │   ├── store.js
        │   └── userSlice.js
        └── pages/
            ├── Login.js       # role-independent pages sit directly in pages/
            ├── Register.js
            ├── Navbar.js
            ├── Admin/         # grouped by role …
            │   ├── AdminHome.js
            │   ├── AdminProtectedRoute.js
            │   └── TheatreAdminList.js
            ├── Profile/
            │   ├── index.js
            │   └── ProfileProtectedRoute.js
            ├── User/
            │   ├── Home.js
            │   ├── ProtectedRoute.js
            │   └── …
            ├── Movies/        # … or by entity (List + Form pairs)
            │   ├── MoviesList.js
            │   └── MoviesForm.js
            ├── Shows/
            └── Theatres/
```

Rules:

- The repo has two top-level folders, `Backend/` and `Frontend/`, each with its own `package.json`. There is no monorepo tooling and no code shared between them.
- Backend folders are `config/`, `middlewares/`, `model/` (singular) and `Routers/` (capital R). There is no `controllers/`, `services/` or `utils/`.
- The frontend has no `components/` folder. Everything that renders is in `pages/`, including the navbar and the route guards. A subfolder of `pages/` is either a **role** (`Admin/`, `User/`, `Profile/`) or an **entity** (`Movies/`, `Theatres/`, `Shows/`).
- A folder can expose an `index.js` so it can be imported by folder name:

```js
import Profile from "./pages/Profile";
```

### 1.2 File naming

| File type | Convention | Real examples |
|---|---|---|
| Express router | camelCase `<entity>Router.js`, usually plural | `moviesRouter.js`, `theatresRouter.js`, `bookingsRouter.js`, `userRouter.js` |
| Mongoose model | camelCase `<entity>Model.js` | `moviesModel.js`, `showsModel.js`, `bookingsModel.js`, `theatreModel.js`, `userModel.js` |
| Middleware | camelCase `<role>AuthMiddleware.js` | `authMiddleware.js`, `adminAuthMiddleware.js`, `profileAuthMiddleware.js` |
| Config | PascalCase | `MongoDBCon.js` |
| React component / page | PascalCase `.js` (never `.jsx`) | `MoviesList.js`, `TheatreForm.js`, `AdminProtectedRoute.js`, `BookingPage.js` |
| Frontend API module | camelCase `<entity>Api.js` | `moviesApi.js`, `theatreApi.js`, `bookingsApi.js`, `axiosInstance.js` |
| Redux | camelCase | `store.js`, `userSlice.js` |
| Env template | `.env.example` in each app | `Backend/.env.example`, `Frontend/.env.example` |

A file's name and its export's name differ: `moviesModel.js` exports `Movie`, and `moviesRouter.js` exports `router`, which `server.js` imports as `moviesRouter`.

### 1.3 Request flow: route → model (no controller)

A feature is one model file, one router file, one mount line and one frontend API file:

```
Backend/model/moviesModel.js       const Movie = mongoose.model("Movie", movieSchema)
Backend/Routers/moviesRouter.js    router.post("/add", …)  →  Movie.create(…)
Backend/server.js                  app.use("/movies", moviesRouter)
Frontend/src/apiCall/moviesApi.js  addMovie(payload)  →  axiosInstance.post("/movies/add", payload)
Frontend/src/pages/Movies/…        const response = await addMovie(payload)
```

The router imports the models and middleware directly and does the database work inside the handler:

```js
// Backend/Routers/moviesRouter.js
const express = require("express")
const Movie = require("../model/moviesModel")
const Show = require("../model/showsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")

const router = express.Router()
```

Requires in a router go in this order: `express`, then third-party libraries, then models, then middlewares, then `const router = express.Router()`. The file ends with `module.exports = router`.

---

## 2. Backend

### 2.1 `server.js` setup

Everything is in `server.js`. The order is:

1. Require `express` and `dotenv`, then call `dotenv.config()` straight away, before any router is required.
2. Require every router.
3. Require `cors`.
4. Require the DB config file for its side effect.
5. `const app = express()`.
6. CORS with an allow-list of origins.
7. `const PORT = process.env.PORT`.
8. Mount the routers. A router that needs the raw request body (the Stripe webhook) is mounted **before** `app.use(express.json())`.
9. `app.listen` with a template-literal log line.

```js
const express = require('express');
const dotenv = require("dotenv")

dotenv.config();

const userRouter = require('./Routers/userRouter')
const moviesRouter = require('./Routers/moviesRouter')
const theatresRouter = require('./Routers/theatresRouter')
const showsRouter = require('./Routers/showsRouter')
const bookingsRouter = require("./Routers/bookingsRouter")

const cors = require("cors");

const db = require("./config/MongoDBCon.js") // writing db is optional. Just the require(), runs the entire file.

const app = express()

const allowedOrigins = [
    "http://localhost:3000",
    process.env.FRONTEND_URL,
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

const PORT = process.env.PORT;
// console.log(process.env.PORT)

app.use("/bookings", bookingsRouter)

app.use(express.json())
app.use("/user", userRouter)
app.use("/movies", moviesRouter)
app.use("/theatres", theatresRouter)
app.use('/shows',showsRouter)

app.listen(PORT, () => {  
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

The router mounted before the global JSON parser adds `express.json()` to each of its JSON routes:

```js
router.post(
    "/create-checkout-session",express.json(),
     authMiddleware,
    createCheckoutSession
);
```

Mount paths are plural entity names (`/movies`, `/theatres`, `/shows`, `/bookings`), except `/user`.

### 2.2 Database connection

`config/MongoDBCon.js` connects as soon as it is required and logs the connection events. It exports nothing.

```js
const mongoose = require("mongoose");

// console.log(process.env.DB_URI)
mongoose.connect(process.env.DB_URI);

const connection = mongoose.connection;

connection.on("connected", () => {
    console.log("Database connected.");
});

connection.on("error", (err) => {
    console.log("MongoDB connection error:", err);
});
```

### 2.3 Mongoose schemas and models

- One model per file.
- The schema variable is `<singular>Schema`. The model variable and the model name are both singular PascalCase.
- Every field uses the object form `{ type, required }`, even a plain string. Never the shorthand `name: String`.
- Schema validation is limited to `required`, `unique` and `default`. No `enum`, `min`/`max`, `match`, custom validators, hooks, virtuals or methods.
- `{ timestamps: true }` is the second argument, and lists are sorted by `createdAt`.
- References use `mongoose.Schema.Types.ObjectId` with `ref: "<ModelName>"`. The field is named after the entity (`movie`, `theatre`, `user`, `owner`), not `movieId`.
- Arrays are written `type: [String]`.
- Boolean flags start with `is`.
- `module.exports = Model` is the last line.

```js
// Backend/model/showsModel.js
const mongoose = require("mongoose")

const showSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        movie: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Movie",
            required: true,
        },
        // …
        bookedSeats: {
            type: [String],
            default: [],
        },
    },
    {   
        timestamps: true,
    }
)

const Show = mongoose.model("Show", showSchema)

module.exports = Show
```

```js
// Backend/model/theatreModel.js
        isActive: {
            type: Boolean,
            default: false, // pending by default until admin approves
        },
```

**Where validation lives.** Format checks go in the route handler on the backend, and in antd `Form.Item` `rules` on the frontend. They do not go in the schema.

```js
// Backend/Routers/userRouter.js
        // Validate Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Email"
            });
        }
```

```js
// Frontend/src/pages/Theatres/TheatreForm.js
                    rules={[
                        { required: true, message: "Please enter phone number" },
                        { pattern: /^[0-9]{10}$/, message: "Enter a valid 10-digit phone number" }
                    ]}
```

### 2.4 Route handlers

Every handler has the same shape:

- An inline `async (req, res) =>` arrow function. No `.then()` chains.
- The path is a camelCase **action name**, not a REST resource: `/getAll`, `/add`, `/update/:id`, `/delete/:id`, `/getById/:id`, `/getUserShows`, `/getShowById/:id`. The HTTP verb still matches the action: `get` to read, `post` to create, `put` to update, `delete` to delete.
- Middlewares are listed inline between the path and the handler.
- The whole body sits in one `try`, and a single `catch (error)` returns 500.
- Every response is `return res.status(code).json({...})`.
- A missing document returns 404 from an `if (!doc)` check.

This is the canonical create/update pair. Copy it for a new entity.

```js
// ========================
// Add Movie
// ========================

router.post("/add", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { name, poster, genre, description, duration, languages, releaseDate } = req.body

        const newMovie = await Movie.create({
            name,
            poster,
            genre,
            description,
            duration,
            languages,
            releaseDate,
        })

        return res.status(201).json({
            success: true,
            message: "Movie added successfully",
            data: newMovie,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to add movie",
            error: error.message,
        })
    }
})


// ========================
// Update Movie
// ========================

router.put("/update/:id", authMiddleware,adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params

        const updatedMovie = await Movie.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true }  // returns the updated document, not the old one
        )

        if (!updatedMovie) {
            return res.status(404).json({
                success: false,
                message: "Movie not found",
            })
        }

        return res.status(200).json({
            success: true,
            message: "Movie updated successfully",
            data: updatedMovie,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update movie",
            error: error.message,
        })
    }
})
```

Details that repeat across handlers:

| Situation | What I do |
|---|---|
| Create | Destructure the allowed fields from `req.body` and pass them to `Model.create({...})` as shorthand properties |
| Update | Spread the whole body, `{ ...req.body }`, with `{ new: true }` |
| Owner / current user | Read it from `req.user._id`, never from the body |
| Server-controlled fields | Set them explicitly in `create` (`isActive: false`, `bookedSeats: 0`, `availableSeats: totalSeats`) |
| Names for returned docs | `newX`, `updatedX`, `deletedX`, `populatedX`, `existingX` |
| Populate | One `.populate()` per path, each on its own line; passwords excluded with `"-password"` |
| Delete | Returns the deleted document as `data` |
| Admin-only variant | A separate route with a `ForAdmin` suffix (`/getAllForAdmin`, `/updateForAdmin/:id`) instead of branching inside one handler |
| Reshaping data | Plain JS on the fetched docs (`Set`, `filter`, `map`, spreading `._doc` / `.toObject()`), not aggregation pipelines |

```js
// Backend/Routers/showsRouter.js
        const shows = await Show.find({
            theatre: { $in: theatreIds }
        })
            .populate("movie")
            .populate("theatre")
            .populate("user", "-password")
            .sort({ date: 1 })
```

```js
// Backend/Routers/bookingsRouter.js
        const bookings = await Booking.find({ user: req.user._id })
            .populate({
                path: "show",
                populate: [
                    { path: "movie" },
                    { path: "theatre" },
                ]
            })
            .sort({ createdAt: -1 })
```

```js
// Backend/Routers/theatresRouter.js
        const newTheatre = await Theatre.create({
            name,
            address,
            phone,
            email,
            owner: req.user._id,    // taken from auth middleware, not from req.body
            isActive: false,        // always starts as pending
        })
```

```js
// Backend/Routers/moviesRouter.js
      // extract unique movieIds that have at least one show
        const movieIdsWithShows = new Set(
            shows.map((show) => show.movie.toString())
        )

        // now filter synchronously — no async needed
        const moviesWithShows = movies.filter((movie) =>
            movieIdsWithShows.has(movie._id.toString())
        )
```

### 2.5 Response envelope and status codes

Every JSON response has `success` (a boolean) and `message` (a readable sentence). The payload goes under `data`. Auth endpoints use `token` and `userData` instead.

| Code | When | Message pattern |
|---|---|---|
| 200 | fetch, update, delete | `"Movies fetched successfully"`, `"Movie updated successfully"` |
| 201 | create | `"Movie added successfully"`, `"Registered Successfully"` |
| 400 | validation failed | `"Invalid Email"`, `"User already exists"` |
| 401 | missing token or wrong role | `"Token missing"`, `"Permission Not Granted for this request"` |
| 404 | document not found | `"Movie not found"` |
| 500 | anything that reaches `catch` | `"Failed to fetch movies"`, plus `error: error.message` |

```js
// Backend/Routers/userRouter.js
        return res.status(201).json({
            success: true,
            message: "Registered Successfully",
            token: jwtToken

        });
```

When a response returns several things, they go in a named object under `data`:

```js
        return res.status(200).json({
            success: true,
            message: "Movies fetched successfully",
            data: {
                upcoming: moviesUpcoming,
                withShows: moviesWithShows
            }        })
```

The frontend branches on these `message` strings (§3.4), which makes them part of the API contract. If you reword one, update the frontend too.

### 2.6 Inline handlers vs named handlers

Handlers are inline by default. The only named handlers are the Stripe checkout and webhook in `bookingsRouter.js`. They are defined higher up in the same file and then passed to the router. They still don't live in a controllers folder.

```js
//webhook to be sent by the Stripe to my backend

webhook = async (req, res) => {
// …
};
```

```js
router.post(
    "/payment-confirmation-webhook",
    express.raw({ type: "application/json" }),
    webhook
);
```

When you write a new named handler, declare it with `const`. Leaving it off above was a slip, not a convention.

### 2.7 Auth and middleware

- Auth uses JWTs. A token is signed with `{ userId: user._id }`, `expiresIn: "7d"` and `process.env.AUTH_KEY`.
- Register returns a token as well as login, so a new user is logged in immediately.
- Passwords are hashed with `bcrypt.genSalt(10)` then `bcrypt.hash`, and checked with `bcrypt.compare`.
- `authMiddleware` reads `Authorization: Bearer <token>`, verifies the token, loads the user without the password and attaches it to `req.user`.
- Roles are flags on the User document (`isAdmin`, `isProfile`). Each role has its own small middleware that checks `req.user` and always runs **after** `authMiddleware`.
- Middleware failures return 401 in the usual `{ success, message }` shape.
- Each role also has its own "who am I" endpoint (`/getCurrentUser`, `/getCurrentAdmin`, `/getCurrentProfile`), which that role's frontend route guard calls.

```js
// Backend/Routers/userRouter.js
        const jwtToken = jwt.sign(
            {
                userId: user._id
            },
            process.env.AUTH_KEY,
            {
                expiresIn: "7d"
            }
        );
```

```js
// Backend/middlewares/authMiddleware.js
const authMiddleware = async (req, res, next) => {
    try {

        // Authorization: Bearer xxxxxxxxxxxxx
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success:false,
                message: "Token missing"
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify JWT
        const decoded = jwt.verify(token, process.env.AUTH_KEY);

        // Get latest user from DB
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        // Make user available to next middleware/route
        req.user = user;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            error        });

    }
};

module.exports = authMiddleware;
```

```js
// Backend/middlewares/adminAuthMiddleware.js
const adminAuthMiddleware = async (req, res, next) => {
    try {

        const authHeader = req.user.isAdmin;


        if (!authHeader) {
            return res.status(401).json({
                success:false,
                message: "Permission Not Granted for this request"
            });
        }

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            error
        });

    }
};

module.exports = adminAuthMiddleware;
```

Middlewares are chained like this:

```js
router.get(
    "/getCurrentAdmin",
    authMiddleware,
    adminAuthMiddleware,
    async (req, res) => {
```

### 2.8 Config and env vars

- `dotenv.config()` is called once, at the top of `server.js`.
- `process.env.X` is read inline wherever it's needed. There is no config object or constants module.
- Env var names are SCREAMING_SNAKE_CASE: `DB_URI`, `PORT`, `AUTH_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`.
- Each app commits a `.env.example` with placeholder values and hints. `.env` is gitignored.

```js
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

```js
            success_url:
                `${process.env.FRONTEND_URL}/payment-success`,
```

On the frontend (CRA), variables use the `REACT_APP_` prefix and are read inline at the top of the file that uses them:

```
REACT_APP_API_URL=""
REACT_APP_STRIPE_PUBLISHABLE_KEY=""
```

---

## 3. Frontend

### 3.1 Components

- Components are functions declared as `function Name() {`, with `export default Name` on the last line. No top-level arrow components, no named component exports, no class components, no TypeScript or PropTypes.
- One component per file. The exception is a small helper component defined inside its parent:

```js
    const MovieCard = ({ movie, isUpcoming }) => (
```

- Props are destructured in the function signature.
- Files are plain `.js`, with JSX inside.
- antd provides the forms, tables, tabs, modals and toasts (`Form.useForm`, `Table` `columns`, `message`). This guide only covers how they're wired up, not how they look.
- Each page renders `<Navbar />` itself at the top. There is no shared layout component.

Inside a component, things go in this order:

1. Router and Redux hooks (`useNavigate`, `useDispatch`, `useParams`, `useSelector`)
2. `useState` declarations
3. `useEffect` for the initial fetch
4. The `fetchX` function
5. `handleX` functions, grouped under banner comments
6. The table's `columns` config, if there is one
7. Early returns (`if (loading)`, `if (!data) return null`)
8. `return (` with the JSX

```js
// Frontend/src/pages/Movies/MoviesList.js
function MoviesList() {
    const [movies, setMovies] = useState([])
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState(null) // null | "edit" | "delete" | "add"
    const [showForm, setShowForm] = useState(false)
    const [selectedMovie, setSelectedMovie] = useState(null) // for edit

    // ─── Fetch all movies on mount ───────────────────────────────────────────
    useEffect(() => {
        fetchMovies()
    }, [])

    const fetchMovies = async () => {
        try {
            setLoading(true)
            const response = await getAllMovies()
            setMovies(response.data.data)
        } catch (error) {
            message.error("Failed to fetch movies")
        } finally {
            setLoading(false)
        }
    }

    // ─── Delete ──────────────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        try {
            await deleteMovie(id)
            message.success("Movie deleted successfully")
            setMovies((prev) => prev.filter((movie) => movie._id !== id))
        } catch (error) {
            message.error("Failed to delete movie")
        }
    }
```

Early returns:

```js
    if (!movie) return null
```

```js
  if (loading) {
    return <div>Loading...</div> // swap for a spinner/skeleton if you have one
  }
  return children
```

#### The List + Form pair

Every entity that can be managed gets an `<Entity>List.js` and an `<Entity>Form.js` in the same folder.

- **The List** owns the array, `loading`, a `mode` toggle (`null | "edit" | "delete" | "add"`), `showForm` and `selectedX`. It runs deletes and updates itself, then patches local state instead of refetching.
- **The Form** is a modal with a fixed set of props: `visible, onClose, initialData, onAddSuccess, onUpdateSuccess`. `initialData` is `null` in add mode. The Form calls the **add** API itself but passes **updates** back to the List through `onUpdateSuccess(id, payload)`.

```js
// Frontend/src/pages/Movies/MoviesForm.js
function MoviesForm({ visible, onClose, initialData, onAddSuccess, onUpdateSuccess }) {
    const [form] = Form.useForm()
    const isEditMode = !!initialData

    // Pre-fill form when editing
    useEffect(() => {
        if (initialData) {
            form.setFieldsValue({
                ...initialData,
                releaseDate: initialData.releaseDate
                    ? dayjs(initialData.releaseDate)
                    : null,
            })
        } else {
            form.resetFields()
        }
    }, [initialData, form])

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()

            const payload = {
                ...values,
                releaseDate: values.releaseDate
                    ? values.releaseDate.toISOString()
                    : null,
            }

            if (isEditMode) {
                // Trigger update in MoviesList
                await onUpdateSuccess(initialData._id, payload) 
            } else {
                // Add new movie
                const response = await addMovie(payload)
                message.success("Movie added successfully")
                onAddSuccess(response.data.data)
            }

            form.resetFields()
        } catch (error) {
            if (error?.errorFields) return // antd validation error, already shown inline
            message.error(
                error.response?.data?.message || "Something went wrong"
            )
        }
    }
```

The List wires the Form up like this:

```js
            <MoviesForm
                visible={showForm}
                onClose={() => {
                    setShowForm(false)
                    setSelectedMovie(null)
                    setMode(null)
                }}
                initialData={selectedMovie}      // null = add mode, object = edit mode
                onAddSuccess={handleAddSuccess}
                onUpdateSuccess={handleUpdate}
            />
```

After a mutation, local state is patched with the functional `prev` updater every time:

```js
            setMovies((prev) =>
                prev.map((movie) =>
                    movie._id === id ? { ...movie, ...updatedData } : movie
                )
            )
```

```js
    const handleAddSuccess = (newMovie) => {
        setMovies((prev) => [...prev, newMovie])
```

The toolbar buttons toggle `mode`, and the table's Action column renders according to the current `mode`:

```js
                    onClick={() => setMode(mode === "edit" ? null : "edit")}
```

Dates are converted at the form boundary: `dayjs(...)` on the way into the form, `.toISOString()` on the way out.

#### Container pages

Each role's home page (`Home`, `AdminHome`, `Profile`) is a thin container that puts Lists into `Tabs`. When one sibling needs another to refetch, the parent holds a counter:

```js
// Frontend/src/pages/Profile/index.js
        const [refreshShows, setRefreshShows] = useState(0)
```

```js
                        <TheatreList   onShowAdded={() => setRefreshShows((prev) => prev + 1)}
/>
```

```js
// Frontend/src/pages/Shows/ShowsList.js
    useEffect(() => {
        fetchShows()
    }, [refreshShows])
```

When a component loads several things at once, it uses `Promise.all` and names the results `xRes`:

```js
                const [moviesRes, theatresRes] = await Promise.all([
                    getAllMovies(),
                    getAllTheatres(),
                ])
```

#### Routing

All routes are in `App.js` as one flat `<Routes>` list. A protected route wraps its page in the matching role guard:

```js
          <Route
            path="/admin"
            element={<AdminProtectedRoute>
              <AdminHome />
            </AdminProtectedRoute>}
          />
```

```js
          <Route path="/movie/:id" element={
            <ProtectedRoute>
              <MoviePage />
            </ProtectedRoute>
          } />
```

URL paths are lowercase, with singular nouns for detail pages (`/movie/:id`, `/booking/:id`) and kebab-case for multi-word paths (`/payment-success`). Params are read with `const { id } = useParams()`.

### 3.2 State management

- **Redux Toolkit holds only the logged-in user.** There is one slice with one reducer and one action, `setUser`, which replaces the whole slice state.
- Everything else (lists, loading flags, modal visibility, form mode, selections) is local `useState`. No Context, React Query or custom hooks.
- The JWT is stored in `localStorage` under `"token"`.

```js
// Frontend/src/store/userSlice.js
import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    user: null,
  },
  reducers: {
    setUser(state, action) {
      return action.payload;
    },
  },
});

export const { setUser } = userSlice.actions;
export default userSlice.reducer; 
```

```js
// Frontend/src/store/store.js
export const store = configureStore({
  reducer: {
    user: userReducer,
  },
});
```

Components read the user like this:

```js
    const { user } = useSelector((state) => state.user)
```

and write it like this. The reducer replaces the whole slice, so always dispatch `{ user: ... }`:

```js
        dispatch(
          setUser({
            user: currentUserResponse.data.userData, // or .data.userData -- depends on getCurrentUser's return shape
          })
        )
```

Logout clears Redux and `localStorage`, then navigates:

```js
    const handleLogout = () => {
        dispatch(setUser({
        }))
        setDrawerOpen(false)
        setUserState(null)
        localStorage.removeItem("token")
        navigate("/login")
    }
```

### 3.3 Calling the backend

API calls live in `src/apiCall/`: one file per backend router, plus a shared `axiosInstance`. Components never import axios directly.

The axios instance reads the base URL from env and adds the token in a request interceptor:

```js
// Frontend/src/apiCall/axiosInstance.js
import axios from "axios"
console.log(process.env.REACT_APP_API_URL)

const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    headers: {  
        "Content-Type": "application/json",
    },
})

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export default axiosInstance
```

API functions follow these rules:

- Each one is a named `export async function`.
- The name is `<verb><Entity>`, taken from the backend action: `/movies/getAll` → `getAllMovies`, `/movies/add` → `addMovie`, `/theatres/getAllForAdmin` → `getAllTheatresForAdmin`.
- Arguments are `(id, payload)`, `(id)` or `(payload)`.
- They return the raw axios `response`, and the component unwraps `response.data.data`.
- CRUD API functions don't catch errors. The component's `try/catch` does that.

```js
// Frontend/src/apiCall/moviesApi.js
import axiosInstance from "./axiosInstance"

export async function getAllMovies() {
    const response = await axiosInstance.get("/movies/getAll")
    return response
}

export async function addMovie(payload) {
    const response = await axiosInstance.post("/movies/add", payload)
    return response
}

export async function updateMovie(id, payload) {
    const response = await axiosInstance.put(`/movies/update/${id}`, payload)
    return response
}

export async function deleteMovie(id) {
    const response = await axiosInstance.delete(`/movies/delete/${id}`)
    return response
}
```

**Auth API functions are the exception.** They catch and return `error.response`, so a 400, 401 or 404 still resolves and the page can read `response.data.message`:

```js
// Frontend/src/apiCall/userApi.js
export async function loginUser(payload) {
    try {
        const response = await axiosInstance.post(
            "/user/login",
            payload
        );

        return response;

    } catch (error) {
        return error.response;
    }
}
```

### 3.4 Frontend auth flow

**Route guards.** Each role has its own guard component (`ProtectedRoute`, `AdminProtectedRoute`, `ProfileProtectedRoute`). They are copies of one template: call that role's `getCurrentX` endpoint, store the user in Redux, and render `children`.

```js
// Frontend/src/pages/Admin/AdminProtectedRoute.js
function AdminProtectedRoute({ children }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      navigate('/login')
      return
    }

    const checkAuth = async () => {
      try {
        const currentUserResponse = await getCurrentAdmin()

          if (currentUserResponse.data.message === "Permission Not Granted for this request") {

        //   setLoading(false)
          alert('Not allowed to access Admin pages.')
          navigate("/")
          return;   
        }

        if (currentUserResponse.data.success === false) {

          localStorage.removeItem('token')
          setLoading(false)
          navigate('/login')
          alert('session expired')
          return;
        }

        dispatch(
          setUser({
            user: currentUserResponse.data.userData, // or .data.userData -- depends on getCurrentUser's return shape
          })
        )
      } catch (error) {
        localStorage.removeItem('token')
        navigate('/login')
        alert('session expired')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [token, navigate])


  if (loading) {
    return <div>Loading...</div> // swap for a spinner/skeleton if you have one
  }
  return children
}
```

**Login and Register.** Both save the token, fetch the current user, dispatch it, clear the inputs and redirect by role. They branch on the server's `message` string, not the status code:

```js
// Frontend/src/pages/Login.js
      if (loginResponse.data.message === "User not found") {
        alert("User not found")
        navigate("/register")
        return
      }
```

```js
      if(currentUserResponse.data.userData.isAdmin){navigate('/admin'); return}

      navigate("/");
```

Pages that a logged-in user shouldn't see check for a token on mount:

```js
// Frontend/src/pages/Register.js
  // If already logged in, go to Home
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/");
      return;
    }
  }, [navigate]);
```

### 3.5 Naming components, props and handlers

| Thing | Pattern | Examples |
|---|---|---|
| Components | PascalCase `<Entity>` + `List` / `Form` / `Page`, or `<Role>` + `Home` / `ProtectedRoute` | `MoviesList`, `MoviesForm`, `TheatreAdminList`, `AdminHome`, `BookingPage` |
| Event handlers | `handle<Action>` | `handleLogin`, `handleDelete`, `handleEditClick`, `handleUpdate`, `handleToggleStatus`, `handleSeatClick`, `handleSubmit` |
| Callback props | `on<Event>` | `onClose`, `onAddSuccess`, `onUpdateSuccess`, `onShowAdded` |
| Data props | nouns | `initialData`, `preselectedTheatre`, `refreshShows`, `visible`, `children` |
| Fetch functions | `fetch<Thing>`, defined inside the component | `fetchMovies`, `fetchTheatres`, `fetchShowDetails`, `fetchDropdownData` |
| Modal visibility state | `show<Thing>` | `showForm`, `showShowsForm` |
| Selection state | `selected<Thing>` | `selectedMovie`, `selectedTheatreForShow`, `selectedSeats` |
| Booleans | `is<State>` | `isEditMode`, `isUpcoming`, `isActive` |
| Guard's async function | `checkAuth` | `checkAuth()` |

---

## 4. General conventions

### 4.1 Comments

Comments are moderately dense: short and practical, saying *what* a block does. There are no JSDoc blocks. These are the kinds I use.

**Backend section banners.** Most routes have a three-line `=` banner above them, with two blank lines before it:

```js
// ========================
// Get All Theatres
// ========================
```

Routes without a banner get a one-line lowercase comment instead:

```js
// get show by ID
```

**Frontend section banners.** A ruler line with the section name in it:

```js
    // ─── Columns ─────────────────────────────────────────────────────────────
```

```js
    // ── seat helpers ──────────────────────────────────────────────────────────
```

Regions inside JSX get labels:

```js
            {/* Toolbar */}
```

**Step comments** in Title Case inside longer handlers:

```js
        // Hash Password
        const salt = await bcrypt.genSalt(10);
```

**Trailing comments** that explain why, sometimes with an arrow:

```js
            owner: req.user._id,    // taken from auth middleware, not from req.body
```

```js
        const theatres = await Theatre.find({ owner: req.user._id })  // ← filter by logged in user
            .populate("owner", "-password")                            // ← exclude password
```

```js
        if (bookedSeats.includes(seatNumber)) return // cant select booked seat
```

```js
            // update locally without refetching
```

**State-shape comments** next to `useState`:

```js
    const [mode, setMode] = useState(null) // null | "edit" | "delete" | "add"
```

**Planning comments.** I sometimes write out what a file should do before writing the code, and leave that note at the top:

```js
//  create an authmiddleware which checks, 

// 1st check: if the jwt token is matching with the key in authKey in teh .env file.
// 2nd check: If the JWT is not expired. 
```

**Old debug lines and old code** are commented out, not deleted:

```js
const PORT = process.env.PORT;
// console.log(process.env.PORT)
```

```js
// // create a axios instance here, with default method post and a bearer token fetching from localStorage.get("token")import axios from "axios";
// import axios from "axios"
```

### 4.2 Variable and function naming

- camelCase for variables and functions, PascalCase for models and components, and UPPER_CASE for module-level constants:

```js
const COLUMNS = 12
```

- Local variables get descriptive names: `existingUser`, `hashedPassword`, `isPasswordCorrect`, `jwtToken`, `movieIdsWithShows`, `moviesUpcoming`.
- An API result is `response`, or `<action>Response` when there are several: `loginResponse`, `registerResponse`, `currentUserResponse`.
- A single arrow-function parameter always has parentheses: `(movie) =>`, `(prev) =>`. One-letter names are fine in one-line callbacks: `(t) => t._id`, `(s) => s._id !== id`, `(g) =>`.
- An unused parameter is `_`: `render: (_, record) => {`.
- Express handlers always take `(req, res)` or `(req, res, next)`. The catch variable is `error` (`err` in the Stripe code).
- A request body is built in a `payload` variable before the API call:

```js
      const payload = {
        userId: email,
        password: password,
      };
```

### 4.3 Formatting

There's no Prettier config and no ESLint beyond CRA's default, so formatting is done by hand. The table shows what most files do and where files differ.

| | Default (most files) | Also seen |
|---|---|---|
| Quotes | double `"` | single `'` in the route guards, `BookingPage.js`, `Bookings.js`, and some `server.js` requires |
| Semicolons | **none**: CRUD routers, models, List/Form components, CRUD API files | used in `userRouter.js`, the middlewares, `userModel.js`, `MongoDBCon.js`, `Login.js`, `Register.js`, `userApi.js`, `store/` |
| Indent | **4 spaces** | 2 spaces in `App.js`, `Login.js`, `Register.js`, the route guards, `store/`, `userModel.js` |
| Trailing commas | yes, in multiline objects and arrays | sometimes left off in `userRouter.js` |
| Line length | no limit; one-line signatures and destructures run to about 110 characters | |
| Strings | template literals for any interpolation, including URLs with ids | |
| Modules | CommonJS in `Backend/`, ES modules in `Frontend/` | |
| Import extensions | omitted | `.js` in the `App.js` imports and the `MongoDBCon.js` require |

**For new code, use the default column: double quotes, no semicolons, 4-space indent.**

Other spacing habits:

- Two blank lines between route blocks.
- A long right-hand side moves to its own line after `=`:

```js
      const currentUserResponse =
        await getCurrentUser();
```

- A blank line between the end of a `try` body and `} catch`:

```js
            data: newMovie,
        })

    } catch (error) {
```

### 4.4 Error handling and logging

- **Backend.** Each handler has one `try/catch` that returns 500 with `error: error.message`. There is no global error middleware, no custom error classes and no `next(err)`.
- **Frontend fetches.** `try / catch / finally`: `setLoading(true)` at the top of `try`, `message.error("Failed to …")` in `catch`, and `setLoading(false)` in `finally` (see `fetchMovies` in §3.1).
- **Frontend forms.** antd validation errors are ignored because antd already shows them inline. Any other error shows the server's message, with a fallback:

```js
            if (error?.errorFields) return
            message.error(
                error.response?.data?.message || "Something went wrong"
            )
```

- **User feedback.** Data pages use antd `message.success` / `message.error`. The auth pages and route guards use plain `alert()`.
- **Missing populated fields** are handled with optional chaining and a fallback: `owner?.userId || "N/A"`, `booking.show?.movie?.name`.
- **Clearing inputs.** Login and Register reset their inputs after a submit or an error: `setEmail("")`, `setPassword("")`.
- **Logging** is `console.log` only, with no logging library. Log lines are short status strings (`"Database connected."`, `"User Logged In"`, `"Reached create checkout session"`), or a whole object while debugging (`console.log(response)`). When a log is no longer needed it's commented out, not deleted.

### 4.5 Idiosyncrasies (do these so the code feels like mine)

1. **RPC-style route names:** `/getAll`, `/add`, `/update/:id`, `/delete/:id`, `/getById/:id`, never `GET /movies/:id`. The Stripe routes are the only kebab-case ones (`/create-checkout-session`, `/payment-confirmation-webhook`).
2. **A separate endpoint per role** instead of one endpoint that checks the role: `getCurrentUser` / `getCurrentAdmin` / `getCurrentProfile`, and `getAll` / `getAllForAdmin`.
3. **Copy and adapt rather than abstract.** The three route guards are near-identical, and so are the List/Form pairs. There are no shared hooks or HOCs. A new entity starts as a copy of an existing List/Form pair with the names changed.
4. **Message strings are part of the API contract.** The frontend checks `response.data.message === "..."`.
5. **A mode toggle drives table actions.** Toolbar buttons flip a `mode` state, and the Action column renders Edit buttons, delete confirms or nothing depending on that mode.
6. **The server sets ownership and defaults** (`owner: req.user._id`, `isActive: false`), even when the schema already has a default.
7. **`response.data.data`** appears everywhere on the frontend: axios's `data`, then my envelope's `data`.
8. **Side-effect requires come with a comment** explaining them (`require("./config/MongoDBCon.js")`).
9. **Local state is patched after a mutation** instead of refetching.

---

## 5. Recipe: adding a new entity

Following the conventions above, a new entity `Widget` means:

1. `Backend/model/widgetsModel.js`: a `widgetSchema` with object-form fields and `{ timestamps: true }`, exporting `Widget`.
2. `Backend/Routers/widgetsRouter.js`: bannered `/getAll`, `/add`, `/update/:id` and `/delete/:id` handlers in the §2.4 shape, with the right middlewares inline.
3. `Backend/server.js`: `const widgetsRouter = require("./Routers/widgetsRouter")` and `app.use("/widgets", widgetsRouter)` after `express.json()`.
4. `Frontend/src/apiCall/widgetsApi.js`: `getAllWidgets`, `addWidget(payload)`, `updateWidget(id, payload)`, `deleteWidget(id)`, each returning `response`.
5. `Frontend/src/pages/Widgets/WidgetsList.js` and `WidgetsForm.js`: copied from the Movies pair, with the §3.1 prop contract.
6. Add `<WidgetsList />` as a new `TabPane` in the right role's home page (`AdminHome`, `Profile` or `Home`).
