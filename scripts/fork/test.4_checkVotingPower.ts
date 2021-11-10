import {runwithImpersonation, contractAddress} from './util_functions';

async function checkVotingPower() {
  const hre = require('hardhat');

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const gaugeABI = require('../../artifacts/src/Curve/HIIQGaugeController.vy/HIIQGaugeController')
    .abi;

  const hiiqAddress = contractAddress('HIIQ');
  const iqAddress = contractAddress('IQ');
  const OWNER_ADDR = contractAddress('OWNER');

  const testUser = '0xAe65930180ef4d86dbD1844275433E9e1d6311ED';

  // hardhat fork addresses
  const GAUGE_CONTROLLER_ADDR = contractAddress('GAUGE_CONTROLLER');

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(
    hre.network.config.url
  );
  await runwithImpersonation(OWNER_ADDR, provider, hre, async (signer: any) => {
    console.log('signer.address', signer.address);

    const gaugeController = new hre.ethers.Contract(
      GAUGE_CONTROLLER_ADDR,
      gaugeABI,
      signer
    );
    console.log(
      'votingPower: ',
      hre.ethers.utils.formatUnits(
        await gaugeController.vote_user_power(testUser),
        2
      )
    );
  });
}

checkVotingPower()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
