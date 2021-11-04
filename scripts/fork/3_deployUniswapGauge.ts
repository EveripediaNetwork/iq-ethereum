async function deployUniswapGauge() {

  const hre = require("hardhat");
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const IqFraxlpTokenAddress = "0xd6c783b257e662ca949b441a4fcb08a53fc49914";
  const IqEthLpTokenAddress = "0xef9f994a74cb6ef21c38b13553caa2e3e15f69d0";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0xc2cd962e53afcdf574b409599a24724efbadb3d4"
  const REWARDS_DIST_ADDR = "0x839055d0fbee415e665dc500dd2af292c0692305"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [OWNER_ADDR]);
  const signer = await hre.ethers.getSigner(OWNER_ADDR);

  console.log('signer.address', signer.address)

  const gauge = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

  // Deploy the Uniswap Gauge
  const StakingRewardsMultiGauge = await hre.ethers.getContractFactory("StakingRewardsMultiGauge", signer);
  console.log('StakingRewardsMultiGauge.signer', StakingRewardsMultiGauge.signer.address)//, signer)

  const stakingRewardsMultiGauge = await StakingRewardsMultiGauge.deploy(
    IqEthLpTokenAddress,
    REWARDS_DIST_ADDR,
    ['IQ'],
    [iqAddress],
    [OWNER_ADDR],
    [11574074074074, 11574074074074],
    ['0x0000000000000000000000000000000000000000']
  );
  await stakingRewardsMultiGauge.deployed();
  console.log("stakingRewardsMultiGauge deployed to:", stakingRewardsMultiGauge.address)

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);

}

deployUniswapGauge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
