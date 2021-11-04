async function main01() {

  const hre = require("hardhat");
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0xc2cd962e53afcdf574b409599a24724efbadb3d4"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [OWNER_ADDR]);
  const signer = await hre.ethers.getSigner(OWNER_ADDR);

  console.log('signer.address', signer.address)

  // Deploy the Rewards Distributor
  const RewardsDistributor = await hre.ethers.getContractFactory("FraxGaugeFXSRewardsDistributor", signer);
  console.log('RewardsDistributor.signer', RewardsDistributor.signer.address)//, signer)

  const rewardsDistributor = await RewardsDistributor.deploy(
    signer.address,
    OWNER_ADDR,
    iqAddress,
    GAUGE_CONTROLLER_ADDR
  );
  await rewardsDistributor.deployed();
  console.log("rewardsDistributor deployed to:", rewardsDistributor.address);

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);

}

main01()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
