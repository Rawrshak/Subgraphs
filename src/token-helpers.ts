import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts";

import { 
  Token,
  TokenBalance,
  Account,
  Supply
} from "../generated/schema";

import { ZERO_BI } from "./constants";
  
export function createToken(id: string, address: Address): Token {
  let token = new Token(id);
  token.contractAddress = address;
  token.numberOfOwners = ZERO_BI;
  token.name = "";
  token.symbol = "";
  token.createdAt = ZERO_BI;
  token.supply = "";
  token.save();
  return token;
}
  
export function createSupply(id: string): Supply {
  let supply = new Supply(id);
  supply.token = id;
  supply.numberOfMints = ZERO_BI;
  supply.numberOfBurns = ZERO_BI;
  supply.initialSupply = ZERO_BI;
  supply.currentSupply = ZERO_BI;
  supply.lastMintAt = ZERO_BI;
  supply.lastBurnAt = ZERO_BI;
  supply.save();
  return supply;
}
  
export function createTokenBalance(id: string, tokenId: string, owner: string): TokenBalance {
  let tokenBalance = new TokenBalance(id);
  tokenBalance.amount = ZERO_BI;
  tokenBalance.token = tokenId;
  tokenBalance.owner = owner;
  tokenBalance.save();
  return tokenBalance;
}
  
export function createAccount(id: string, address: Address): Account {
  let account = new Account(id);
  account.address = address;
  account.save();
  return account;
}

export function getTokenBalanceId(tokenAddress: string, owner: string): string {
  return tokenAddress.concat('-').concat(owner);
}

// Helper for concatenating two byte arrays
function concat(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length)
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i]
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j]
  }
  return out as ByteArray
}