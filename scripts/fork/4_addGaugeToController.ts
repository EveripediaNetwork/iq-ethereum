async function addGaugeToController() {

  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const iqAddress = "0x579cea1889991f68acc35ff5c3dd0621ff29b0c9";

  const OWNER_ADDR = "0xaca39b187352d9805deced6e73a3d72abf86e7a0";

  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController').abi;

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = "0xc2cd962e53afcdf574b409599a24724efbadb3d4"
  const REWARDS_DIST_ADDR = "0x839055d0fbee415e665dc500dd2af292c0692305"
  const UNI_GAUGE_FRAX_IQ_ADDR = "0x65237882dd5fbb85d865eff3be26ac4e67da87aa"
  const UNI_GAUGE_ETH_IQ_ADDR = "0x2c477a64d2cb9f340e1f72ff76399432559e2199"

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );
  await provider.send("hardhat_impersonateAccount", [OWNER_ADDR]);
  const signer = await hre.ethers.getSigner(OWNER_ADDR);

  console.log('signer.address', signer.address)

  const gauge = new hre.ethers.Contract(GAUGE_CONTROLLER_ADDR, gaugeABI, signer);

  // console.log('add gauge type')
  // const estGas1 = await gauge.estimateGas.add_type(0, 100);
  // await gauge.add_type(0, 100, {gasLimit: estGas1});
  //
  // console.log('add frax iq gauge')
  // const estGas2 = await gauge.estimateGas.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100);
  // await gauge.add_gauge(UNI_GAUGE_FRAX_IQ_ADDR, 0, 100, {gasLimit: estGas2});
  // console.log('added frax iq gauge')

  console.log('change frax iq gauge weight')
  const estGas3 = await gauge.estimateGas.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50);
  await gauge.change_gauge_weight(UNI_GAUGE_FRAX_IQ_ADDR, 50, {gasLimit: estGas3});
  console.log('changed frax iq gauge weight')

  console.log('add eth iq gauge')
  const estGas4 = await gauge.estimateGas.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50);
  await gauge.add_gauge(UNI_GAUGE_ETH_IQ_ADDR, 0, 50, {gasLimit: estGas4});
  console.log('added eth iq gauge')

  await provider.send("hardhat_stopImpersonatingAccount", [OWNER_ADDR]);

}

addGaugeToController()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
