async function main0002() {

  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const testUser = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0x9786f6d29e1c9129808bbd3d1abc475e8324285d"
  const REWARDS_DIST_ADDR = "0xc1259131422c55fd7f4d403592d8abf5d132d32e"
  const UNI_GAUGE_ADDR = "0x3d7126d1ce1f71cb0111cf6ff683f55ba8474464"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [OWNER_ADDR]);
  const signer = await hre.ethers.getSigner(OWNER_ADDR);

  console.log('signer.address', signer.address)

  const gaugeController = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);
  console.log('votingPower: ',
    hre.ethers.utils.formatUnits(
      await gaugeController.vote_user_power(testUser), 2
    )
  );

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);

}

main0002()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
