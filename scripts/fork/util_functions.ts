/**
 * Run with Impersonation (helper function to run func)
 * @param userAddress
 * @param provider
 * @param hre
 * @param func
 */
export async function runwithImpersonation(
  userAddress: any,
  provider: any,
  hre: any,
  func: any
) {
  try {
    await provider.send('hardhat_impersonateAccount', [userAddress]);
    const signer = await hre.ethers.getSigner(userAddress);
    await func(signer);
  } finally {
    await provider.send('hardhat_stopImpersonatingAccount', [userAddress]);
  }
}

/**
 * Get commonly used addresses, move to named accounts or use hardhat-deployment plugin?
 * @param name
 */
export function contractAddress(name: string) {
  if (name == 'OWNER') {
    return '0xaca39b187352d9805deced6e73a3d72abf86e7a0'; // mainnet
  } else if (name == 'IQ') {
    return '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9'; // mainnet
  } else if (name == 'HIIQ') {
    return '0x1bf5457ecaa14ff63cc89efd560e251e814e16ba'; // mainnet
  } else if (name == 'UNISWAP_LP_IQ_FRAX') {
    return '0xd6c783b257e662ca949b441a4fcb08a53fc49914'; // mainnet
  } else if (name == 'UNISWAP_LP_IQ_ETH') {
    return '0xef9f994a74cb6ef21c38b13553caa2e3e15f69d0'; // mainnet
  } else if (name == 'GAUGE_CONTROLLER') {
    return '0x2b308cd243074e2f4a709e12c26039acecd4daa7'; // hardhat fork
  } else if (name == 'GAUGE_REWARDS_DISTRIBUTOR') {
    return '0xc2cd962e53afcdf574b409599a24724efbadb3d4'; // hardhat fork
  } else if (name == 'UNI_LP_GAUGE_IQ_FRAX') {
    return '0x839055d0fbee415e665dc500dd2af292c0692305'; // hardhat fork
  } else if (name == 'UNI_LP_GAUGE_IQ_ETH') {
    return '0x65237882dd5fbb85d865eff3be26ac4e67da87aa'; // hardhat fork
  }
  return '';
}

/**
 * Sends ETH from Hardhat Account #0 to address
 * @param hre hardhat runtime env
 * @param address address to receive eth
 * @param amount amount of eth to receive
 */
export async function forkEthFaucet(hre: any, address: any, amount: string) {
  // send ETH from hardhat account #0
  let hhSigner = (await hre.ethers.getSigners())[0];

  const txFunding = await hhSigner.sendTransaction({
    to: address,
    value: hre.ethers.utils.parseEther(amount),
  });

  await txFunding.wait();
}

export function timeConverter(UNIX_timestamp: any) {
  var a = new Date(UNIX_timestamp * 1000);
  var months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time =
    date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
  return time;
}
