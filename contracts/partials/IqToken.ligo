type borrows is
  record [
    amount           :nat;
    lastBorrowIndex  :nat;
    allowances       :map (address, nat);
  ]

type tokenStorage is
  record [
    owner           :address;
    admin           :address;
    token           :address;
    lastUpdateTime  :timestamp;
    totalBorrows    :nat;
    totalLiquid     :nat;
    totalSupply     :nat;
    totalReserves   :nat;
    borrowIndex     :nat;
    accountBorrows  :big_map(address, borrows);
    accountTokens   :big_map(address, nat);
  ]

type return is list (operation) * tokenStorage
[@inline] const noOperations : list (operation) = nil;

type transferParams is michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
type transferType is TransferOuttside of michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
type approveParams is michelson_pair(address, "spender", nat, "value")
type balanceParams is michelson_pair(address, "owner", contract(nat), "")
type allowanceParams is michelson_pair(michelson_pair(address, "owner", address, "spender"), "", contract(nat), "")
type totalSupplyParams is (unit * contract(nat))

type mintParams is 
  record [
    user           :address;
    amount         :nat;
  ]

type redeemParams is 
  record [
    user           :address;
    amount         :nat;
  ]

type borrowParams is 
  record [
    user           :address;
    amount         :nat;
  ]

type repayParams is 
  record [
    user           :address;
    amount         :nat;
  ]

type liquidateParams is michelson_pair(address, "liquidator", michelson_pair(address, "borrower", nat, "amount"), "")

type useAction is
  | SetAdmin of address
  | SetOwner of address
  | Mint of mintParams
  | Redeem of redeemParams
  | Borrow of borrowParams
  | Repay of repayParams
  | Liquidate of liquidateParams

type tokenAction is
  | ITransfer of transferParams
  | IApprove of approveParams
  | IGetBalance of balanceParams
  | IGetAllowance of allowanceParams
  | IGetTotalSupply of totalSupplyParams

type entryAction is
  | Transfer of transferParams
  | Approve of approveParams
  | GetBalance of balanceParams
  | GetAllowance of allowanceParams
  | GetTotalSupply of totalSupplyParams
  | Use of useAction


type useFunc is (useAction * tokenStorage * address) -> return
type tokenFunc is (tokenAction * tokenStorage) -> return

type fullTokenStorage is record
  storage          : tokenStorage; (* real token storage *)
  tokenLambdas     : big_map(nat, tokenFunc); (* map with exchange-related functions code *)
  useLambdas       : big_map(nat, useFunc); (* map with exchange-related functions code *)
end

type fullReturn is list (operation) * fullTokenStorage
