function getBorrows (const addr : address; const s : tokenStorage) : borrows is
  block {
    var b : borrows :=
      record [
        amount          = 0n;
        lastBorrowIndex = 0n;
        allowances = (map [] : map (address, nat));
      ];
    case s.accountBorrows[addr] of
      None -> skip
    | Some(value) -> b := value
    end;
  } with b

function getTokens (const addr : address; const s : tokenStorage) : nat is
  case s.accountTokens[addr] of
    Some (value) -> value
  | None -> 0n
  end;

function getAllowance (const borrw : borrows; const spender : address; const s : tokenStorage) : nat is
  case borrw.allowances[spender] of
    Some (nat) -> nat
  | None -> 0n
  end;

function transfer (const p : tokenAction; const s : tokenStorage) : return is 
  block {
    var operations : list(operation) := list[];
      case p of
      | ITransfer(args) -> {
        const senderAccount : borrows = getBorrows(args.0, s);
        const accountTokensFrom : nat = getTokens(args.0, s);

        if accountTokensFrom < args.1.1 then
          failwith("NotEnoughBalance")
        else skip;

        if args.0 =/= Tezos.sender then block {
          const spenderAllowance : nat = getAllowance(senderAccount, Tezos.sender, s);

          if spenderAllowance < args.1.1 then
            failwith("NotEnoughAllowance")
          else skip;

          senderAccount.allowances[Tezos.sender] := abs(spenderAllowance - args.1.1);
        } else skip;

        accountTokensFrom := abs(accountTokensFrom - args.1.1);

        const accountTokensTo : nat = getTokens(args.1.0, s);
        accountTokensTo := accountTokensTo + args.1.1;
      }
      | IApprove(approveParams) -> skip
      | IGetBalance(balanceParams) -> skip
      | IGetAllowance(allowanceParams) -> skip
      | IGetTotalSupply(totalSupplyParams) -> skip
    end
  } with (operations, s)

function approve (const p : tokenAction; const s : tokenStorage) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | ITransfer(transferParams) -> skip
      | IApprove(args) -> {
        var senderAccount : borrows := getBorrows(Tezos.sender, s);
        const spenderAllowance : nat = getAllowance(senderAccount, args.0, s);

        if spenderAllowance > 0n and args.1 > 0n then
          failwith("UnsafeAllowanceChange")
        else skip;

        senderAccount.allowances[args.0] := args.1;
        s.accountBorrows[Tezos.sender] := senderAccount;
      }
      | IGetBalance(balanceParams) -> skip
      | IGetAllowance(allowanceParams) -> skip
      | IGetTotalSupply(totalSupplyParams) -> skip
    end
  } with (operations, s)

function getBalance (const p : tokenAction; const s : tokenStorage) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | ITransfer(transferParams) -> skip
      | IApprove(approveParams) -> skip
      | IGetBalance(args) -> {
        const accountTokens : nat = getTokens(args.0, s);
        operations := list [transaction(accountTokens, 0tz, args.1)];
      }
      | IGetAllowance(allowanceParams) -> skip
      | IGetTotalSupply(totalSupplyParams) -> skip
    end
  } with (operations, s)

function getAllowance (const p : tokenAction; const s : tokenStorage) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | ITransfer(transferParams) -> skip
      | IApprove(approveParams) -> skip
      | IGetBalance(balanceParams) -> skip
      | IGetAllowance(args) -> {
        const ownerAccount : borrows = getBorrows(args.0.0, s);
        const spenderAllowance : nat = getAllowance(ownerAccount, args.0.1, s);
        operations := list [transaction(spenderAllowance, 0tz, args.1)];
      }
      | IGetTotalSupply(totalSupplyParams) -> skip
    end
  } with (operations, s)

function getTotalSupply (const p : tokenAction; const s : tokenStorage) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | ITransfer(transferParams) -> skip
      | IApprove(approveParams) -> skip
      | IGetBalance(balanceParams) -> skip
      | IGetAllowance(allowanceParams) -> skip
      | IGetTotalSupply(args) -> {
        operations := list [transaction(s.totalSupply, 0tz, args.1)];
      }
    end
  } with (operations, s)

