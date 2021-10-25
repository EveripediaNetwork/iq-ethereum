async function main0001() {

  const hre = require("hardhat");
  const hiiqABI = require('../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const gaugeABI = require('../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0x9786f6d29e1c9129808bbd3d1abc475e8324285d"
  const REWARDS_DIST_ADDR = "0xc1259131422c55fd7f4d403592d8abf5d132d32e"

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

  const lpTokenAddress = "0xd6c783b257e662ca949b441a4fcb08a53fc49914";
  const stakingRewardsMultiGauge = await StakingRewardsMultiGauge.deploy(
    lpTokenAddress,
    REWARDS_DIST_ADDR,
    ['IQ'],
    [iqAddress],
    [OWNER_ADDR],
    [11574074074074,11574074074074],
    [ '0x0000000000000000000000000000000000000000']
  );
  await stakingRewardsMultiGauge.deployed();
  console.log("stakingRewardsMultiGauge deployed to:", stakingRewardsMultiGauge.address)

  // console.log('add gauge')
  // await gauge.add_gauge(stakingRewardsMultiGauge.address, 0, 100);
  // console.log('added gauge')

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);

}

main0001()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
