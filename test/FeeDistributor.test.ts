import {expect} from './chai-setup';
import {HIIQ, IQERC20, FeeDistributor} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';
import {BigNumber} from 'ethers';
import {formatEther, parseEther} from 'ethers/lib/utils';

const secondsInADay = 24 * 60 * 60;

const setup = deployments.createFixture(async () => {
  await deployments.fixture('HIIQ');
  const {deployer} = await getNamedAccounts();
  const HIIQ = <HIIQ>await ethers.getContract('HIIQ');
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  const startTime = Math.round(new Date().getTime() / 1000);
  await deployments.deploy('FeeDistributor', {
    from: deployer,
    args: [HIIQ.address, IQERC20.address, startTime],
    log: true,
  });

  const contracts = {
    FeeDistributor: <FeeDistributor>await ethers.getContract('FeeDistributor'),
    HIIQ,
    IQERC20,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('FeeDistributor', () => {
  it('Mint and lock tokens', async () => {
    const {users, deployer, HIIQ, FeeDistributor} = await setup();

    const user = users[0];
    const lockTime =
      Math.round(new Date().getTime() / 1000) + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('30000000')); // 30M

    await deployer.IQERC20.mint(user.address, amount);

    // lock 1M IQ for 60 days
    await user.IQERC20.approve(HIIQ.address, lockedAmount);
    await user.HIIQ.create_lock(lockedAmount, lockTime);
    await user.HIIQ.checkpoint();

    await user.IQERC20.transfer(FeeDistributor.address, rewardAmount);
    await deployer.FeeDistributor.checkpointToken();
    await deployer.FeeDistributor.checkpointTotalSupply();

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 7]); // 7 days
    await ethers.provider.send('evm_mine', []);

    const currentBalance = amount.sub(lockedAmount).sub(rewardAmount);
    expect(await deployer.IQERC20.balanceOf(user.address)).to.equal(
      currentBalance
    );

    // TODO: testing all scenarios ( restricted functions, with & without checkpoint, claim before time, claim after time, etc)
  });
});
