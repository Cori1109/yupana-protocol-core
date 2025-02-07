type proxyStorage       is [@layout:comb] record [
  admin                 : address;
  oracle                : address;
  yToken                : address;
  pairName              : big_map(tokenId, string);
  pairId                : big_map(string, tokenId);
]
