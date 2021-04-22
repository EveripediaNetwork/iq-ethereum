import {expect} from './chai-setup';
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';
import {DummyERC20, IQERC20, TokenMinter} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  const {deployer} = await getNamedAccounts();
  await deployments.fixture();
  const IQERC20 = <IQERC20>await ethers.getContract('IQERC20');
  await deployments.deploy('DummyERC20', {
    from: deployer,
    args: [],
    log: true,
  });
  const PTOKEN = <DummyERC20>await ethers.getContract('DummyERC20');

  await deployments.deploy('TokenMinter', {
    from: deployer,
    args: [IQERC20.address, PTOKEN.address],
    log: true,
  });
  const contracts = {
    TokenMinter: <TokenMinter>await ethers.getContract('TokenMinter'),
    IQERC20: IQERC20,
    PTOKEN: PTOKEN,
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };
});

describe('TokenMinter', function () {
  it('TokenMinter can mint and burn', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[3];
    expect(await TokenMinter.iQ()).to.equal(user.IQERC20.address);
    expect(await TokenMinter.wrappedIQ()).to.equal(user.PTOKEN.address);
    await deployer.PTOKEN.mint(user.address, 5000);
    await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
      .reverted;
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(5000);
    await expect(user.PTOKEN.approve(TokenMinter.address, 1000)).to.be.not
      .reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.not.reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.revertedWith(
      'ERC20: transfer amount exceeds allowance'
    );
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(1000);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(4000);
    await expect(user.TokenMinter.burn(2000)).to.be.revertedWith(
      'ERC20: burn amount exceeds balance'
    );
    await expect(user.TokenMinter.burn(1000)).to.not.be.reverted;
    expect(await user.IQERC20.balanceOf(user.address)).to.equal(0);
    expect(await user.PTOKEN.balanceOf(user.address)).to.equal(5000);
    await expect(users[1].TokenMinter.mint(1000)).to.be.revertedWith(
      'ERC20: transfer amount exceeds balance'
    );

    await expect(user.TokenMinter.burn(-5)).to.be.reverted;
    await expect(user.TokenMinter.mint(-10)).to.be.reverted;
  });

  it('TokenMinter can transfer wrapped', async function () {
    const {users, TokenMinter, deployer} = await setup();
    const user = users[3];
    await deployer.PTOKEN.mint(user.address, 5000);
    await expect(user.PTOKEN.approve(TokenMinter.address, 1000)).to.be.not
      .reverted;
    await expect(deployer.IQERC20.setMinter(TokenMinter.address)).to.be.not
      .reverted;
    await expect(user.TokenMinter.mint(1000)).to.be.not.reverted;
    await expect(
      user.TokenMinter.transferWrapped(user.address, 1000)
    ).to.be.revertedWith('Only IQ owner can tranfer wrapped tokens');
    await expect(
      deployer.TokenMinter.transferWrapped(user.address, 1000)
    ).to.be.revertedWith('Minter is still in use');
    await expect(deployer.IQERC20.setMinter(user.address)).to.be.not.reverted;
    await expect(deployer.TokenMinter.transferWrapped(users[4].address, 500)).to
      .be.not.reverted;
    expect(await user.PTOKEN.balanceOf(users[4].address)).to.equal(500);
    await expect(user.TokenMinter.burn(500)).to.be.revertedWith(
      'You are not owner or minter'
    );
  });
});
