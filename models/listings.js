const mongoose = require("mongoose");

const ListingSchema = new mongoose.Schema(
    {
        listingId: {
            type: String,
            required: true,
            unique: true,
        },
        nftContract: {
            type: String,
            required: true,
        },
        tokenId: {
            type: String,
            required: true,
        },
        seller: {
            type: String,
            required: true,
        },
        price: {
            type: String, // Store price as a string to avoid precision issues
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "sold", "cancelled"],
            default: "active",
        },
    },
    {
        timestamps: true, // automatically manage createdAt and updatedAt fields
    }
);

const Listing = mongoose.model("Listing", ListingSchema);

module.exports = Listing;
