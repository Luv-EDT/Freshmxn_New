const express = require("express")
const Coupon = require("../model/couponsModel")
const authMiddleware = require("../middlewares/authMiddleware")
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware")

const router = express.Router()


// ========================
// Get All Coupons
// ========================

router.get("/getAll", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            message: "Coupons fetched successfully",
            data: coupons,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.message,
        })
    }
})


// ========================
// Add Coupon
// ========================

router.post("/add", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { code, discountPct, isActive, expiresAt, usageLimit } = req.body

        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a coupon code"
            })
        }

        const discountNumber = Number(discountPct)

        if (!Number.isFinite(discountNumber) || discountNumber < 0 || discountNumber > 100) {
            return res.status(400).json({
                success: false,
                message: "Discount must be between 0 and 100"
            })
        }

        const normalizedCode = code.trim().toUpperCase()

        const existingCoupon = await Coupon.findOne({ code: normalizedCode })

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Coupon already exists"
            })
        }

        const newCoupon = await Coupon.create({
            code: normalizedCode,
            discountPct: discountNumber,
            isActive: isActive !== false,
            expiresAt: expiresAt || undefined,
            usageLimit: Number(usageLimit) || 0,
            timesUsed: 0,           // always starts unused
        })

        return res.status(201).json({
            success: true,
            message: "Coupon added successfully",
            data: newCoupon,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to add coupon",
            error: error.message,
        })
    }
})


// ========================
// Update Coupon
// ========================

router.put("/update/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params

        const updates = { ...req.body }
        delete updates.timesUsed   // only a grant changes this

        if (updates.code !== undefined) {
            updates.code = String(updates.code).trim().toUpperCase()
        }

        if (updates.discountPct !== undefined) {
            const discountNumber = Number(updates.discountPct)

            if (!Number.isFinite(discountNumber) || discountNumber < 0 || discountNumber > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Discount must be between 0 and 100"
                })
            }
            updates.discountPct = discountNumber
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            id,
            updates,
            { returnDocument: "after" }  // returns the updated document, not the old one
        )

        if (!updatedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            })
        }

        return res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: updatedCoupon,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update coupon",
            error: error.message,
        })
    }
})


// ========================
// Delete Coupon
// ========================

router.delete("/delete/:id", authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params

        const deletedCoupon = await Coupon.findByIdAndDelete(id)

        if (!deletedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            })
        }

        return res.status(200).json({
            success: true,
            message: "Coupon deleted successfully",
            data: deletedCoupon,
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete coupon",
            error: error.message,
        })
    }
})

module.exports = router
