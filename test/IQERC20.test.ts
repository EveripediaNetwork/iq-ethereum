import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {IQERC20} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('IQERC20');
  const {deployer} = await getNamedAccounts();
  const contracts = {
    IQERC20: <IQERC20>await ethers.getContract('IQERC20'),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('IQERC20', function () {
  it('owner can mint and burn', async function () {
    const {users, deployer} = await setup();
    await expect(deployer.IQERC20.mint(users[0].address, 1000)).to.be.not
      .reverted;
    await expect(
      users[3].IQERC20.mint(users[0].address, 1000)
    ).to.be.revertedWith('You are not owner or minter');
    await expect(users[0].IQERC20.transfer(users[1].address, 1000)).to.be.not
      .reverted;
    expect(await users[0].IQERC20.balanceOf(users[1].address)).to.equal(1000);
    await expect(deployer.IQERC20.burn(users[1].address, 1000)).to.be.not
      .reverted;
    await expect(
      deployer.IQERC20.burn(users[1].address, 2000)
    ).to.be.revertedWith('ERC20: burn amount exceeds balance');
    await expect(users[3].IQERC20.burn(users[1].address, 1)).to.be.revertedWith(
      'You are not owner or minter'
    );
  });

  it('owner can set a minter', async function () {
    const {users, deployer} = await setup();
    await expect(deployer.IQERC20.setMinter(users[0].address)).to.be.not
      .reverted;
    expect(await deployer.IQERC20.minter()).to.equal(users[0].address);
    await expect(
      users[0].IQERC20.setMinter(users[0].address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('owner can change owner', async function () {
    const {users, deployer} = await setup();
    expect(await deployer.IQERC20.owner()).to.equal(deployer.address);
    await expect(deployer.IQERC20.transferOwnership(users[1].address)).to.be.not
      .reverted;
    expect(await deployer.IQERC20.owner()).to.equal(users[1].address);
  });
});
