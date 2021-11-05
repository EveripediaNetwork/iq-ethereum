import {runwithImpersonation, contractAddress, forkEthFaucet} from "./util_functions";

async function deployGaugeControllerContract() {

  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const iqAddress = contractAddress("IQ");
  const hiiqAddress = contractAddress("HIIQ");
  const OWNER_ADDR = contractAddress("OWNER");

 await forkEthFaucet(hre, OWNER_ADDR, "50.0")

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);
  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address)
    console.log('signer bal: ', hre.ethers.utils.formatEther(await hre.ethers.provider.getBalance(signer.address)))

    // Deploy the Gauge Contract
    const GAUGE = await hre.ethers.getContractFactory(
      "HIIQGaugeController", signer
    );
    console.log('GAUGE.signer', GAUGE.signer.address)

    const gauge = await GAUGE.deploy(iqAddress, hiiqAddress);
    const deployed = await gauge.deployed();

    console.log("gaugecontroller deployed to:", gauge.address);
    console.log("deployed", deployed)
  });
}

deployGaugeControllerContract()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
