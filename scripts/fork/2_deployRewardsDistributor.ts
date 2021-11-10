import {runwithImpersonation, contractAddress} from "./util_functions";

async function deployRewardsDistributor() {

  const hre = require("hardhat");

  const iqAddress = contractAddress("IQ");
  const OWNER_ADDR = contractAddress("OWNER");

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress("GAUGE_CONTROLLER");

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);

  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address)

    // Deploy the Rewards Distributor
    const RewardsDistributor = await hre.ethers.getContractFactory("GaugeRewardsDistributor", signer);
    console.log('RewardsDistributor.signer', RewardsDistributor.signer.address)

    const rewardsDistributor = await RewardsDistributor.deploy(
      signer.address,
      OWNER_ADDR,
      iqAddress,
      GAUGE_CONTROLLER_ADDR
    );
    await rewardsDistributor.deployed();
    console.log("rewardsDistributor deployed to:", rewardsDistributor.address);
  });
}

deployRewardsDistributor()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
