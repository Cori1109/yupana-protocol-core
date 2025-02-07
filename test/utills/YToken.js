const fs = require("fs");
const env = require("../../env");
const { confirmOperation } = require("../../scripts/confirmation");
const storage = require("../../storage/YToken");
const { functions } = require("../../storage/Functions");
const { getLigo } = require("../../scripts/helpers");
const { execSync } = require("child_process");

function hexToBytes(hex) {
  for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
}

class YToken {
  contract;
  storage;
  tezos;

  constructor(contract, tezos) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(qsAddress, tezos) {
    return new YToken(await tezos.contract.at(qsAddress), tezos);
  }

  static async originate(tezos) {
    const artifacts = JSON.parse(
      fs.readFileSync(`${env.buildDir}/yToken.json`)
    );
    const operation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(JSON.stringify(e));

        return { contractAddress: null };
      });
    await confirmOperation(tezos, operation.hash);

    const ligo = getLigo(true);
    let params = [];

    console.log("Start setting Token lambdas");
    for (const yTokenFunction of functions.token) {
      const stdout = execSync(
        `${ligo} compile-expression pascaligo --michelson-format=json --init-file $PWD/contracts/main/yToken.ligo 'SetTokenAction(record [index = ${yTokenFunction.index}n; func = Bytes.pack(${yTokenFunction.name})] )'`,
        { maxBuffer: 1024 * 1000 }
      );

      const input_params = JSON.parse(stdout.toString());

      params.push({
        kind: "transaction",
        to: operation.contractAddress,
        amount: 0,
        parameter: {
          entrypoint: "setTokenAction",
          value: input_params.args[0].args[0].args[0].args[0], // TODO get rid of this mess
        },
      });
    }

    console.log("Start setting yToken lambdas");

    for (yTokenFunction of functions.yToken) {
      const stdout = execSync(
        `${ligo} compile-expression pascaligo --michelson-format=json --init-file $PWD/contracts/main/yToken.ligo 'SetUseAction(record [index = ${yTokenFunction.index}n; func = Bytes.pack(${yTokenFunction.name})] )'`,
        // `${ligo} compile-expression pascaligo --michelson-format=json --init-file $PWD/contracts/main/yToken.ligo 'Bytes.pack(${yTokenFunction.name})'`,

        // TODO alternative packing to use with direct call below
        // `${ligo} compile-expression pascaligo --michelson-format=json --init-file $PWD/contracts/main/yToken.ligo 'Bytes.pack(${yTokenFunction.name})'`,

        { maxBuffer: 1024 * 1000 }
      );

      const input_params = JSON.parse(stdout.toString());
      // console.log(input_params.bytes);

      // const converted = hexToBytes(input_params.bytes);
      // console.log(converted);

      // const res = await tezos.contract.at(operation.contractAddress);

      // const setCall = res.methods.setUseAction(yTokenFunction.index, converted);
      // params.push(setCall.toTransferParams());

      params.push({
        kind: "transaction",
        to: operation.contractAddress,
        amount: 0,
        parameter: {
          entrypoint: "setUseAction",
          value: input_params.args[0].args[0].args[0].args[0], // TODO get rid of this mess
        },
      });
    }

    const batch = tezos.wallet.batch(params);
    const operation1 = await batch.send();

    await confirmOperation(tezos, operation1.opHash);

    console.log("Setting finished");
    return new YToken(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}) {
    let storage = await this.contract.storage();
    this.storage = {
      storage: storage.storage,
      YTokenLambdas: storage.YTokenLambdas,
    };

    for (const key in maps) {
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await storage[key].get(current),
          };
        } catch (ex) {
          return {
            ...(await prev),
            [current]: 0,
          };
        }
      }, Promise.resolve({}));
    }
  }

  async transfer(txs) {
    const operation = await this.contract.methods.transfer(txs).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async updateOperators(updateParams) {
    const operation = await this.contract.methods
      .updateOperators(updateParams)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async balanceOf(requests, callback) {
    const operation = await this.contract.methods
      .balanceOf(requests, callback)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async getTotalSupply(token_id, receiver) {
    const operation = await this.contract.methods
      .getTotalSupply(token_id, receiver)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async updateInterest(token_id) {
    const operation = await this.contract.methods
      .updateInterest(token_id)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async setAdmin(newAdmin) {
    const operation = await this.contract.methods.setAdmin(newAdmin).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async withdrawReserve(token_id, amount) {
    const operation = await this.contract.methods
      .withdrawReserve(token_id, amount)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async addMarket(
    interestRateModel,
    type,
    assetAddress,
    token_id,
    collateralFactorFloat,
    reserveFactorFloat,
    maxBorrowRate,
    tokenMetadata
  ) {
    if (type == "fA2") {
      const operation = await this.contract.methods
        .addMarket(
          interestRateModel,
          type,
          assetAddress,
          token_id,
          collateralFactorFloat,
          reserveFactorFloat,
          maxBorrowRate,
          tokenMetadata
        )
        .send();
    } else {
      const operation = await this.contract.methods
        .addMarket(
          interestRateModel,
          type,
          assetAddress,
          collateralFactorFloat,
          reserveFactorFloat,
          maxBorrowRate,
          tokenMetadata
        )
        .send();
    }
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async setTokenFactors(
    tokenId,
    collateralFactorFloat,
    reserveFactorFloat,
    interestRateModel,
    maxBorrowRate
  ) {
    const operation = await this.contract.methods
      .setTokenFactors(
        tokenId,
        collateralFactorFloat,
        reserveFactorFloat,
        interestRateModel,
        maxBorrowRate
      )
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async setGlobalFactors(
    closeFactorFloat,
    liqIncentiveFloat,
    priceFeedProxy,
    maxMarkets
  ) {
    const operation = await this.contract.methods
      .setGlobalFactors(
        closeFactorFloat,
        liqIncentiveFloat,
        priceFeedProxy,
        maxMarkets
      )
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async mint(token_id, amount) {
    const operation = await this.contract.methods.mint(token_id, amount).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async redeem(token_id, amount) {
    const operation = await this.contract.methods
      .redeem(token_id, amount)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async borrow(token_id, amount) {
    const operation = await this.contract.methods
      .borrow(token_id, amount)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async repay(token_id, amount) {
    const operation = await this.contract.methods
      .repay(token_id, amount)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async liquidate(borrowToken, collateralToken, borrower, amount) {
    const operation = await this.contract.methods
      .liquidate(borrowToken, collateralToken, borrower, amount)
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async enterMarket(token_id) {
    const operation = await this.contract.methods.enterMarket(token_id).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async exitMarket(token_id) {
    const operation = await this.contract.methods.exitMarket(token_id).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async updatePrice(tokenSet) {
    const operation = await this.contract.methods.updatePrice(tokenSet).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  // async updMetadata(tokenId, tokenMetadata) {
  //   const operation = await this.contract.methods.updateMetadata(tokenId, tokenMetadata).send();
  //   await confirmOperation(this.tezos, operation.hash);
  //   return operation;
  // }

  async updateAndsetTokenFactors(
    proxy,
    tokenId,
    collateralFactorFloat,
    reserveFactorFloat,
    interestRateModel,
    maxBorrowRate
  ) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(1).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([1]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(tokenId).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([tokenId]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods
          .setTokenFactors(
            tokenId,
            collateralFactorFloat,
            reserveFactorFloat,
            interestRateModel,
            maxBorrowRate
          )
          .toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndMint(proxy, token, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(0).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([0]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(token).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([token]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.mint(token, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndMint2(proxy, token, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(1).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([1]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(token).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([token]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.mint(token, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndBorrow(proxy, borrowToken, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(0).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([0]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(borrowToken).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([borrowToken]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.borrow(borrowToken, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndBorrow2(proxy, borrowToken, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(1).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([1]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(borrowToken).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([borrowToken]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.borrow(borrowToken, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndRepay(proxy, repayToken, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(repayToken).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([repayToken]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.repay(repayToken, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndRedeem(proxy, redeemToken, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(redeemToken).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([redeemToken]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.redeem(redeemToken, amount).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndExit(proxy, token) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(1).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([1]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(token).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([token]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods.exitMarket(token).toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }

  async updateAndLiq(proxy, borrowToken, collateralToken, borrower, amount) {
    const batch = await this.tezos.wallet.batch([
      {
        kind: "transaction",
        ...this.contract.methods.updateInterest(borrowToken).toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods.getPrice([borrowToken]).toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods
          .updateInterest(collateralToken)
          .toTransferParams(),
      },
      {
        kind: "transaction",
        ...proxy.contract.methods
          .getPrice([collateralToken])
          .toTransferParams(),
      },
      {
        kind: "transaction",
        ...this.contract.methods
          .liquidate(borrowToken, collateralToken, borrower, amount)
          .toTransferParams(),
      },
    ]);
    const operation = await batch.send();

    await confirmOperation(this.tezos, operation.opHash);
    return operation;
  }
}

module.exports.YToken = YToken;
