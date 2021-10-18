import {expect} from './chai-setup';
import {HiIQRewards, HIIQGaugeController, HIIQ, ERC20, IQERC20} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network
} from 'hardhat';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {parseEther, formatEther} from 'ethers/lib/utils';

const secondsInADay = 24 * 60 * 60;

const hiIQMainnetAddress = '0x1bf5457ecaa14ff63cc89efd560e251e814e16ba';
const hiIQABI = require('../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;

const IQERC20MainnetAddress = '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9';
const IQERC20ABI = require('../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;

const hiIQRewardsMainnetAddress = '0xb55Dcc69d909103b4De773412A22AB8B86e8c602';
const hiIQRewardsABI = require('../artifacts/src/Rewards/HiIQRewardsv4.sol/HiIQRewardsv4').abi;

const hiIQGaugeController = 'HIIQGaugeController';

async function runwithImpersonation(userAddress: any, func: any) {

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [userAddress]
  });

  await func();

  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [userAddress]
  });

}

const setup = deployments.createFixture(async () => {

  const {deployer} = await getNamedAccounts();
  const HIIQ = new ethers.Contract(hiIQMainnetAddress, hiIQABI); // await ethers.getContract('HIIQ');
  const IQERC20 = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI); // await ethers.getContract('IQERC20');
  const HiIQRewards = new ethers.Contract(hiIQRewardsMainnetAddress, hiIQRewardsABI);

  console.log('1')
  console.log(new Date())

  // await deployments.deploy(hiIQContract, {
  //   from: deployer,
  //   args: [IQERC20.address, HIIQ.address],
  //   log: true,
  // });

  // console.log('2')
  // console.log(new Date())

  await deployments.deploy(hiIQGaugeController, {
    from: deployer,
    args: [IQERC20.address, HIIQ.address],
    log: true,
  });

  console.log('3')
  console.log(new Date())

  const contracts = {
    HiIQRewards,//: <HiIQRewards> await ethers.getContract(hiIQContract),
    HIIQ,
    IQERC20,
    HiIQGaugeController: await ethers.getContract(hiIQGaugeController),
  };

  console.log('4')
  console.log(new Date())

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  console.log('44')
  console.log(new Date())
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };

});

describe('TEST', () => {
  it('Gauge Test', async () => {
    const {users, deployer, IQERC20, HIIQ, HiIQRewards, HiIQGaugeController} = await setup();

    const user = users[0];
    const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('30000000')); // 30M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(secondsInADay); // 1M per day

    await runwithImpersonation(
      '0xaca39b187352d9805deced6e73a3d72abf86e7a0',
      async () => {
        const signerImpersonate = await ethers.getSigner("0xaca39b187352d9805deced6e73a3d72abf86e7a0")
        // console.log('signerImpersonate',signerImpersonate)
        const IQERC20Local = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signerImpersonate);
        // mint IQ to user

        console.log('before Balance:', formatEther(await IQERC20Local.balanceOf(user.address)))

        const estGas = await IQERC20Local.estimateGas.mint(user.address, amount,
          {
            gasLimit: 12000000
          });

        console.log('5', estGas)
        console.log('5_5', estGas.toNumber())
        console.log(new Date())

        const tx = await IQERC20Local.mint(user.address, amount,
          {
            gasLimit: estGas
          });
        // console.log('mint IQ: ', tx)
        await tx.wait()

        console.log('after Balance:', formatEther(await IQERC20Local.balanceOf(user.address)))
      });

    console.log('6')
    console.log(new Date())
    //
    // // lock 1M IQ for 60 days
    let estGas = await user.IQERC20.estimateGas.approve(HIIQ.address, lockedAmount);
    await user.IQERC20.approve(HIIQ.address, lockedAmount, {gasLimit: estGas});

    console.log('6.1')
    estGas = await user.HIIQ.estimateGas.create_lock(lockedAmount, lockTime);
    await user.HIIQ.create_lock(lockedAmount, lockTime, {gasLimit: estGas});

    console.log('6.2')
    estGas = await user.HIIQ.estimateGas.checkpoint();
    await user.HIIQ.checkpoint({gasLimit: estGas});

    console.log('7')
    console.log(new Date())

    await runwithImpersonation(
      '0xaca39b187352d9805deced6e73a3d72abf86e7a0',
      async () => {
        const signerImpersonate = await ethers.getSigner("0xaca39b187352d9805deced6e73a3d72abf86e7a0")
        const HiIQRewards = new ethers.Contract(hiIQRewardsMainnetAddress, hiIQRewardsABI, signerImpersonate);

        console.log('7')
        let estGas = await HiIQRewards.estimateGas.initializeDefault();
        const tx1 = await HiIQRewards.initializeDefault({gasLimit: estGas});
        await tx1.wait()

        console.log('8')
        estGas = await HiIQRewards.estimateGas.setYieldRate(yieldPerSecond, true);
        const tx2 = await HiIQRewards.setYieldRate(yieldPerSecond, true, {gasLimit: estGas});
        await tx2.wait()
      });

    // await user.IQERC20.transfer(HiIQRewards.address, rewardAmount);

    console.log('9')
    console.log(new Date())


    console.log('HiIQGaugeController', HiIQGaugeController.address)


    console.log('hello')

  })
});
