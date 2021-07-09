import {expect} from './chai-setup';
import {HiIQRewards} from '../typechain';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('HiIQRewards');
  const {deployer} = await getNamedAccounts();

  const contracts = {
    HiIQRewards: <HiIQRewards>await ethers.getContract('HiIQRewards'),
  };

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
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

    await expect(deployer.HiIQRewards.initializeDefault()).to.be.not.reverted;
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
});
