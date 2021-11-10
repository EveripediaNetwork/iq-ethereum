import {runwithImpersonation, contractAddress, forkEthFaucet} from "./util_functions";

async function getHiIQTokens() {
  const hre = require("hardhat");

  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;
  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

  const hiiqAddress = contractAddress("HIIQ");
  const IQOwner = contractAddress("OWNER");
  const IQERC20MainnetAddress = contractAddress("IQ");

  const toAddress = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED"; // "0xfed53eB388c6FF138aA97D1F9d24F8fd4efC9C73" // "0x208a110dDc5732f406B17E89bD92E06Db21c8CA1"

  const secondsInADay = 24 * 60 * 60;
  const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 60;

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider(hre.network.config.url);

  // fund the account
  await forkEthFaucet(hre, toAddress, "20.0");

  await runwithImpersonation(IQOwner, provider, hre, async (signer: any) => {
    const iqContract = new hre.ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signer);

    console.log('from IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(IQOwner),
      18
    ))

    const howManyTokens = hre.ethers.BigNumber.from(hre.ethers.utils.parseEther('1000000'));

    const estGas = await iqContract.estimateGas.mint(toAddress, howManyTokens);
    const tx = await iqContract.mint(toAddress, howManyTokens, {gasLimit: estGas});

    // const tx = await iqContract.transfer(
    //   toAddress,
    //   howManyTokens
    // );

    await tx.wait()

    console.log('toAddress IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(toAddress),
      18
    ))
  });

  await runwithImpersonation(toAddress, provider, hre, async (signer: any) => {

    const iqContract = new hre.ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signer);
    const hiiqContract = new hre.ethers.Contract(hiiqAddress, hiiqABI, signer);

    console.log('toAddress IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(toAddress),
      18
    ))

    const lockedAmount = hre.ethers.BigNumber.from(hre.ethers.utils.parseEther('100000')); // 100K

    console.log('approve transfer for IQ')
    const gasCost1 = await iqContract.estimateGas.approve(hiiqAddress, lockedAmount);
    console.log('gasCost1', hre.ethers.utils.formatEther(gasCost1))
    await (await iqContract.approve(hiiqAddress, lockedAmount, {gasLimit: gasCost1})).wait();

    console.log('create lock, get hiIQ')
    const gasCost2 = await hiiqContract.estimateGas.create_lock(lockedAmount, lockTime);
    await (await hiiqContract.create_lock(lockedAmount, lockTime, {gasLimit: gasCost2})).wait();

    console.log('checkpoint the hiiqContract to init')
    const estGas3 = await hiiqContract.estimateGas.checkpoint();
    await (await hiiqContract.checkpoint({gasLimit: estGas3})).wait();

    console.log('toAddress HiIQ balance: ', hre.ethers.utils.formatUnits(
      await hiiqContract['balanceOf(address)'](toAddress),
      18
    ))
  });
}

getHiIQTokens()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
