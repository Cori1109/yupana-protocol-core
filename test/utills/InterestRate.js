const fs = require("fs");
const env = require("../../env");
const { confirmOperation } = require("../../scripts/confirmation");
const storage = require("../../storage/InterestRate");
const { functions } = require("../../storage/Functions");
const { getLigo } = require("../../scripts/helpers");
const { execSync } = require("child_process");

class InterestRate {
  contract;
  storage;
  tezos;

  constructor(contract, tezos) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(qsAddress, tezos) {
    return new InterestRate(await tezos.contract.at(qsAddress), tezos);
  }

  static async originate(tezos) {
    const artifacts = JSON.parse(
      fs.readFileSync(`${env.buildDir}/interestRate.json`)
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

    return new InterestRate(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}) {
    let storage = await this.contract.storage();
    this.storage = {
      admin: storage.admin,
      yToken: storage.yToken,
      kickRateFloat: storage.kickRateFloat,
      baseRateFloat: storage.baseRateFloat,
      multiplierFloat: storage.multiplierFloat,
      jumpMultiplierFloat: storage.jumpMultiplierFloat,
      reserveFactorFloat: storage.reserveFactorFloat,
      lastUpdTime: storage.lastUpdTime,
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

  async updateAdmin(newAdmin) {
    const operation = await this.contract.methods.updateAdmin(newAdmin).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async updateYToken(newToken) {
    const operation = await this.contract.methods.setYToken(newToken).send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }

  async setCoefficients(
    kickRateFloat,
    baseRateFloat,
    multiplierFloat,
    jumpMultiplierFloat
  ) {
    const operation = await this.contract.methods
      .setCoefficients(
        kickRateFloat,
        baseRateFloat,
        multiplierFloat,
        jumpMultiplierFloat
      )
      .send();
    await confirmOperation(this.tezos, operation.hash);
    return operation;
  }
}

module.exports.InterestRate = InterestRate;
