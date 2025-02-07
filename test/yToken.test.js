const { MichelsonMap } = require("@taquito/michelson-encoder");

const { alice, bob, carol, peter } = require("../scripts/sandbox/accounts");

const { strictEqual, rejects, ok } = require("assert");

const { Proxy } = require("../test/utills/Proxy");
const { InterestRate } = require("../test/utills/InterestRate");
const { GetOracle } = require("../test/utills/GetOracle");
const { YToken } = require("../test/utills/YToken");
const { FA12 } = require("../test/utills/FA12");
const { FA2 } = require("../test/utills/FA2");
const { Utils } = require("../test/utills/Utils");

const tokenMetadata = MichelsonMap.fromLiteral({
  symbol: Buffer.from("TST").toString("hex"),
  name: Buffer.from("TEST").toString("hex"),
  decimals: Buffer.from("6").toString("hex"),
  icon: Buffer.from("").toString("hex"),
});

const tokenMetadata2 = MichelsonMap.fromLiteral({
  symbol: Buffer.from("TST2").toString("hex"),
  name: Buffer.from("TEST2").toString("hex"),
  decimals: Buffer.from("6").toString("hex"),
  icon: Buffer.from("").toString("hex"),
});

describe("Proxy tests", async () => {
  let tezos;
  let yToken;
  let interest;
  let interest2;
  let proxy;
  let oracle;
  let fa12;
  let fa12_2;
  let fa2;
  let yTokenContractAddress;
  let interestContractAddress;
  let proxyContractAddress;
  let oracleContractAddress;
  let fa12ContractAddress;
  let fa2ContractAddress;

  before("setup Proxy", async () => {
    tezos = await Utils.initTezos();
    yToken = await YToken.originate(tezos);
    interest = await InterestRate.originate(tezos);
    interest2 = await InterestRate.originate(tezos);
    proxy = await Proxy.originate(tezos);
    fa12 = await FA12.originate(tezos);
    fa12_2 = await FA12.originate(tezos);
    fa2 = await FA2.originate(tezos);
    oracle = await GetOracle.originate(tezos);

    yTokenContractAddress = yToken.contract.address;
    interestContractAddress = interest.contract.address;
    interest2ContractAddress = interest2.contract.address;
    proxyContractAddress = proxy.contract.address;
    oracleContractAddress = oracle.contract.address;
    fa12ContractAddress = fa12.contract.address;
    fa12_2ContractAddress = fa12_2.contract.address;
    fa2ContractAddress = fa2.contract.address;

    tezos = await Utils.setProvider(tezos, alice.sk);
    await Utils.trasferTo(tezos, carol.pkh, 50000000);
    await Utils.trasferTo(tezos, peter.pkh, 50000000);

    await interest.setCoefficients(
      800000000000000000,
      634195839,
      7134703196,
      31709791983
    );
    await interest.updateStorage();

    await interest2.setCoefficients(
      800000000000000000,
      0,
      1585489599,
      34563673262
    );
    await interest2.updateStorage();

    console.log("oracle ", oracleContractAddress);

    // await oracle.updOracle([new Date(), new Date(), 1, 2, 3, 4, 5]);
    // await oracle.updateStorage();

    // await oracle.updReturnAddressOracle(proxyContractAddress);
    // await oracle.updateStorage();
    // strictEqual(oracle.storage.returnAddress, proxyContractAddress);

    await proxy.updateOracle(oracleContractAddress);
    await proxy.updateStorage();
    strictEqual(proxy.storage.oracle, oracleContractAddress);

    await proxy.updateYToken(yTokenContractAddress);
    await proxy.updateStorage();
    strictEqual(proxy.storage.yToken, yTokenContractAddress);

    await oracle.updParamsOracle(
      "BTC-USDT",
      54466755129,
      "2021-08-20T09:06:50Z"
    );
    await oracle.updateStorage();
    var res = await oracle.storage.tokenInfo.get("BTC-USDT");
    strictEqual(res.price.toString(), "54466755129");

    await oracle.updParamsOracle(
      "ETH-USDT",
      54466755129,
      "2021-08-20T09:06:50Z"
    );
    await oracle.updateStorage();
    var res = await oracle.storage.tokenInfo.get("ETH-USDT");
    strictEqual(res.price.toString(), "54466755129");

    await interest.updateYToken(yTokenContractAddress);
    await interest.updateStorage();
    strictEqual(interest.storage.yToken, yTokenContractAddress);

    await yToken.setGlobalFactors(
      "500000000000000000",
      "1050000000000000000",
      proxyContractAddress,
      "12"
    );
    await yToken.updateStorage();
    strictEqual(yToken.storage.storage.priceFeedProxy, proxyContractAddress);
  });

  it("set proxy admin by admin", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await proxy.updateAdmin(bob.pkh);
    await proxy.updateStorage();
    strictEqual(proxy.storage.admin, bob.pkh);
  });

  it("set yToken admin by not admin", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await rejects(yToken.setAdmin(carol.pkh), (err) => {
      ok(err.message == "yToken/not-admin", "Error message mismatch");
      return true;
    });
  });

  it("set yToken admin by admin", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await yToken.setAdmin(bob.pkh);
    await yToken.updateStorage();
    strictEqual(yToken.storage.storage.admin, bob.pkh);
  });

  it("add market [0] by non admin", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await rejects(
      yToken.addMarket(
        interestContractAddress,
        "fA12",
        fa12ContractAddress,
        0,
        500000000000000000,
        500000000000000000,
        5000000000000,
        tokenMetadata
      ),
      (err) => {
        ok(err.message == "yToken/not-admin", "Error message mismatch");
        return true;
      }
    );
  });

  it("add market [0] by admin", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.addMarket(
      interest2ContractAddress,
      "fA12",
      fa12ContractAddress,
      0,
      650000000000000000,
      200000000000000000,
      5000000000000,
      tokenMetadata
    );
    await yToken.updateStorage();
    var r = await yToken.storage.storage.tokenInfo.get(0);
    // strictEqual(await r.mainToken, );

    await proxy.updatePair(0n, "BTC-USDT");
    await proxy.updateStorage();
    strictEqual(await proxy.storage.pairName.get(0), "BTC-USDT");

    let pairId = await proxy.storage.pairId.get("BTC-USDT");
    strictEqual(pairId.toString(), "0");
  });

  // it("update metadata [0] by non admin", async () => {
  //   try {
  //     tezos = await Utils.setProvider(tezos, alice.sk);
  //     await yToken.updMetadata(
  //       0,
  //       tokenMetadata2
  //     );
  //     await yToken.updateStorage();
  //     console.log("no error found!");
  //   }
  //   catch(e) {
  //     console.log('permition');
  //   }
  // });

  // it("update metadata [0] by admin", async () => {
  //   tezos = await Utils.setProvider(tezos, bob.sk);
  //   await yToken.updMetadata(
  //     0,
  //     tokenMetadata2
  //   );
  //   await yToken.updateStorage();
  //   console.log(await yToken.storage.storage.tokenMetadata.get(0));
  // });

  it("add market [1]", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.addMarket(
      interestContractAddress,
      "fA12",
      fa12_2ContractAddress,
      0,
      750000000000000000,
      150000000000000000,
      5000000000000,
      tokenMetadata
    );
    await yToken.updateStorage();
    var r = await yToken.storage.storage.tokenInfo.get(1);
    // strictEqual(r.mainToken, fa12_2ContractAddress);

    await proxy.updatePair(1, "ETH-USDT");
    await proxy.updateStorage();
    strictEqual(await proxy.storage.pairName.get(1), "ETH-USDT");

    let pairId = await proxy.storage.pairId.get("ETH-USDT");
    strictEqual(pairId.toString(), "1");
  });

  it("add market [2]", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.addMarket(
      interestContractAddress,
      "fA2",
      fa2ContractAddress,
      0,
      750000000000000000,
      150000000000000000,
      5000000000000,
      tokenMetadata
    );
    await yToken.updateStorage();
    // var r = await yToken.storage.storage.tokenInfo.get(1);
    // strictEqual(r.mainToken, fa12_2ContractAddress);

    await proxy.updatePair(2, "XTZ-USDT");
    await proxy.updateStorage();
    strictEqual(await proxy.storage.pairName.get(2), "XTZ-USDT");

    let pairId = await proxy.storage.pairId.get("XTZ-USDT");
    strictEqual(pairId.toString(), "2");
  });

  it("mint fa12 tokens by bob and peter", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await fa12.mint(10000000000000000000);
    await fa12.updateStorage();

    let res = await fa12.storage.ledger.get(bob.pkh);

    strictEqual(await res.balance.toString(), "10000000000000000000");

    tezos = await Utils.setProvider(tezos, peter.sk);
    await fa12.mint(10000000000000000000);
    await fa12.updateStorage();

    res = await fa12.storage.ledger.get(peter.pkh);

    strictEqual(await res.balance.toString(), "10000000000000000000");
  });

  it("mint 2 by alice and carol", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await fa12_2.mint(10000000000000000000);
    await fa12_2.updateStorage();

    res = await fa12_2.storage.ledger.get(alice.pkh);

    strictEqual(await res.balance.toString(), "10000000000000000000");

    tezos = await Utils.setProvider(tezos, carol.sk);
    await fa12_2.mint(10000000000000000000);
    await fa12_2.updateStorage();

    res = await fa12_2.storage.ledger.get(carol.pkh);

    strictEqual(await res.balance.toString(), "10000000000000000000");
  });

  it("mint non-existent yToken by alice", async () => {
    await rejects(yToken.mint(32, 1000000), (err) => {
      ok(err.message == "yToken/yToken-undefined", "Error message mismatch");
      return true;
    });
  });

  it("mint yTokens by alice", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await fa12_2.approve(yTokenContractAddress, 100000000000);
    await fa12_2.updateStorage();

    await yToken.mint(1, 10000000000);
    await yToken.updateStorage();

    let res = await fa12_2.storage.ledger.get(alice.pkh);
    strictEqual(await res.balance.toString(), "9999999990000000000");

    let yTokenRes = await yToken.storage.storage.accountInfo.get(alice.pkh);
    let yTokenBalance = await yTokenRes.balances.get("1");

    strictEqual(
      await yTokenBalance.balance.toPrecision(40).split(".")[0],
      "10000000000000000000000000000"
    );
  });

  it("mint yTokens by carol", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);
    await fa12_2.approve(yTokenContractAddress, 100000000000);
    await fa12_2.updateStorage();

    await yToken.updateAndMint(proxy, 1, 10000000000);
    await yToken.updateStorage();

    let res = await fa12_2.storage.ledger.get(carol.pkh);
    strictEqual(await res.balance.toString(), "9999999990000000000");

    let yTokenRes = await yToken.storage.storage.accountInfo.get(carol.pkh);
    let yTokenBalance = await yTokenRes.balances.get("1");

    strictEqual(
      await yTokenBalance.balance.toPrecision(40).split(".")[0],
      "10000000000000000000000000000"
    );
  });

  it("mint yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await fa12.approve(yTokenContractAddress, 100000000000);
    await fa12.updateStorage();

    await yToken.mint(0, 100000);
    await yToken.updateStorage();

    let res = await fa12.storage.ledger.get(bob.pkh);
    strictEqual(await res.balance.toString(), "9999999999999900000");

    let yTokenRes = await yToken.storage.storage.accountInfo.get(bob.pkh);
    let yTokenBalance = await yTokenRes.balances.get("0");
    strictEqual(
      await yTokenBalance.balance.toPrecision(40).split(".")[0],
      "100000000000000000000000"
    );
  });

  it("mint yTokens by peter", async () => {
    tezos = await Utils.setProvider(tezos, peter.sk);
    await fa12.approve(yTokenContractAddress, 100000000000);
    await fa12.updateStorage();

    await yToken.updateAndMint2(proxy, 0, 1000);
    await yToken.updateStorage();

    let res = await fa12.storage.ledger.get(peter.pkh);
    strictEqual(await res.balance.toString(), "9999999999999999000");

    let yTokenRes = await yToken.storage.storage.accountInfo.get(peter.pkh);
    let yTokenBalance = await yTokenRes.balances.get("0");
    strictEqual(
      await yTokenBalance.balance.toPrecision(40).split(".")[0],
      "1000000000000000000000"
    );
  });

  it("enterMarket non-existent yToken by bob", async () => {
    await rejects(yToken.enterMarket(3), (err) => {
      ok(err.message == "yToken/yToken-undefined", "Error message mismatch");
      return true;
    });
  });

  it("enterMarket [0] by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);

    await yToken.enterMarket(0);
    await yToken.updateStorage();
    res = await yToken.storage.storage.accountInfo.get(bob.pkh);
    strictEqual(res.markets.toString(), "0");
  });

  it("enterMarket [0] by peter", async () => {
    tezos = await Utils.setProvider(tezos, peter.sk);

    await yToken.enterMarket(0);
    await yToken.updateStorage();
    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    strictEqual(res.markets.toString(), "0");
  });

  it("enterMarket [1] by alice", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);

    await yToken.enterMarket(1);
    await yToken.updateStorage();
    res = await yToken.storage.storage.accountInfo.get(alice.pkh);
    strictEqual(res.markets.toString(), "1");
  });

  it("borrow yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.updateAndBorrow(proxy, 1, 50000);
    await yToken.updateStorage();

    res = await yToken.storage.storage.accountInfo.get(bob.pkh);
    let balances = await res.balances.get("1");

    strictEqual(
      await balances.borrow.toPrecision(40).split(".")[0],
      "50000000000000000000000"
    );
  });

  it("borrow yTokens by bob (2)", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await Utils.bakeBlocks(tezos, 7);

    await yToken.updateAndBorrow(proxy, 1, 1000);
    await yToken.updateStorage();

    let res = await yToken.storage.storage.accountInfo.get(bob.pkh);
    let balances = await res.balances.get("1");

    console.log(balances.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("borrow yTokens by peter", async () => {
    tezos = await Utils.setProvider(tezos, peter.sk);
    await yToken.updateAndBorrow(proxy, 1, 500);
    await yToken.updateStorage();

    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    let balances = await res.balances.get("1");

    strictEqual(
      await balances.borrow.toPrecision(40).split(".")[0],
      "500000000000000000000"
    );
  });

  it("borrow more than allowed yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);

    await rejects(yToken.updateAndBorrow(proxy, 1, 200000), (err) => {
      ok(
        err.message == "yToken/exceeds-the-permissible-debt",
        "Error message mismatch"
      );
      return true;
    });
  });

  it("borrow more than exists yTokens by alice", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);

    await rejects(yToken.updateAndBorrow2(proxy, 0, 20000000), (err) => {
      ok(err.message == "yToken/amount-too-big", "Error message mismatch");
      return true;
    });
  });

  it("repay yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);

    await fa12_2.approve(yTokenContractAddress, 100000);
    await fa12_2.updateStorage();

    await yToken.updateAndRepay(proxy, 1, 40000);
    await yToken.updateStorage();

    let yTokenRes = await yToken.storage.storage.accountInfo.get(bob.pkh);
    let yTokenBorrow = await yTokenRes.balances.get("1");
    console.log(yTokenBorrow.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("redeem yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await rejects(yToken.updateAndRedeem(proxy, 0, 1), (err) => {
      ok(
        err.message == "yToken/token-taken-as-collateral",
        "Error message mismatch"
      );
      return true;
    });
  });

  it("try exit market yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await rejects(yToken.updateAndExit(proxy, 0), (err) => {
      ok(err.message == "yToken/debt-not-repaid", "Error message mismatch");
      return true;
    });
  });

  it("repay 5 yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);

    await fa12_2.mint(10000);
    await fa12_2.updateStorage();

    let res = await fa12_2.storage.ledger.get(bob.pkh);
    console.log(await res.balance.toString()); // not static result

    let yTokenRes = await yToken.storage.storage.accountInfo.get(bob.pkh);
    let yTokenBalance = await yTokenRes.balances.get("1");
    console.log(yTokenBalance.balance.toPrecision(40).split(".")[0]); // not static result

    await yToken.updateAndRepay(proxy, 1, 0);
    await yToken.updateStorage();

    yTokenRes = await yToken.storage.storage.accountInfo.get(bob.pkh);
    yTokenBalance = await yTokenRes.balances.get("1");
    strictEqual(await yTokenBalance.borrow.toString(), "0");
  });

  it("exit market yTokens by bob", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);

    let res = await yToken.storage.storage.accountInfo.get(bob.pkh);
    strictEqual(await res.markets.toString(), "0");

    await yToken.updateAndExit(proxy, 0);
    await yToken.updateStorage();

    res = await yToken.storage.storage.accountInfo.get(bob.pkh);
    strictEqual(await res.markets.toString(), "");
  });

  it("liquidate not achieved", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);
    await rejects(yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 250), (err) => {
      ok(err.message == "yToken/liquidation-not-achieved", "Error message mismatch");
      return true;
    });
  });

  it("setTokenFactors by non admin", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);
    await rejects(
      yToken.setTokenFactors(0, 0, 0, interestContractAddress, 0),
      (err) => {
        ok(err.message == "yToken/not-admin", "Error message mismatch");
        return true;
      }
    );
  });

  it("setTokenFactors (collateralFactor = 0) by admin", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.updateAndsetTokenFactors(
      proxy,
      0,
      0,
      200000000000000000,
      interest2ContractAddress,
      5000000000000
    );
    await yToken.updateStorage();
  });

  it("liquidate by carol (collateral factor 0)", async () => {
    await oracle.updateStorage();

    tezos = await Utils.setProvider(tezos, carol.sk);

    await yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 250);
    await yToken.updateStorage();

    yTokenRes = await yToken.storage.storage.accountInfo.get(peter.pkh);
    yTokenBalance = await yTokenRes.balances.get("0");
    console.log(await yTokenBalance.balance.toPrecision(40).split(".")[0]); // not static result

    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    balances = await res.balances.get("1");
    console.log(await balances.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("setTokenFactors (return collateralFactor) by admin", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await yToken.updateAndsetTokenFactors(
      proxy,
      0,
      650000000000000000,
      200000000000000000,
      interest2ContractAddress,
      5000000000000
    );
    await yToken.updateStorage();
  });

  it("liquidate not achieved", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);
    await rejects(yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 250), (err) => {
      ok(err.message == "yToken/liquidation-not-achieved", "Error message mismatch");
      return true;
    });
  });

  it("liquidate by carol 2 (collateral price fell)", async () => {
    await oracle.updParamsOracle(
      "BTC-USDT",
      21786702051,
      "2021-08-20T09:06:50Z"
    );
    tezos = await Utils.setProvider(tezos, carol.sk);

    await yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 100);
    await yToken.updateStorage();

    yTokenRes = await yToken.storage.storage.accountInfo.get(peter.pkh);
    yTokenBalance = await yTokenRes.balances.get("0");
    console.log(await yTokenBalance.balance.toPrecision(40).split(".")[0]); // not static result

    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    balances = await res.balances.get("1");
    console.log(await balances.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("liquidate by carol 3 (collateral price fell)", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);

    await yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 75);
    await yToken.updateStorage();

    yTokenRes = await yToken.storage.storage.accountInfo.get(peter.pkh);
    yTokenBalance = await yTokenRes.balances.get("0");
    console.log(await yTokenBalance.balance.toPrecision(40).split(".")[0]); // not static result

    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    balances = await res.balances.get("1");
    console.log(await balances.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("liquidate by carol 4 (collateral price fell)", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);

    await yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 37);
    await yToken.updateStorage();

    yTokenRes = await yToken.storage.storage.accountInfo.get(peter.pkh);
    yTokenBalance = await yTokenRes.balances.get("0");
    console.log(await yTokenBalance.balance.toPrecision(40).split(".")[0]); // not static result

    res = await yToken.storage.storage.accountInfo.get(peter.pkh);
    balances = await res.balances.get("1");
    console.log(await balances.borrow.toPrecision(40).split(".")[0]); // not static result
  });

  it("liquidate not achieved", async () => {
    tezos = await Utils.setProvider(tezos, carol.sk);
    await rejects(yToken.updateAndLiq(proxy, 1, 0, peter.pkh, 19), (err) => {
      ok(err.message == "yToken/liquidation-not-achieved", "Error message mismatch");
      return true;
    });
  });
});
