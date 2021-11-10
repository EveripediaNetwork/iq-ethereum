import {runwithImpersonation, contractAddress} from "./util_functions";

async function voteOnGauges() {

  const hre = require("hardhat");

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const hiiqAddress = contractAddress("HIIQ");
  const iqAddress = contractAddress("IQ");
  const OWNER_ADDR = contractAddress("OWNER");

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress("GAUGE_CONTROLLER");
  const UNI_GAUGE_FRAX_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_FRAX");
  const UNI_GAUGE_ETH_IQ_ADDR = contractAddress("UNI_LP_GAUGE_IQ_ETH");

  const testUser = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
  await runwithImpersonation(testUser, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address)

    const gaugeController = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

    // let estGas;
    //
    // estGas = await gaugeController.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 5000);
    // await gaugeController.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, {gasLimit: estGas});
    //
    // estGas = await gaugeController.change_gauge_weight(UNI_GAUGE_ETH_IQ_ADDR, 5000);
    // await gaugeController.change_gauge_weight(UNI_GAUGE_ETH_IQ_ADDR, {gasLimit: estGas});


    const iq_frax_gauge_weight = await gaugeController.get_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, {gasLimit: 400000});
    const iq_eth_gauge_weight = await gaugeController.get_gauge_weight(UNI_GAUGE_ETH_IQ_ADDR, {gasLimit: 400000});
    const total_gauge_weight = await gaugeController.get_total_weight({gasLimit: 400000});

    console.log('weight iq frax',
      hre.ethers.utils.formatUnits(iq_frax_gauge_weight, 2))
    console.log('weight iq eth',
      hre.ethers.utils.formatUnits(iq_eth_gauge_weight, 2))
    console.log('total weight',
      hre.ethers.utils.formatUnits(total_gauge_weight, 2))
  });
}

voteOnGauges()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

