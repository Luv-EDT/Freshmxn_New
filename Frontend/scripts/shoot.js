// Screenshot pages at phone and laptop width, for the design critique loop.
//
//   CHROME_PATH=<chrome binary> node scripts/shoot.js [route ...]
//
// Env:
//   CHROME_PATH  the Chrome/Chromium to drive — puppeteer-core never downloads one.
//                Cloud session: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
//                Owner's laptop: the Chrome already cached under C:\Users\DELL\.cache\puppeteer
//   BASE_URL     default http://localhost:5000 (Express serving Frontend/build)
//   OUT_DIR      default ./shots
//   TOKEN        optional JWT, put in localStorage so protected pages render
//   WIDTHS       default "360,1280"
//
// With no routes it shoots the public site.

const fs = require("fs")
const path = require("path")
const puppeteer = require("puppeteer-core")

const BASE_URL = process.env.BASE_URL || "http://localhost:5000"
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), "shots")
const WIDTHS = (process.env.WIDTHS || "360,1280").split(",").map(Number)
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/success-stories", "/mentor-waitlist", "/login", "/register"]

const main = async () => {
    if (!process.env.CHROME_PATH) {
        console.error("Set CHROME_PATH to a Chrome or Chromium binary")
        process.exit(1)
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] })

    for (const width of WIDTHS) {
        const page = await browser.newPage()
        await page.setViewport({ width, height: width < 700 ? 780 : 860 })

        if (process.env.TOKEN) {
            await page.goto(BASE_URL + "/login")
            await page.evaluate((token) => localStorage.setItem("token", token), process.env.TOKEN)
        }

        for (const route of routes) {
            await page.goto(BASE_URL + route, { waitUntil: "networkidle0" })
            await page.evaluate(() => document.fonts.ready)
            const name = `${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}_${width}.png`
            await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true })
            console.log("shot", name)
        }

        await page.close()
    }

    await browser.close()
}

main().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
