import {runwithImpersonation, contractAddress} from "./util_functions";

async function addGaugeToController() {

  const hre = require("hardhat");
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;
  const rewardsDistABI = require('../../artifacts/src/Curve/GaugeRewardsDistributor.sol/GaugeRewardsDistributor').abi;

  const iqAddress = contractAddress("IQ");
  const hiiqAddress = contractAddress("HIIQ");
  const OWNER_ADDR = contractAddress("OWNER");

  const IqFraxlpTokenAddress = contractAddress("UNISWAP_LP_IQ_FRAX");
  const IqEthLpTokenAddress = contractAddress("UNISWAP_LP_IQ_ETH");

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress("GAUGE_CONTROLLER");
  const REWARDS_DIST_ADDR = contractAddress("GAUGE_REWARDS_DISTRIBUTOR");
  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_FRAX");
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_ETH");

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    let estGas;
    console.log('signer.address', signer.address)

    const rewardsDistributor = new hre.ethers.Contract(REWARDS_DIST_ADDR, rewardsDistABI, signer);
    const gauge = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

    console.log('add gauge type')
    estGas = await gauge.estimateGas.add_type(0, 100);
    await gauge.add_type(0, 100, {gasLimit: estGas});

    console.log('add frax iq gauge')
    estGas = await gauge.estimateGas.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100);
    await gauge.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100, {gasLimit: estGas});
    console.log('added frax iq gauge')

    console.log('change frax iq gauge weight')
    estGas = await gauge.estimateGas.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50);
    await gauge.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50, {gasLimit: estGas});
    console.log('changed frax iq gauge weight')

    console.log('add eth iq gauge')
    estGas = await gauge.estimateGas.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50);
    await gauge.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50, {gasLimit: estGas});
    console.log('added eth iq gauge')

    console.log('rewards dist whitelist frax iq gauge')
    estGas = await rewardsDistributor.estimateGas.setGaugeState(UNI_GAUGE_FRAX_IQ_ADDR, false, true);
    await rewardsDistributor.setGaugeState(UNI_GAUGE_FRAX_IQ_ADDR, false, true, {gasLimit: estGas});
    console.log('rewards dist whitelisted frax iq gauge')

    console.log('rewards dist whitelist eth iq gauge')
    estGas = await rewardsDistributor.estimateGas.setGaugeState(UNI_GAUGE_ETH_IQ_ADDR, false, true);
    await rewardsDistributor.setGaugeState(UNI_GAUGE_ETH_IQ_ADDR, false, true, {gasLimit: estGas});
    console.log('rewards dist whitelisted eth iq gauge')
  });
}

addGaugeToController()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
