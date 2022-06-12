const { expect } = require("chai");


// util functions 
const toWei = (num) => ethers.utils.parseEther(num.toString());
const fromWei = (num) => ethers.utils.formatEther(num);


describe("NFTMarketplace", function() {
    let deployer, addr1, addr2, nft, marketplace;
    let URI = "Sample URI"

    this.beforeEach(async function() {
        // Obtaining the contract factory
        const NFT = await ethers.getContractFactory("NFT");
        const Marketplace = await ethers.getContractFactory("Marketplace");

        // Obtaining Signers (account)
        [deployer, addr1, addr2] = await ethers.getSigners();

        // Deploying the smart contracts
        nft = await NFT.deploy();
        marketplace = await Marketplace.deploy(1)
    });

    describe("Deployment", function() {
        it("Should track name and symbol of the nft collection", async function() {
            expect(await nft.name()).to.equal("DEVELOPERUCHE NFT");
            expect(await nft.symbol()).to.equal("DUC");

        });
        it("Should track feeAccount and feePercent of the nft collection", async function() {
            expect(await marketplace.feeAccount()).to.equal(deployer.address);
            expect(await marketplace.feePercent()).to.equal(1);
        });
    });

    describe("Minting NFTs", function() {
        it("Should track each minted NFT", async function(){
            // addr1 mints a nft
            await nft.connect(addr1).mint(URI);
            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(addr1.address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);

            // addr2 mint a nft
            await nft.connect(addr2).mint(URI);
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(addr2.address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);
        })
    })

    describe("Making marketplace items", function() {
        beforeEach(async function() {
            // addr1 mint nft
            await nft.connect(addr1).mint(URI);

            // adrr1 approving the marketplace to spend NFT from it wallet
            await nft.connect(addr1).setApprovalForAll(marketplace.address, true);
        });

        it("Should track newly created item, tranfer NFT from seller to marketplace and emit Offered event", async function() {
            await expect(marketplace.connect(addr1).makeItem(nft.address, 1, toWei(1)))
                .to.emit(marketplace, "Offered")
                .withArgs(
                    1,
                    nft.address,
                    1,
                    toWei(1),
                    addr1.address
                )

        // Checking if the new owner of the NFT is the Market place contract
        expect(await nft.ownerOf(1)).to.equal(marketplace.address);

        // Item count (number of Item in the market place to be equal to Zero)
        expect(await marketplace.itemCount()).to.equal(1);

        // get the item mapping the check if the data therein is correct
        const item = await marketplace.items(1);

        // declaring assertions
        expect(item.itemId).to.equal(1);
        expect(item.nft).to.equal(nft.address);
        expect(item.tokenId).to.equal(1);
        expect(item.price).to.equal(toWei(1));
        expect(item.sold).to.equal(false);
        })

        it("Should fail if price is set to Zero", async function() {
            await expect(marketplace.connect(addr1).makeItem(nft.address, 1, 0))
                .to.be.revertedWith("Price must be greater than zero");
        });
    });

    describe("Purchsing marketplace items", function() {
        let price = 2;
        let totalPriceWei;

        beforeEach(async function() {
            // addr1 mints an nft
            await nft.connect(addr1).mint(URI);

            // adrr1 approving the marketplace to spend NFT from it wallet
            await nft.connect(addr1).setApprovalForAll(marketplace.address, true);

            // addr1 make thier nft a marketplace item
            await marketplace.connect(addr1).makeItem(nft.address, 1, toWei(price));
        });

        it("Should update , pay seller, transfer NFT to buyer, charge fees and emit a Bought event", async function() {
            const sellerIntialEthBal = await addr1.getBalance();
            const feeAccountInitial = await deployer.getBalance();

            // fetch items totalPrice (market fees _ items)
            totalPriceWei = await marketplace.getTotalPrice(1);
            
            // addr2 purchase item
            await expect(marketplace.connect(addr2).purchaseItem(1, {value: totalPriceWei}))
                .to.emit(marketplace, "Bought")
                .withArgs(
                    1,
                    nft.address,
                    1, 
                    toWei(price),
                    addr1.address,
                    addr2.address
                );

            const sellerFinalEthBal = await addr1.getBalance();
            const feeAccountFinalEthBal = await deployer.getBalance();


            // Seller should recieve payment price for NFT sold
            expect(+fromWei(sellerFinalEthBal)).to.equal(+price + +fromWei(sellerIntialEthBal));
            
            // calculating the supposed fee
            const fee = (1 / 100) * price;

            // ASSERTION: feeAccount should receive fee
            expect(+fromWei(feeAccountFinalEthBal)).to.equal(+fee + +fromWei(feeAccountInitial));

            // ASSERTION: thebuyer should now own the NFT
            expect(await nft.ownerOf(1)).to.equal(addr2.address);

            // The sold parameter is now equal true
            expect((await marketplace.items(1)).sold).to.equal(true);
        })

        it("Should fail for invalid item ids, sold items and when not enogh ether is paid", async function() {
            // fails for invalid id
            await expect(marketplace.connect(addr2).purchaseItem(2, {value: totalPriceWei})).to.be.revertedWith("item doesn't exist");
            await expect(marketplace.connect(addr2).purchaseItem(0, {value: totalPriceWei})).to.be.revertedWith("item doesn't exist");
            await expect(marketplace.connect(addr2).purchaseItem(1, {value: toWei(price)})).to.be.revertedWith("not enough ether to cover item cost and market fee");
            await marketplace.connect(addr2).purchaseItem(1, {value: totalPriceWei});
            await expect(marketplace.connect(deployer).purchaseItem(1, { value: totalPriceWei})).to.be.revertedWith("item already sold");
        })
    })
})