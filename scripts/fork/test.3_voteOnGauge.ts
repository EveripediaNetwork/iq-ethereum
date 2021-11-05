import {runwithImpersonation, contractAddress} from "./util_functions";

async function voteOnGauges() {

  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

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

    const voteWeightBps = 1000; // 10%
    const estGas = await gaugeController.estimateGas.vote_for_gauge_weights(UNI_GAUGE_ETH_IQ_ADDR, voteWeightBps);
    await gaugeController.vote_for_gauge_weights(UNI_GAUGE_ETH_IQ_ADDR, voteWeightBps, {gasLimit: estGas});

  });
}

voteOnGauges()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
