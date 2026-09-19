const mongoose = require("mongoose");
const dns = require("dns");

// Some Windows machines hand Node a dead 127.0.0.1 DNS server, and the mongodb+srv:// lookup then fails
// with "querySrv ECONNREFUSED". Only in that case, fall back to public DNS. Does nothing on a normal setup.
const isLoopbackOnly = dns.getServers().every((server) => server.startsWith("127.") || server === "::1");

if (process.platform === "win32" && isLoopbackOnly) {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

// console.log(process.env.DB_URI)
mongoose.connect(process.env.DB_URI);

const connection = mongoose.connection;

connection.on("connected", () => {
    console.log("Database connected.");
});

connection.on("error", (err) => {
    console.log("MongoDB connection error:", err);
});
