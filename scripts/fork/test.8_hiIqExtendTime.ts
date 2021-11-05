import {runwithImpersonation, contractAddress} from "./util_functions";

async function extendHiIqLockTime() {
  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;

  const hiiqAddress = contractAddress("HIIQ");
  const IQOwner = contractAddress("OWNER");
  const IQERC20MainnetAddress = contractAddress("IQ");

  const toAddress = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  const secondsInADay = 24 * 60 * 60;
  const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 360;

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);

  await runwithImpersonation(toAddress, provider, hre, async (signer: any) => {

    const hiiqContract = new hre.ethers.Contract(hiiqAddress, hiiqABI, signer);

    console.log('before toAddress HiIQ balance: ', hre.ethers.utils.formatUnits(
      await hiiqContract['balanceOf(address)'](toAddress),
      18
    ))

    console.log('checkpoint the hiiqContract')
    const estGas1 = await hiiqContract.estimateGas.checkpoint();
    await (await hiiqContract.checkpoint({gasLimit: estGas1})).wait();

    console.log('extend lock')
    const gasCost2 = await hiiqContract.estimateGas.increase_unlock_time(lockTime);
    await (await hiiqContract.increase_unlock_time(lockTime, {gasLimit: gasCost2})).wait();

    console.log('checkpoint the hiiqContract')
    const estGas3 = await hiiqContract.estimateGas.checkpoint();
    await (await hiiqContract.checkpoint({gasLimit: estGas3})).wait();

    console.log('after toAddress HiIQ balance: ', hre.ethers.utils.formatUnits(
      await hiiqContract['balanceOf(address)'](toAddress),
      18
    ))
  });
}

extendHiIqLockTime()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
