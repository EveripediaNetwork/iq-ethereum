# ✨ IQ ERC20 ✨

## INSTALL

```bash
yarn
```

## TEST

```bash
yarn test
```

## SCRIPTS

Next is the list of npm scripts you can execute.

Some of them relies on [./scripts.js](./scripts.js) to allow parameterizing it via command line argument (have a look inside if you need modifications).
<br/><br/>

### `yarn prepare`

As a standard lifecycle npm script, it is executed automatically upon install. It generates a config file and typechain to get you started with type-safe contract interactions.
<br/><br/>

### `yarn lint`, `yarn lint:fix`, `yarn format` and `yarn format:fix`

These commands will lint and format your code. The `:fix` version will modifiy the files to match the requirement specified in `.eslintrc` and `.prettierrc`.
<br/><br/>

### `yarn compile`

These will compile your contracts.
<br/><br/>

### `yarn void:deploy`

This will deploy your contracts to an in-memory hardhat network and exit, leaving no trace. Quick way to ensure that deployments work as intended without consequences.
<br/><br/>

### `yarn test [mocha args...]`

These will execute your tests using [mocha](https://mochajs.org/). You can pass extra arguments to mocha.
<br/><br/>

### `yarn coverage`

These will produce a coverage report in the `coverage/` folder.
<br/><br/>

### `yarn gas`

These will produce a gas report for function used in the tests.
<br/><br/>

### `yarn dev`

These will run a local hardhat network on `localhost:8545` and deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

### `yarn local:dev`

This assumes a local node it running on `localhost:8545`. It will deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

### `yarn exec <network> <file.ts> [args...]`

Example:<br/>

```bash
yarn run exec goerli scripts/setMinter 0x1D03DB46AAA6f95a303E3a16F3f0Ba2F78c60F54
```

This will execute the script `<file.ts>` against the specified network.
<br/>

### `yarn deploy <network> [args...]`

Examples:<br/>

```bash
yarn deploy goerli --tags DummyERC20
yarn deploy goerli
```

This will deploy the contract on the specified network.

Behind the scene it uses `hardhat deploy` command, so you can append any argument for it.
<br/><br/>

### `yarn export <network> <file.json>`

This will export the abi+address of deployed contract to `<file.json>`.
<br/><br/>

### `yarn fork:run <network> [--blockNumber <blockNumber>] [--deploy] <file.ts> [args...]`

This will execute the script `<file.ts>` against a temporary fork of the specified network.

If `--deploy` flag is used, deploy scripts will be executed.
<br/><br/>

### `yarn fork:deploy <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a temporary fork of the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it.
<br/><br/>

### `yarn fork:test <network> [--blockNumber <blockNumber>] [mocha args...]`

This will test the contract against a temporary fork of the specified network.
<br/><br/>

### `yarn fork:dev <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a fork of the specified network and it will keep running as a node.

Behind the scene it uses `hardhat node` command so you can append any argument for it.

## **Deploy Example** (Rinkeby)

### Install dependencies:

```bash
yarn
```

### Deploy pIQ contract:

```bash
yarn run exec rinkeby scripts/deployDummyERC20
```

### Add erc20 addresss to `hardhat.config.ts` file for pIQ and deploy other contracts:

```bash
yarn deploy rinkeby
```

### Verify:

```bash
npx hardhat --network rinkeby etherscan-verify --api-key xxxxxx
```
