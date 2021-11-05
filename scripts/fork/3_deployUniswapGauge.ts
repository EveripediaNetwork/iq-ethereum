import {runwithImpersonation, contractAddress} from "./util_functions";

async function deployUniswapGauge() {

  const hre = require("hardhat");
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  const iqAddress = contractAddress("IQ");
  const hiiqAddress = contractAddress("HIIQ");
  const OWNER_ADDR = contractAddress("OWNER");

  const IqFraxlpTokenAddress = contractAddress("UNISWAP_LP_IQ_FRAX");
  const IqEthLpTokenAddress = contractAddress("UNISWAP_LP_IQ_ETH");

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress("GAUGE_CONTROLLER");
  const REWARDS_DIST_ADDR = contractAddress("GAUGE_REWARDS_DISTRIBUTOR");

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
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

  });
}

deployUniswapGauge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
