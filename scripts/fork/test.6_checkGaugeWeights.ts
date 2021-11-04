async function voteOnGauges() {

  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const testUser = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0xc2cd962e53afcdf574b409599a24724efbadb3d4"
  const UNI_GAUGE_FRAX_IQ_ADDR = "0x65237882dd5fbb85d865eff3be26ac4e67da87aa"
  const UNI_GAUGE_ETH_IQ_ADDR = "0x2c477a64d2cb9f340e1f72ff76399432559e2199"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [testUser]);
  const signer = await hre.ethers.getSigner(testUser);

  console.log('signer.address', signer.address)

  const gaugeController = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

  const iq_frax_gauge_weight = await gaugeController.get_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, {gasLimit: 400000});
  const iq_eth_gauge_weight = await gaugeController.get_gauge_weight(UNI_GAUGE_ETH_IQ_ADDR, {gasLimit: 400000});
  const total_gauge_weight = await gaugeController.get_total_weight({gasLimit: 400000});

  console.log('weight iq frax',
    hre.ethers.utils.formatUnits(iq_frax_gauge_weight, 2))
  console.log('weight iq eth',
    hre.ethers.utils.formatUnits(iq_eth_gauge_weight, 2))
  console.log('total weight',
    hre.ethers.utils.formatUnits(total_gauge_weight, 2))

  await provider.send("hardhat_stopImpersonatingAccount", [testUser]);

}

voteOnGauges()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