function getTokenContract (const tokenAddress : address) : contract(transferType) is 
  case (Tezos.get_entrypoint_opt("%transfer", tokenAddress) : option(contract(transferType))) of 
    Some(contr) -> contr
    | None -> (failwith("CantGetContractToken") : contract(transferType))
  end;

[@inline] function mustBeOwner (const s : tokenStorage) : unit is
  block {
    if Tezos.sender =/= s.owner then
      failwith("NotOwner")
    else skip;
  } with (unit)

[@inline] function mustBeAdmin (const s : tokenStorage) : unit is
  block {
    if Tezos.sender =/= s.admin then
      failwith("NotAdmin")
    else skip;
  } with (unit)

function setAdmin (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(addr) -> {
        mustBeOwner(s);
        s.admin := addr;
      }
      | SetOwner(address) -> skip
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> skip
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function setOwner (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(addr) -> {
        mustBeOwner(s);
        s.owner := addr;
      }
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> skip
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function updateInterest (var s : tokenStorage) : tokenStorage is
  block {
    const hundredPercent : nat = 10000000000000000n;
    const apr : nat = 250000000000000n; // 2.5% (0.025)
    const utilizationBase : nat = 2000000000000000n; // 20% (0.2)
    const secondsPerYear : nat = 31536000n;
    const reserveFactor : nat = 10000000000000n;// 0.1% (0.001)
    const utilizationBasePerSec : nat = 63419584n; // utilizationBase / secondsPerYear; 0.0000000063419584
    const debtRatePerSec : nat = 7927448n; // apr / secondsPerYear; 0.0000000007927448

    const utilizationRate : nat = s.totalBorrows / abs(s.totalLiquid + s.totalBorrows - s.totalReserves);
    const borrowRatePerSec : nat = (utilizationRate * utilizationBasePerSec + debtRatePerSec) / hundredPercent;
    const simpleInterestFactor : nat = borrowRatePerSec * abs(Tezos.now - s.lastUpdateTime);
    const interestAccumulated : nat = simpleInterestFactor * s.totalBorrows;

    s.totalBorrows := interestAccumulated + s.totalBorrows;
    s.totalReserves := interestAccumulated * reserveFactor / hundredPercent + s.totalReserves;
    s.borrowIndex := simpleInterestFactor * s.borrowIndex + s.borrowIndex;
  } with (s)

function mint (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(address) -> skip
      | Mint(mintParams) -> {
        mustBeAdmin(s);
        s := updateInterest(s);

        const exchangeRate : nat = abs(s.totalLiquid + s.totalBorrows - s.totalReserves) / s.totalSupply;
        const mintTokens : nat = mintParams.amount / exchangeRate;

        const accountTokens : nat = getTokens(mintParams.user, s);
        s.accountTokens[mintParams.user] := accountTokens + mintTokens;
        s.totalSupply := s.totalSupply + mintTokens;
        s.totalLiquid := s.totalLiquid + mintParams.amount;

        operations := list [
          Tezos.transaction(
            TransferOuttside(mintParams.user, (this, mintParams.amount)), 
            0mutez, 
            getTokenContract(s.token)
          )
        ];
      }
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> skip
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function redeem (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(address) -> skip
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> {
        mustBeAdmin(s);
        s := updateInterest(s);

        var burnTokens : nat := 0n;
        const accountTokens : nat = getTokens(redeemParams.user, s);
        var exchangeRate : nat := abs(s.totalLiquid + s.totalBorrows - s.totalReserves) / s.totalSupply;

        if exchangeRate = 0n then
          failwith("NotEnoughTokensToSendToUser")
        else skip;

        if redeemParams.amount = 0n then
          redeemParams.amount := accountTokens;
        else skip;
        burnTokens := redeemParams.amount / exchangeRate;

        
        s.accountTokens[redeemParams.user] := abs(accountTokens - burnTokens);
        s.totalSupply := abs(s.totalSupply - burnTokens);
        s.totalLiquid := abs(s.totalLiquid - redeemParams.amount);

        operations := list [
          Tezos.transaction(
            TransferOuttside(this, (redeemParams.user, redeemParams.amount)),
            0mutez, 
            getTokenContract(s.token))
        ]
      }
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> skip
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function borrow (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(address) -> skip
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> {
        mustBeAdmin(s);
        if s.totalLiquid < borrowParams.amount then
          failwith("AmountTooBig")
        else skip;
        s := updateInterest(s);

        var accountBorrows : borrows := getBorrows(borrowParams.user, s);
        accountBorrows.amount := accountBorrows.amount + borrowParams.amount;
        accountBorrows.lastBorrowIndex := s.borrowIndex;

        s.accountBorrows[borrowParams.user] := accountBorrows;
        s.totalBorrows := s.totalBorrows + borrowParams.amount;

        operations := list [
          Tezos.transaction(
            TransferOuttside(this, (Tezos.sender, borrowParams.amount)), 
            0mutez, 
            getTokenContract(s.token)
          )
        ]
      }
      | Repay(repayParams) -> skip
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function repay (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(address) -> skip
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> {
        mustBeAdmin(s);
        s := updateInterest(s);

        var accountBorrows : borrows := getBorrows(repayParams.user, s);
        accountBorrows.amount := accountBorrows.amount * s.borrowIndex / accountBorrows.lastBorrowIndex;
        accountBorrows.amount := abs(accountBorrows.amount - repayParams.amount);
        accountBorrows.lastBorrowIndex := s.borrowIndex;

        s.accountBorrows[repayParams.user] := accountBorrows;
        s.totalBorrows := abs(s.totalBorrows - repayParams.amount);

        operations := list [
          Tezos.transaction(
            TransferOuttside(Tezos.sender, (this, repayParams.amount)), 
            0mutez, 
            getTokenContract(s.token)
          )
        ]
      }
      | Liquidate(liquidateParams) -> skip
    end
  } with (operations, s)

function liquidate (const p : useAction; const s : tokenStorage; const this: address) : return is
  block {
    var operations : list(operation) := list[];
      case p of
      | SetAdmin(address) -> skip
      | SetOwner(address) -> skip
      | Mint(mintParams) -> skip
      | Redeem(redeemParams) -> skip
      | Borrow(borrowParams) -> skip
      | Repay(repayParams) -> skip
      | Liquidate(args) -> {
        mustBeAdmin(s);
        s := updateInterest(s);
        if args.0 = args.1.0 then
          failwith("BorrowerCannotBeLiquidator")
        else skip;

        var debtorBorrows : borrows := getBorrows(args.1.0, s);
        if args.1.1 = 0n then
          args.1.1 := debtorBorrows.amount
        else skip;


        const hundredPercent : nat = 1000000000n;
        const liquidationIncentive : nat = 1050000000n;// 1050000000 105% (1.05)
        const exchangeRate : nat = abs(s.totalLiquid + s.totalBorrows - s.totalReserves) / s.totalSupply;
        const seizeTokens : nat = args.1.1 * liquidationIncentive / hundredPercent / exchangeRate;

        debtorBorrows.amount := debtorBorrows.amount * s.borrowIndex / debtorBorrows.lastBorrowIndex;
        debtorBorrows.amount := abs(debtorBorrows.amount - seizeTokens);
        debtorBorrows.lastBorrowIndex := s.borrowIndex;

        s.accountBorrows[args.1.0] := debtorBorrows;
        s.accountTokens[args.0] := getTokens(args.0, s) + seizeTokens;

        operations := list [
          Tezos.transaction(
            TransferOuttside(Tezos.sender, (this, args.1.1)), 
            0mutez,
            getTokenContract(s.token)
          )
        ]
      }
    end
  } with (operations, s)