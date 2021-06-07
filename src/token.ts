import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts";
import {
  RawrToken,
  TokenCreated,
  Transfer
} from "../generated/RawrToken/RawrToken";
import { 
  Token,
  TokenBalance,
  Account,
  Supply
} from "../generated/schema";
import {
  createToken,
  createSupply,
  createAccount,
  createTokenBalance,
  getTokenBalanceId
} from "./token-helpers";

import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";

export function handleTokenCreated(event: TokenCreated): void {
  // let tokenId = crypto.keccak256(event.params.name.).toHexString();
  let tokenId = event.params.id.toHex();
  let token = Token.load(tokenId);
  if (token == null) {
    token = createToken(tokenId, event.params.addr);
  }
  let supply = Supply.load(tokenId);
  if (supply == null) {
    supply = createSupply(tokenId);
  }

  token.contractAddress = event.params.addr;
  token.name = event.params.name.toString();
  token.symbol = event.params.symbol.toString();
  token.createdAt = event.block.timestamp;
  token.supply = tokenId;
  token.save();

  // Update supply
  supply.token = tokenId;
  supply.initialSupply = event.params.supply;
  supply.save();
}

export function handleTransfer(event: Transfer): void {  
  // Add the amount to that user's TokenBalance
  let tokenContract = RawrToken.bind(event.address);
  let tokenId = tokenContract.tokenId().toHex();
  let token = Token.load(tokenId);
  if (token == null) {
    token = createToken(tokenId, event.address);
  }
  let supply = Supply.load(tokenId);
  if (supply == null) {
    supply = createSupply(tokenId);
  }

  if (event.params.to.toHex() != ADDRESS_ZERO) {
    // There is a receiver
    // Get User To and add if it doesn't exist
    let userToId = event.params.to.toHex();
    let userTo = Account.load(userToId);
    if (userTo == null) {
      // Add new owner and increment token number of owners
      userTo = createAccount(userToId, event.params.to);
      token.numberOfOwners = token.numberOfOwners.plus(ONE_BI);
    }

    let tokenBalanceId = getTokenBalanceId(event.address.toHexString(), event.params.to.toHexString());
    let tokenBalance = TokenBalance.load(tokenBalanceId);
    if (tokenBalance == null) {
        tokenBalance = createTokenBalance(tokenBalanceId, tokenContract.tokenId().toHex(), event.params.to.toHex());
    }
    tokenBalance.amount = tokenBalance.amount.plus(event.params.value);
    tokenBalance.save()
  }
  else
  {
    // Tokens are being burnt
    supply.lastBurnAt = event.block.timestamp;
    supply.currentSupply = supply.currentSupply.minus(event.params.value);
    supply.numberOfBurns = supply.numberOfBurns.plus(ONE_BI);
  }

  if (event.params.from.toHex() != ADDRESS_ZERO) {
    // Subract the amount to the User from's token balance (if address is not null)
    let tokenBalanceId = getTokenBalanceId(event.address.toHexString(), event.params.from.toHexString());
    let tokenBalance = TokenBalance.load(tokenBalanceId);
    if (tokenBalance != null) {
      tokenBalance.amount = tokenBalance.amount.minus(event.params.value);
      tokenBalance.save()

      // if sender's balance is 0
      if (tokenBalance.amount == ZERO_BI) {
        token.numberOfOwners = token.numberOfOwners.minus(ONE_BI);
      }
    }
  }
  else
  {
    // Tokens are being minted
    supply.lastMintAt = event.block.timestamp;
    supply.currentSupply = supply.currentSupply.plus(event.params.value);
    supply.numberOfMints = supply.numberOfMints.plus(ONE_BI);
  }
  token.save();
  supply.save();
}