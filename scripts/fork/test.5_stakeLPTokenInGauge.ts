async function stakeLPTokenInGauge() {

  const hre = require("hardhat");

  const uniswapGaugeABI = require('../../artifacts/src/Curve/StakingRewardsMultiGauge.sol/StakingRewardsMultiGauge').abi;

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const testUser = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0xc2cd962e53afcdf574b409599a24724efbadb3d4"
  const REWARDS_DIST_ADDR = "0x839055d0fbee415e665dc500dd2af292c0692305"
  const UNI_GAUGE_ADDR = "0x65237882dd5fbb85d865eff3be26ac4e67da87aa"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [testUser]);
  const signer = await hre.ethers.getSigner(testUser);

  console.log('signer.address', signer.address)

  const howManyLPTokens = hre.ethers.BigNumber.from(hre.ethers.utils.parseEther('10'));

  const uniswapGauge = new hre.ethers.Contract(UNI_GAUGE_ADDR, uniswapGaugeABI, signer);
  await uniswapGauge.stakeLocked(howManyLPTokens, 94608000);

  await provider.send("hardhat_stopImpersonatingAccount", [testUser]);

}

stakeLPTokenInGauge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
