// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
async function main() {
  const WhitelistingModule = await ethers.getContractFactory("WhitelistingModule");

  // Start deployment, returning a promise that resolves to a contract object
  const contract = await WhitelistingModule.deploy("0xc1407095B6C4b0Ae6DE2A0C860F3367376557D6C"); 
  await contract.deployed();  
  console.log("Contract deployed to address: ", contract.address);
  console.log("Transaction hash: ", contract.deployTransaction.hash)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
