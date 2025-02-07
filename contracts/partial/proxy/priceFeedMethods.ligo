function mustBeAdmin(
  const s               : proxyStorage)
                        : unit is
  if Tezos.sender =/= s.admin
  then failwith("proxy/not-admin")
  else unit

[@inline] function mustBeOracle(
  const s               : proxyStorage)
                        : unit is
  if Tezos.sender =/= s.oracle
  then failwith("proxy/not-oracle")
  else unit

[@inline] function getNormalizerContract(
  const oracleAddress   : address)
                        : contract(getType) is
  case (
    Tezos.get_entrypoint_opt("%get", oracleAddress)
                        : option(contract(getType))
  ) of
    Some(contr) -> contr
    | None -> (
      failwith("proxy/cant-get-oracle") : contract(getType)
    )
  end;

[@inline] function getReceivePriceEntrypoint(
  const contractAddress : address)
                        : contract(oracleParam) is
  case (
    Tezos.get_entrypoint_opt("%receivePrice", contractAddress)
                        : option(contract(oracleParam))
  ) of
    Some(contr) -> contr
    | None -> (
      failwith("proxy/cant-get-receivePrice") : contract(oracleParam)
    )
  end;

[@inline] function getYtokenContract(
  const s               : proxyStorage)
                        : contract(yAssetParams) is
  case (
    Tezos.get_entrypoint_opt("%returnPrice", s.yToken)
                        : option(contract(yAssetParams))
  ) of
    Some(contr) -> contr
    | None -> (
      failwith("proxy/cant-get-yToken") : contract(yAssetParams)
    )
  end;

[@inline] function checkPairName(
  const tokenId         : tokenId;
  const s               : proxyStorage)
                        : string is
  case s.pairName[tokenId] of
    | Some(v) -> v
    | None -> (failwith("checkPairName/string-not-defined") : string)
  end;

[@inline] function checkPairId(
  const pairName        : string;
  const s               : proxyStorage)
                        : nat is
  case s.pairId[pairName] of
    | Some(v) -> v
    | None -> (failwith("checkPairId/tokenId-not-defined") : nat)
  end;

function setProxyAdmin(
  const addr            : address;
  var s                 : proxyStorage)
                        : proxyReturn is
  block {
    mustBeAdmin(s);
    s.admin := addr;
  } with (noOperations, s)

function updateOracle(
  const addr            : address;
  var s                 : proxyStorage)
                        : proxyReturn is
  block {
    mustBeAdmin(s);
    s.oracle := addr;
  } with (noOperations, s)

function updateYToken(
  const addr            : address;
  var s                 : proxyStorage)
                        : proxyReturn is
  block {
    mustBeAdmin(s);
    s.yToken := addr;
  } with (noOperations, s)


function receivePrice(
  const param           : oracleParam;
  const s               : proxyStorage)
                        : proxyReturn is
  block {
    mustBeOracle(s);
    const tokenId : nat = checkPairId(param.0, s);
    var operations : list(operation) := list[
      Tezos.transaction(
        record [
          tokenId = tokenId;
          amount = param.1.1;
        ],
        0mutez,
        getYtokenContract(s)
      )
    ];
  } with (operations, s)

function getPrice(
  const tokenSet        : set(nat);
  const s               : proxyStorage)
                        : proxyReturn is
  block {
    var operations : list(operation) := list [];
    function oneTokenUpd(
      var operations    : list(operation);
      const tokenId     : nat)
                        : list(operation) is
      block {
        const strName : string = checkPairName(tokenId, s);
        const param : contract(oracleParam) = getReceivePriceEntrypoint(
          Tezos.self_address
        );

        operations := Tezos.transaction(
          Get(strName, param),
          0mutez,
          getNormalizerContract(s.oracle)
        ) # operations
      } with operations;

      operations := Set.fold(
        oneTokenUpd,
        tokenSet,
        operations
      );
  } with (operations, s)

function updatePair(
  const param           : pairParam;
  var s                 : proxyStorage)
                        : proxyReturn is
  block {
    mustBeAdmin(s);
    s.pairName[param.tokenId] := param.pairName;
    s.pairId[param.pairName] := param.tokenId;
  } with (noOperations, s)
