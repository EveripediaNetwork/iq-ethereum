import {expect} from './chai-setup';
import {HiIQRewards, HIIQ, IQERC20} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('HIIQ');
  const {deployer} = await getNamedAccounts();
  const HIIQ = <HIIQ>await ethers.getContract('HIIQ');
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('HiIQRewards', {
    from: deployer,
    args: [IQERC20.address, HIIQ.address],
    log: true,
  });

  const contracts = {
    HiIQRewards: <HiIQRewards>await ethers.getContract('HiIQRewards'),
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

describe('HiIQRewards', () => {
  it('Only owner can call restrictive functions', async () => {
    const {users, deployer} = await setup();
    const temp = users[0];

    await expect(deployer.HiIQRewards.setYieldDuration(604800)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.setYieldDuration(604800)).to.be.reverted;

    await expect(temp.HiIQRewards.initializeDefault()).to.be.reverted;

    await expect(deployer.HiIQRewards.greylistAddress(temp.address)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.greylistAddress(deployer.address)).to.be
      .reverted;

    await expect(deployer.HiIQRewards.setPauses(true)).to.be.not.reverted;
    await expect(temp.HiIQRewards.setPauses(true)).to.be.reverted;

    await expect(deployer.HiIQRewards.setYieldRate(7 * 86400, false)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.setYieldRate(7 * 86400, false)).to.be
      .reverted;
  });

  it('Mint and lock tokens', async () => {
    const {users, deployer, HIIQ, HiIQRewards} = await setup();

    const user = users[0];
    const lockTime = Math.round(new Date().getTime() / 1000) + 6000000;
    const amount = 10e8;
    const lockedAmount = amount / 2;
    const rewardAmount = amount / 2;

    await expect(deployer.HiIQRewards.initializeDefault()).to.be.not.reverted;

    await expect(deployer.IQERC20.mint(user.address, amount)).to.be.not
      .reverted;

    await expect(user.IQERC20.approve(HIIQ.address, lockedAmount)).to.be.not
      .reverted;

    await expect(user.HIIQ.create_lock(lockedAmount, lockTime)).to.be.not
      .reverted;

    await expect(user.IQERC20.transfer(HiIQRewards.address, rewardAmount)).to.be
      .not.reverted;

    await expect(deployer.HiIQRewards.setYieldRate(100000, true)).to.be.not
      .reverted;

    await ethers.provider.send('evm_increaseTime', [120000]);
    await ethers.provider.send('evm_mine', []);

    const currentBalance = amount - lockedAmount - rewardAmount;
    expect(await deployer.IQERC20.balanceOf(user.address)).to.equal(
      currentBalance
    );
    expect(await user.HiIQRewards['userIsInitialized(address)'](user.address))
      .to.be.false;
    await user.HiIQRewards['checkpoint()']();
    await user.HiIQRewards['getYield()']();
    expect(await user.HiIQRewards['userIsInitialized(address)'](user.address))
      .to.be.true;
    expect(await deployer.IQERC20.balanceOf(user.address)).to.not.equal(
      currentBalance
    );
  });
});
