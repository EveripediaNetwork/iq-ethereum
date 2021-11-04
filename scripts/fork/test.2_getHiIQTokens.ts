async function runwithImpersonation(userAddress: any, provider: any, hre: any, func: any) {

  try {
    await provider.send("hardhat_impersonateAccount", [userAddress]);
    const signer = await hre.ethers.getSigner(userAddress);
    await func(signer);
  } finally {
    await provider.send("hardhat_stopImpersonatingAccount", [userAddress]);
  }
}

async function getHiIQTokens() {
  const hre = require("hardhat");

  const hiiqABI = require('../../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
  const hiiqAddress = "0x1bf5457ecaa14ff63cc89efd560e251e814e16ba";

  const IQOwner = '0xaca39b187352d9805deced6e73a3d72abf86e7a0';
  const IQERC20MainnetAddress = '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9';
  const IQERC20ABI = require('../../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;

  const toAddress = "0xAe65930180ef4d86dbD1844275433E9e1d6311ED";

  const secondsInADay = 24 * 60 * 60;
  const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 60;

  // impersonate owner for hardhat fork
  const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");

  await runwithImpersonation(IQOwner, provider, hre, async (signer: any) => {
    const iqContract = new hre.ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signer);

    console.log('from IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(IQOwner),
      18
    ))

    const howManyTokens = hre.ethers.BigNumber.from(hre.ethers.utils.parseEther('1000000'));

    const tx = await iqContract.transfer(
      toAddress,
      howManyTokens
    );

    await tx.wait()

    console.log('toAddress IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(toAddress),
      18
    ))
  });

  await runwithImpersonation(toAddress, provider, hre, async (signer: any) => {

    console.log('1')
    const iqContract = new hre.ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signer);
    const hiiqContract = new hre.ethers.Contract(hiiqAddress, hiiqABI, signer);

    console.log('toAddress IQ balance: ', hre.ethers.utils.formatUnits(
      await iqContract.balanceOf(toAddress),
      18
    ))

    console.log('2')
    const lockedAmount = hre.ethers.BigNumber.from(hre.ethers.utils.parseEther('100000')); // 100K

    // fund the account
    let hhSigner0 = (await hre.ethers.getSigners())[0]
    const txFunding = await hhSigner0.sendTransaction({
      to: toAddress,
      value: hre.ethers.utils.parseEther("20.0"), // Sends exactly 1.0 ether
    });

    txFunding.wait()

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
