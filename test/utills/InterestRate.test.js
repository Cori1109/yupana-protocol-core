const { alice, bob, carol } = require("../scripts/sandbox/accounts");

const { strictEqual } = require("assert");

const { InterestRate } = require("../test/utills/InterestRate");
const { SendRate } = require("../test/utills/SendRate");
const { Utils } = require("../test/utills/Utils");

const { confirmOperation } = require("../scripts/confirmation");

describe("Interest tests", async () => {
  let tezos;
  let interest;
  let sendRate;

  before("setup Interest", async () => {
    tezos = await Utils.initTezos();
    interest = await InterestRate.originate(tezos);
    sendRate = await SendRate.originate(tezos);

    interestContractAddress = interest.contract.address;
    sendRateContractAddress = sendRate.contract.address;

    tezos = await Utils.setProvider(tezos, alice.sk);

    let operation = await tezos.contract.transfer({
      to: carol.pkh,
      amount: 50000000,
      mutez: true,
    });
    await confirmOperation(tezos, operation.hash);

    await sendRate.setInterestRate(interestContractAddress);
    await sendRate.updateStorage();
    strictEqual(sendRate.storage.interestAddress, interestContractAddress);

    await interest.updateYToken(sendRateContractAddress);
    await interest.updateStorage();
    strictEqual(interest.storage.yToken, sendRateContractAddress);
  });

  it("set InterestRate admin", async () => {
    tezos = await Utils.setProvider(tezos, alice.sk);
    await interest.updateAdmin(bob.pkh);
    await interest.updateStorage();
    strictEqual(interest.storage.admin, bob.pkh);
  });

  it("set InterestRate coef", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    await interest.setCoefficients(100, 200, 300, 400);
    await interest.updateStorage();

    strictEqual(await interest.storage.kickRateFloat.toString(), "100");
    strictEqual(await interest.storage.baseRateFloat.toString(), "200");
    strictEqual(await interest.storage.multiplierFloat.toString(), "300");
    strictEqual(await interest.storage.jumpMultiplierFloat.toString(), "400");
  });

  it("send UtilizationRate", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    var borrows = 100;
    var cash = 100000;
    var reserves = 10;
    var formula = (cash + borrows - reserves) / borrows;
    await sendRate.sendUtil(0, borrows, cash, reserves);
    await sendRate.updateStorage();

    strictEqual(
      await sendRate.storage.utilRate.toString(),
      Math.floor(formula).toString()
    );
  });

  it("send BorrowRate", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    var borrows = 100;
    var cash = 100000;
    var reserves = 10;

    var formula = 100 * 300 + 200 + (1000 - 100) * 400;

    await sendRate.sendBorrow(0, borrows, cash, reserves);
    await sendRate.updateStorage();

    strictEqual(
      await sendRate.storage.borrowRate.toString(),
      formula.toString()
    );
  });

  it("send SupplyRate", async () => {
    tezos = await Utils.setProvider(tezos, bob.sk);
    var borrows = 100;
    var cash = 100000;
    var reserves = 10;

    var borrowFormula = 100 * 300 + 200 + (1000 - 100) * 400;
    var utilFormula = (cash + borrows - reserves) / borrows;
    var formula =
      borrowFormula * Math.floor(utilFormula) * (1000000000000000000 - 250);

    await sendRate.sendSupply(0, borrows, cash, reserves);
    await sendRate.updateStorage();

    strictEqual(
      await Math.floor(sendRate.storage.supplyRate).toString(),
      Math.floor(formula).toString()
    );
  });
});
