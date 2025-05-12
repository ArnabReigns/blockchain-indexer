require("dotenv").config();
const axios = require("axios");
const { ethers } = require("ethers");
const mongoose = require("mongoose");
const nftAbi = require("./abi/NFT.json");
const marketplaceAbi = require("./abi/Marketplace.json");
const Token = require("./models/token");
const Listing = require("./models/listings");

async function main() {
	try {
		await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
		console.log("✅ Connected to MongoDB");

		const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
		const nft = new ethers.Contract(process.env.NFT_CONTRACT_ADDRESS, nftAbi, provider);
		const marketplace = new ethers.Contract(process.env.MARKETPLACE_ADDRESS, marketplaceAbi, provider);

		console.log("🎧 Listening for smart contract events...");

		nft.on("Transfer", async (from, to, tokenId) => {
			console.log(`Transfer Event: From: ${from} To: ${to} Token ID: ${tokenId}`);
			try {
				let token = await Token.findOne({ tokenId, nftContract: process.env.NFT_CONTRACT_ADDRESS });
				if (token) {
					token.owner = to;
					token.history.push({ from, to, date: new Date() });
					await token.save();
					console.log(`Token ${tokenId} ownership updated in MongoDB.`);
				} else {
					const newToken = new Token({
						tokenId,
						nftContract: process.env.NFT_CONTRACT_ADDRESS,
						owner: to,
						history: [{ from, to, date: new Date() }],
						creator: from === ethers.ZeroAddress ? to : undefined,
						mintedAt: from === ethers.ZeroAddress ? Date.now() : undefined,
					});
					try {
						const tokenUri = await nft.tokenURI(tokenId);
						newToken.metadataUri = tokenUri;
						const metadataUrl = tokenUri.startsWith("ipfs://") ? tokenUri.replace("ipfs://", "https://ipfs.io/ipfs/") : tokenUri;
						const response = await axios.get(metadataUrl);
						newToken.metadata = response.data;
					} catch (metaErr) {
						console.warn(`⚠ Could not fetch metadata for Token ${tokenId}:`, metaErr.message);
					}
					await newToken.save();
					console.log(`Token ${tokenId} saved to MongoDB.`);
				}
			} catch (err) {
				console.error("Error saving token to MongoDB:", err);
			}
		});

		marketplace.on("ItemListed", async (listingId, nftContract, tokenId, seller, price) => {
			console.log("Item Listed:", { listingId: listingId.toString(), nftContract, tokenId: tokenId.toString(), seller, price: price.toString() });

			try {
				let listing = await Listing.findOne({ listingId, nftContract });
				if (!listing) {
					const newListing = new Listing({ listingId, nftContract, tokenId, seller, price, status: "active" });
					await newListing.save();
					console.log(`Listing ${listingId} saved to MongoDB.`);
				}

				let token = await Token.findOne({ tokenId, nftContract });
				if (token) {
					token.listingId = listingId;
					token.seller = seller;
					token.price = price;
					await token.save();
					console.log(`Token ${tokenId} updated for listing ${listingId}.`);
				}
			} catch (err) {
				console.error("Error saving listing to MongoDB:", err);
			}
		});

		marketplace.on("ItemSold", async (listingId, buyer) => {
			console.log("Item Sold:", { listingId: listingId.toString(), buyer });
			try {
				let listing = await Listing.findOne({ listingId });
				if (listing) {
					listing.status = "sold";
					await listing.save();
					console.log(`Listing ${listingId} saved to MongoDB.`);
				}
				let token = await Token.findOne({ listingId });
				if (token) {
					token.listingId = null;
					token.seller = null;
					token.price = null;
					await token.save();
					console.log(`Token ${token.tokenId} updated for listing ${listingId}.`);
				}

			} catch (err) {
				console.error("Error saving listing to MongoDB:", err);
			}
		});

		marketplace.on("ListingCancelled", async (listingId) => {
			console.log("Listing Cancelled:", { listingId: listingId.toString() });
			try {
				let listing = await Listing.findOne({ listingId });
				if (listing) {
					listing.status = "cancelled";
					await listing.save();
					console.log(`Listing ${listingId} saved to MongoDB.`);
				} else {
					console.log('Listing not found');
				}


				let token = await Token.findOne({ listingId });
				if (token) {
					token.listingId = null;
					token.seller = null;
					token.price = null;
					await token.save();
					console.log(`Token ${token.tokenId} updated for listing ${listingId}.`);
				}
			} catch (err) {
				console.error("Error saving listing to MongoDB:", err);
			}
		});

	} catch (error) {
		console.error("Error in the main function:", error);
	}
}

main().catch(error => console.error("Error in the event listener setup:", error));

