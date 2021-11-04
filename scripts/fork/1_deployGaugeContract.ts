async function main0() {

  const hre = require("hardhat");
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  // fund the owner account
  let hhSigner = (await hre.ethers.getSigners())[0]
  console.log('hhSigner', hhSigner.address)

  const txFunding = await hhSigner.sendTransaction({
    to: OWNER_ADDR,
    value: hre.ethers.utils.parseEther("50.0"), // Sends exactly 1.0 ether
  });

  txFunding.wait()

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [OWNER_ADDR]);
  const signer = await hre.ethers.getSigner(OWNER_ADDR);

  // const signer = (await hre.ethers.getSigners())[0];

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

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);
}

main0()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
