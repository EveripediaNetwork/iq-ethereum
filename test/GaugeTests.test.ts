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
import {parseEther, formatEther, formatUnits} from 'ethers/lib/utils';
import {contractAddress} from '../scripts/fork/util_functions'; // gauges helper functions

async function runwithImpersonation(userAddress: any, func: any) {

  const signerImpersonate = await ethers.getSigner(userAddress);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [userAddress]
  });

  await func(signerImpersonate);

  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [userAddress]
  });

}

const secondsInADay = 24 * 60 * 60;

const IQERC20ABI = require('../artifacts/src/ERC20/IQERC20.sol/IQERC20').abi;
const hiIQABI = require('../artifacts/src/Lock/HIIQ.vy/HIIQ').abi;
const hiIQRewardsABI = require('../artifacts/src/Rewards/HiIQRewardsv4.sol/HiIQRewardsv4').abi;
const uniswapV2PairABI = require('../artifacts/src/Interfaces/IUniswapV2Pair.sol/IUniswapV2Pair').abi;

const IQERC20MainnetAddress = contractAddress("IQ");
const hiIQMainnetAddress = contractAddress("HIIQ");
const hiIQRewardsMainnetAddress = '0xb55Dcc69d909103b4De773412A22AB8B86e8c602';
const iqFraxLpToken = contractAddress("UNISWAP_LP_IQ_FRAX");
const iqEthLpToken = contractAddress("UNISWAP_LP_IQ_ETH");

// contracts to deploy
const hiIQGaugeController = 'HIIQGaugeController';
const stakingRewardsMultiGauge = 'StakingRewardsMultiGauge';
const GaugeRewardsDistributor = 'GaugeRewardsDistributor';

const setup = deployments.createFixture(async () => {

  const {deployer} = await getNamedAccounts();
  const HIIQ = new ethers.Contract(hiIQMainnetAddress, hiIQABI); // await ethers.getContract('HIIQ');
  const IQERC20 = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI); // await ethers.getContract('IQERC20');
  const HiIQRewards = new ethers.Contract(hiIQRewardsMainnetAddress, hiIQRewardsABI);

  const UniswapFraxIqPool = new ethers.Contract(iqFraxLpToken, uniswapV2PairABI);
  const UniswapEthIqPool = new ethers.Contract(iqEthLpToken, uniswapV2PairABI);

  console.log('deploying hiIQGaugeController')
  await deployments.deploy(hiIQGaugeController, {
    from: deployer,
    args: [IQERC20.address, HIIQ.address],
    log: true,
  });
  const HiIQGaugeController = await ethers.getContract(hiIQGaugeController);

  // TODO: remove timelock dependency in Rewards Distributor
  console.log('deploying timelock')
  const timelock = await deployments.deploy('Timelock', {
    from: deployer,
    args: [
      deployer,
      172800
    ],
    log: true,
  });

  console.log('deploying gauge rewards distributor')
  const fraxGaugeFXSRewardsDist = await deployments.deploy(GaugeRewardsDistributor, {
    from: deployer,
    args: [
      timelock.address,
      deployer,
      IQERC20.address,
      HiIQGaugeController.address
    ],
    log: true,
  });

  const RewardsDistributor = await ethers.getContract(GaugeRewardsDistributor);

  console.log('add gauge type')
  const estGas1 = await HiIQGaugeController.estimateGas.add_type(0, 100);
  await HiIQGaugeController.add_type(0, 100, {gasLimit: estGas1});

  console.log('deploying uniswap lp IQ/FRAX gauge')
  const uniswap_lp_iq_frax_gauge = await deployments.deploy(stakingRewardsMultiGauge, {
    from: deployer,
    args: [
      iqFraxLpToken,
      fraxGaugeFXSRewardsDist.address,
      ['IQ'],
      [IQERC20.address],
      [deployer],
      [11574074074074, 11574074074074],
      ['0x0000000000000000000000000000000000000000']
    ],
    log: true,
  });

  console.log('add uniswap lp IQ/FRAX gauge to gaugecontroller')
  await HiIQGaugeController.add_gauge(uniswap_lp_iq_frax_gauge.address, 0, 5000);

  console.log('deploying uniswap lp IQ/ETH gauge')
  const uniswap_lp_iq_eth_gauge = await deployments.deploy(stakingRewardsMultiGauge, {
    from: deployer,
    args: [
      iqEthLpToken,
      fraxGaugeFXSRewardsDist.address,
      ['IQ'],
      [IQERC20.address],
      [deployer],
      [11574074074074, 11574074074074],
      ['0x0000000000000000000000000000000000000000']
    ],
    log: true,
  });

  const UniswapIqFraxLpGauge = await ethers.getContractAt(stakingRewardsMultiGauge, uniswap_lp_iq_frax_gauge.address)
  const UniswapIqEthLpGauge = await ethers.getContractAt(stakingRewardsMultiGauge, uniswap_lp_iq_eth_gauge.address)

  console.log('add uniswap lp IQ/FRAX gauge to gaugecontroller')
  await HiIQGaugeController.add_gauge(uniswap_lp_iq_eth_gauge.address, 0, 5000);

  console.log('rewards dist whitelist gauged')
  await RewardsDistributor.setGaugeState(UniswapIqFraxLpGauge.address, false, true);
  await RewardsDistributor.setGaugeState(UniswapIqEthLpGauge.address, false, true);

  const contracts = {
    HiIQRewards,//: <HiIQRewards> await ethers.getContract(hiIQContract),
    HIIQ,
    IQERC20,
    HiIQGaugeController,
    RewardsDistributor,
    UniswapFraxIqPool,
    UniswapEthIqPool,
    UniswapIqFraxLpGauge,
    UniswapIqEthLpGauge
  };

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    deployer: await setupUser(deployer, contracts),
  };

});

