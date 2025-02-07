#include "../partial/mainTypes.ligo"
#include "../partial/yToken/lendingMethods.ligo"

function setUseAction(
  const idx             : nat;
  const lambda_bytes    : bytes;
  var s                 : fullTokenStorage)
                        : fullReturn is
  block {
    if Tezos.sender = s.storage.admin
    then case s.useLambdas[idx] of
        Some(_n) -> failwith("yToken/yToken-function-not-set")
        | None -> s.useLambdas[idx] := lambda_bytes
      end;
    else failwith("yToken/you-not-admin")
  } with (noOperations, s)

function setTokenAction(
  const idx             : nat;
  const lambda_bytes    : bytes;
  var s                 : fullTokenStorage)
                        : fullReturn is
  block {
    if Tezos.sender = s.storage.admin
    then case s.tokenLambdas[idx] of
        Some(_n) -> failwith("yToken/token-function-not-set")
        | None -> s.tokenLambdas[idx] := lambda_bytes
      end;
    else failwith("yToken/you-not-admin")
  } with (noOperations, s)

function middleToken(
  const p               : tokenAction;
  var s                 : fullTokenStorage)
                        : fullReturn is
  block {
    const idx : nat = case p of
      | ITransfer(_transferParams) -> 0n
      | IUpdateOperators(_updateOperatorParams) -> 1n
      | IBalanceOf(_balanceParams) -> 2n
      | IGetTotalSupply(_totalSupplyParams) -> 3n
    end;

    const lambda_bytes : bytes =
      case s.useLambdas[idx] of
        | Some(l) -> l
        | None -> failwith("yToken/middle-token-function-not-set")
      end;

    const res : return =
      case (Bytes.unpack(lambda_bytes) : option(tokenFunc)) of
        | Some(f) -> f(p, s.storage)
        | None -> failwith("cant-unpack-use-lambda")
      end;

    s.storage := res.1;
  } with (res.0, s)

[@inline] function middleUse(
  const p               : useAction;
  var s                 : fullTokenStorage)
                        : fullReturn is
  block {
      const idx : nat = case p of
        | Mint(_yAssetParams) -> 0n
        | Redeem(_yAssetParams) -> 1n
        | Borrow(_yAssetParams) -> 2n
        | Repay(_yAssetParams) -> 3n
        | Liquidate(_liquidateParams) -> 4n
        | EnterMarket(_tokenId) -> 5n
        | ExitMarket(_tokenId) -> 6n
      end;

    const lambda_bytes : bytes =
      case s.useLambdas[idx] of
        | Some(l) -> l
        | None -> failwith("yToken/middle-yToken-function-not-set")
      end;

    const res : return =
      case (Bytes.unpack(lambda_bytes) : option(useFunc)) of
        | Some(f) -> f(p, s.storage)
        | None -> failwith("cant-unpack-use-lambda")
      end;

    s.storage := res.1;
  } with (res.0, s)

function main(
  const p               : entryAction;
  const s               : fullTokenStorage)
                        : fullReturn is
  case p of
    | Transfer(params)              -> middleToken(ITransfer(params), s)
    | UpdateOperators(params)       -> middleToken(IUpdateOperators(params), s)
    | BalanceOf(params)             -> middleToken(IBalanceOf(params), s)
    | GetTotalSupply(params)        -> middleToken(IGetTotalSupply(params), s)
    | UpdateInterest(params)        -> updateInterest(params, s)
    | AccrueInterest(params)        -> accrueInterest(params, s)
    | GetReserveFactor(params)      -> getReserveFactor(params, s)
    | ReturnPrice(params)           -> returnPrice(params, s)
    | SetAdmin(params)              -> setAdmin(params, s)
    | WithdrawReserve(params)       -> withdrawReserve(params, s)
    | AddMarket(params)             -> addMarket(params, s)
    // | UpdateMetadata(params)        -> updateMetadata(params, s)
    | SetTokenFactors(params)       -> setTokenFactors(params, s)
    | SetGlobalFactors(params)      -> setGlobalFactors(params, s)
    | Use(params)                   -> middleUse(params, s)
    | SetUseAction(params)          -> setUseAction(params.index, params.func, s)
    | SetTokenAction(params)        -> setTokenAction(params.index, params.func, s)
  end
