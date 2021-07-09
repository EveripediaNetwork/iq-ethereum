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
  it('Validates earnings', async () => {
    const {users, deployer} = await setup();

    const temp = users[0];

    expect(temp.HiIQRewards.earned(temp.address)).to.be.not.reverted;
    // Division by zero
    expect(temp.HiIQRewards.fractionParticipating()).to.be.reverted;
    expect(deployer.HiIQRewards.eligibleCurrentHiIQ(users[4].address)).to.be.
      .reverted;
  });
});