describe('CRV Gauges', () => {
  it('Deployment Test', async () => {
    const {
      users, deployer, IQERC20, HIIQ, HiIQRewards,
      HiIQGaugeController,
      RewardsDistributor,
      UniswapFraxIqPool,
      UniswapEthIqPool,
      UniswapIqFraxLpGauge,
      UniswapIqEthLpGauge
    } = await setup();

    const ownerAddr = contractAddress("OWNER");

    const user = users[0];
    const lockTime = Math.round(new Date().getTime() / 1000) + secondsInADay * 60; // 60 days

    const amount = BigNumber.from(parseEther('60000000')); // 60M
    const lockedAmount = BigNumber.from(parseEther('1000000')); // 1M
    const rewardAmount = BigNumber.from(parseEther('30000000')); // 30M
    const yieldPerSecond = BigNumber.from(parseEther('1000000')).div(secondsInADay); // 1M per day
    let estGas;

    async function getIqEthLPTokens(toAddress: any, amount: any) {
      let estGas;
      const fromAddress = "0x44C45d538435CFD6abB7a995bd1b3C2571f70bC8"; // holding LP tokens
      await runwithImpersonation(
        fromAddress,
        async (signerImpersonate: any) => {
          const UniswapFraxIqPool = new ethers.Contract(
            iqFraxLpToken, uniswapV2PairABI, signerImpersonate
          );
          const howManyLPTokens = ethers.BigNumber.from(ethers.utils.parseEther(`${amount}`));
          const estGas = await UniswapFraxIqPool.estimateGas.transfer(
            toAddress,
            howManyLPTokens
          );
          const tx = await UniswapFraxIqPool.transfer(
            toAddress,
            howManyLPTokens,
            {gasLimit: estGas}
          );
          await tx.wait()
        });
    }

    // give some IQ to the hardhat users
    async function getIQandHIIQ(userToFund: any) {
      let estGas;

      await runwithImpersonation(
        ownerAddr,
        async (signerImpersonate: any) => {

          const IQERC20Local = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signerImpersonate);

          console.log('before Balance:', formatEther(await IQERC20Local.balanceOf(userToFund.address)))

          estGas = await IQERC20Local.estimateGas.mint(userToFund.address, amount);
          const tx = await IQERC20Local.mint(userToFund.address, amount, {gasLimit: estGas});
          await tx.wait()

          console.log('after Balance:', formatEther(await IQERC20Local.balanceOf(userToFund.address)))
        });

      // lock 1M IQ for 60 days, give user HiIQ
      estGas = await userToFund.IQERC20.estimateGas.approve(HIIQ.address, lockedAmount);
      await userToFund.IQERC20.approve(HIIQ.address, lockedAmount, {gasLimit: estGas});

      estGas = await userToFund.HIIQ.estimateGas.create_lock(lockedAmount, lockTime);
      await userToFund.HIIQ.create_lock(lockedAmount, lockTime, {gasLimit: estGas});

      estGas = await userToFund.HIIQ.estimateGas.checkpoint();
      await userToFund.HIIQ.checkpoint({gasLimit: estGas});
    }

    // fund the rewards distributor
    await runwithImpersonation(
      ownerAddr,
      async (signerImpersonate: any) => {

        const IQERC20Local = new ethers.Contract(IQERC20MainnetAddress, IQERC20ABI, signerImpersonate);

        // rewards distributor
        estGas = await IQERC20Local.estimateGas.mint(RewardsDistributor.address, amount);
        (await IQERC20Local.mint(RewardsDistributor.address, amount, {gasLimit: estGas})).wait();

        //gauge 1
        estGas = await IQERC20Local.estimateGas.mint(UniswapIqFraxLpGauge.address, amount);
        (await IQERC20Local.mint(UniswapIqFraxLpGauge.address, amount, {gasLimit: estGas})).wait();

        //gauge 2
        estGas = await IQERC20Local.estimateGas.mint(UniswapIqEthLpGauge.address, amount);
        (await IQERC20Local.mint(UniswapIqEthLpGauge.address, amount, {gasLimit: estGas})).wait();

        console.log('RewardsDistributor Balance:', formatEther(await IQERC20Local.balanceOf(RewardsDistributor.address)))
      });

    await getIQandHIIQ(users[0]);
    await getIQandHIIQ(users[1]);
    await getIQandHIIQ(users[2]);

    console.log('HiIQGaugeController', HiIQGaugeController.address)

    async function getGaugeWeights(HiIQGaugeController: any) {
      const numberOfGauges = await HiIQGaugeController.n_gauges();
      console.log(`there are ${numberOfGauges} gauges in this gaugecontroller`)

      let totalWeight = await HiIQGaugeController.get_total_weight();
      for (let g_idx = 0; g_idx < numberOfGauges; g_idx++) {
        const gaugeAddress = await HiIQGaugeController.gauges(g_idx);
        const gaugeWeight = await HiIQGaugeController.get_gauge_weight(gaugeAddress);
        const gaugeWeightPct = Number(formatUnits(gaugeWeight, 18)) / Number(formatUnits(totalWeight, 18)) * 10000;
        console.log(`${gaugeAddress} - ${formatUnits(gaugeWeight, 2)} ${gaugeWeightPct} %`)
      }
      console.log(`totalWeight: ${formatUnits(totalWeight, 2)}`)
    }

    async function outputBlockTimestamp() {
      let blockNum = await ethers.provider.getBlockNumber();
      let block = await ethers.provider.getBlock(blockNum);
      let blockTimestampDate = new Date(block.timestamp * 1000);
      console.log('\n===============================================')
      console.log(`block timestamp: ${blockTimestampDate.toLocaleDateString("en-US")} ${blockTimestampDate.toLocaleTimeString("en-US")}`)
    }

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    // vote for IQ/FRAX gauge 20% and IQ/ETH gauge 80%
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 2000);
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 8000);

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    // vote for IQ/FRAX gauge 30% and IQ/ETH gauge 70%
    await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 3000);
    await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 7000);

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    // vote for IQ/FRAX gauge 40% and IQ/ETH gauge 60%
    await users[2].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 4000);
    await users[2].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 6000);

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    let useVotingPowerUsed = formatUnits(await HiIQGaugeController.vote_user_power(user.address), 2)
    console.log(`User Voting Power Used: ${useVotingPowerUsed} %`) // format for bps

    const IqFraxTimeWeight = await HiIQGaugeController.time_weight(UniswapIqFraxLpGauge.address);
    console.log(`IqFraxTimeWeight: ${(new Date(IqFraxTimeWeight * 1000)).toLocaleDateString("en-US")}`)

    // vote for IQ/FRAX gauge 20% and IQ/ETH gauge 80%
    await expect(
      users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 2000)
    ).to.be.revertedWith('Cannot vote so often');
    await expect(
      users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 8000)
    ).to.be.revertedWith('Cannot vote so often');

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
    await ethers.provider.send('evm_mine', []);

    await (await HiIQGaugeController.checkpoint()).wait();

    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 100);
    await users[0].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 8900);
    await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqFraxLpGauge.address, 100);
    await users[1].HiIQGaugeController.vote_for_gauge_weights(UniswapIqEthLpGauge.address, 9900);

    await outputBlockTimestamp();
    await getGaugeWeights(HiIQGaugeController);

    useVotingPowerUsed = formatUnits(await HiIQGaugeController.vote_user_power(users[0].address), 2);
    expect(useVotingPowerUsed).to.be.eq('90.0'); // expect 10% left over after the changed votes
    console.log(`User Voting Power Used: ${useVotingPowerUsed} %`); // format for bps

    await getIqEthLPTokens(users[0].address, 100); // get some LP Tokens

    const amountLockLPTokens = ethers.BigNumber.from(ethers.utils.parseEther('10'));
    await (await users[0].UniswapFraxIqPool.approve(UniswapIqFraxLpGauge.address, amountLockLPTokens)).wait(); // aprove the movement of lp tokens for safeTransfer in gauge
    await users[0].UniswapIqFraxLpGauge.stakeLocked(amountLockLPTokens, 94608000);

    // const {reserve0} = await UniswapFraxIqPool.getReserves()
    //
    // console.log(`getReserves: ${1}`)
    console.log(`fraxPerLPToken: ${await UniswapIqFraxLpGauge.fraxPerLPToken()}`)


    const stakedFrax = await UniswapIqFraxLpGauge.userStakedFrax(users[0].address)
    console.log(`stakedFrax: ${stakedFrax}`)

    await ethers.provider.send('evm_increaseTime', [secondsInADay * 14]);
    await ethers.provider.send('evm_mine', []);

    const user0Earned = await UniswapIqFraxLpGauge.earned(users[0].address)
    console.log(`user0Earned: ${formatEther(user0Earned[0])}`)
  })
});
