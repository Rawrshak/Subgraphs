import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"
import {
  RawrToken,
  TokenCreated,
  Transfer
} from "../generated/RawrToken/RawrToken"
import { 
  Token,
  TokenBalance,
  Account,
  Supply
 } from "../generated/schema"
//  import {Address} from "@graphprotocol/graph-ts/index";

let zeroAddress = '0x0000000000000000000000000000000000000000';

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
//   supply.currentSupply = event.params.supply;
//   if (event.params.supply != BigInt.fromI32(0)) {
//     supply.lastMintAt = event.block.timestamp;
//     supply.numberOfMints = BigInt.fromI32(1);
//   }
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

  if (event.params.to.toHex() != zeroAddress) {
    // There is a receiver
    // Get User To and add if it doesn't exist
    let userToId = event.params.to.toHex();
    let userTo = Account.load(userToId);
    if (userTo == null) {
      // Add new owner and increment token number of owners
      userTo = createAccount(userToId, event.params.to);
      token.numberOfOwners = token.numberOfOwners.plus(BigInt.fromI32(1));
    }
    userTo.save();

    let tokenBalanceId = createTokenBalanceId(event.address.toHexString(), event.params.to.toHexString());
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
    supply.numberOfBurns = supply.numberOfBurns.plus(BigInt.fromI32(1));
  }

  if (event.params.from.toHex() != zeroAddress) {
    // Subract the amount to the User from's token balance (if address is not null)
    let tokenBalanceId = createTokenBalanceId(event.address.toHexString(), event.params.from.toHexString());
    let tokenBalance = TokenBalance.load(tokenBalanceId);
    if (tokenBalance != null) {
      tokenBalance.amount = tokenBalance.amount.minus(event.params.value);
      tokenBalance.save()

      // if sender's balance is 0
      if (tokenBalance.amount == BigInt.fromI32(0)) {
        token.numberOfOwners = token.numberOfOwners.minus(BigInt.fromI32(1));
      }
    }
  }
  else
  {
    // Tokens are being minted
    supply.lastMintAt = event.block.timestamp;
    supply.currentSupply = supply.currentSupply.plus(event.params.value);
    supply.numberOfMints = supply.numberOfMints.plus(BigInt.fromI32(1));
  }
  token.save();
  supply.save();
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

function createToken(id: string, address: Address): Token {
    let token = new Token(id);
    token.contractAddress = address;
    token.numberOfOwners = BigInt.fromI32(0);
    return token;
}

function createSupply(id: string): Supply {
    let supply = new Supply(id);
    supply.token = id;
    supply.numberOfMints = BigInt.fromI32(0);
    supply.numberOfBurns = BigInt.fromI32(0);
    return supply;
}

function createTokenBalance(id: string, tokenId: string, owner: string): TokenBalance {
    let tokenBalance = new TokenBalance(id);
    tokenBalance.amount = BigInt.fromI32(0);
    tokenBalance.token = tokenId;
    tokenBalance.owner = owner;
    return tokenBalance;
}

function createAccount(id: string, address: Address): Account {
    let account = new Account(id);
    account.address = address;
    return account;
}

// Todo: change owner from 'string' to 'Address'. Keep it for now for readability though
function createTokenBalanceId(tokenAddress: string, owner: string): string {
  return tokenAddress.concat('-').concat(owner);
}