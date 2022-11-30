import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
  network,
} from 'hardhat';
import {DummyERC20, Inflation, IQERC20} from '../typechain';
import {setupUser, setupUsers} from './utils';
import {parseEther} from 'ethers/lib/utils';
import {expect} from 'chai';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture();
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('DummyERC20', {
    from: deployer,
    args: [],
    log: true,
  });

  await deployments.deploy('Inflation', {
    from: deployer,
    args: [IQERC20.address, [], deployer],
    log: true,
  });
  const contracts = {
    Inflation: <Inflation>await ethers.getContract('Inflation'),
    IQERC20: IQERC20,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('Inflation', function () {
  beforeEach(async function () {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
  });

  it('Admin can changeInflation', async function () {
    const {users, deployer} = await setup();
    const rewards = {
      destination: users[0].address,
      emissionsPerSecond: parseEther('1'),
    };
    await deployer.Inflation.changeInflation([rewards]);
    const storedRewards = await deployer.Inflation.rewards();
    expect(storedRewards[0].emissionsPerSecond).to.be.equal(
      rewards.emissionsPerSecond
    );
  });

  it('Admin actions only admin', async function () {
    const {users} = await setup();
    const nonOwner = users[0];
    await expect(nonOwner.Inflation.changeInflation([])).to.be.revertedWith(
      'NotOwner()'
    );
    await expect(
      nonOwner.Inflation.rescue(users[1].address, 0)
    ).to.be.revertedWith('NotOwner()');
    await expect(
      nonOwner.Inflation.transferOwnership(users[1].address)
    ).to.be.revertedWith('NotOwner()');
  });

  it('Admin can rescue', async function () {
    const {deployer} = await setup();

    await deployer.IQERC20.mint(deployer.address, 1000);
    await deployer.IQERC20.transfer(deployer.Inflation.address, 1000);
    expect(await deployer.IQERC20.balanceOf(deployer.address)).to.equal(0);
    await deployer.Inflation.rescue(deployer.IQERC20.address, 1000);
    expect(await deployer.IQERC20.balanceOf(deployer.address)).to.equal(1000);
  });

  it('Inflate', async function () {
    const {users, deployer} = await setup();
    const destination = users[0].address;
    const lastClaimed = await deployer.Inflation.lastClaimed();
    await deployer.IQERC20.mint(deployer.Inflation.address, parseEther('603'));
    const rewards = {
      destination: destination,
      emissionsPerSecond: parseEther('1'),
    };
    await deployer.Inflation.changeInflation([rewards]);
    await ethers.provider.send('evm_increaseTime', [600]);

    await deployer.Inflation.inflate();
    expect(await deployer.Inflation.lastClaimed()).to.be.equal(
      lastClaimed.add(603)
    );
    expect(await deployer.IQERC20.balanceOf(destination)).to.equal(
      parseEther('603')
    );

    await expect(deployer.Inflation.inflate()).to.be.revertedWith(
      'MaxOneCallEachTenMinutes()'
    );

    await ethers.provider.send('evm_increaseTime', [600]);
    await deployer.IQERC20.mint(deployer.Inflation.address, parseEther('603'));
    await deployer.Inflation.inflate();
  });
});
