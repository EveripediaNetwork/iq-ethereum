import {runwithImpersonation, contractAddress} from "./util_functions";

async function addGaugeToController() {

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
  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_FRAX");
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_ETH");

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address)

    const gauge = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

    console.log('add gauge type')
    const estGas1 = await gauge.estimateGas.add_type(0, 100);
    await gauge.add_type(0, 100, {gasLimit: estGas1});

    console.log('add frax iq gauge')
    const estGas2 = await gauge.estimateGas.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100);
    await gauge.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100, {gasLimit: estGas2});
    console.log('added frax iq gauge')

    console.log('change frax iq gauge weight')
    const estGas3 = await gauge.estimateGas.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50);
    await gauge.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50, {gasLimit: estGas3});
    console.log('changed frax iq gauge weight')

    console.log('add eth iq gauge')
    const estGas4 = await gauge.estimateGas.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50);
    await gauge.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50, {gasLimit: estGas4});
    console.log('added eth iq gauge')
  });
}

addGaugeToController()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
