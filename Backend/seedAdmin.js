// one-off: npm run seed:admin
// creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env.
// safe to re-run — an existing account with that email is promoted to admin instead.

const dotenv = require("dotenv")

dotenv.config()

const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const db = require("./config/MongoDBCon.js") // side-effect require: connects as soon as it loads
const User = require("./model/userModel")

const seedAdmin = async () => {
    try {
        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_NAME) {
            console.log("Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME in .env first.")
            process.exit(1)
        }

        const email = process.env.ADMIN_EMAIL.trim().toLowerCase()

        // Hash Password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt)

        const existingUser = await User.findOne({ email })

        if (existingUser) {
            await User.findByIdAndUpdate(existingUser._id, {
                role: "admin",
                name: process.env.ADMIN_NAME,
                password: hashedPassword,
            })
            console.log(`Existing user ${email} promoted to admin.`)
        } else {
            await User.create({
                name: process.env.ADMIN_NAME,
                email,
                password: hashedPassword,
                role: "admin",
                isEmailVerified: true,
            })
            console.log(`Admin ${email} created.`)
        }

        await mongoose.connection.close()
        process.exit(0)

    } catch (error) {
        console.log("Admin seed failed:", error.message)
        process.exit(1)
    }
}

seedAdmin()
