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
  await deployments.fixture();
  const {deployer} = await getNamedAccounts();

  const contracts = {
    HiIQRewards: <HiIQRewards>await ethers.getContract('HiIQRewards'),
    HIIQ: <HIIQ>await ethers.getContract('HIIQ'),
    IQERC20: <IQERC20>await ethers.getContract('IQERC20'),
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
    const {users, deployer, HIIQ} = await setup();
    const temp = users[0];

    await expect(deployer.HiIQRewards.setYieldDuration(604800)).to.be.not
      .reverted;
    await expect(temp.HiIQRewards.setYieldDuration(604800)).to.be.reverted;

    // await expect(deployer.HiIQRewards.initializeDefault()).to.be.not.reverted;
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
    const {users, deployer, HIIQ} = await setup();

    const user = users[0];
    const lockTime = Math.round(new Date().getTime() / 1000) + 6000000;
    const amount = 5 ** 18;

    await expect(deployer.IQERC20.mint(user.address, amount)).to.be.not
      .reverted;
    // expect(await deployer.IQERC20.balanceOf(user.address)).to.equal(10000);

    await expect(user.IQERC20.approve(HIIQ.address, amount)).to.be.not.reverted;

    await expect(user.HIIQ.create_lock(amount, lockTime)).to.be.not.reverted;

    console.log(await deployer.HIIQ['balanceOf(address)'](user.address));

    console.log(await deployer.HiIQRewards.eligibleCurrentHiIQ(user.address));

    // await expect(deployer.IQERC20.mint(user.address, amount)).to.be.not
    //   .reverted;
    // // expect(await deployer.IQERC20.balanceOf(user.address)).to.equal(10000);

    // await expect(user.IQERC20.approve(HIIQ.address, amount)).to.be.not.reverted;

    // await expect(user.HIIQ.create_lock(amount, lockTime)).to.be.not.reverted;

    // await expect(
    //   deployer.HIIQ['increase_amount(uint256)'](
    //     ethers.utils.parseEther(String(1))
    //   )
    // ).to.be.not.reverted;
  });
});
