import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import { 
    AddressResolver as Resolver,
    Exchange,
    TokenEscrow,
    Token,
    Order,
    Asset,
    Account,
    OrderFill,
    UserRoyalty,
} from "../generated/schema";

import { ADDRESS_ZERO, ZERO_BI } from "./constants";

export function createAddressResolver(id: Address): Resolver {
    let resolver = new Resolver(id.toHexString());
    resolver.save();
    return resolver;
}

export function createExchange(address: Address): Exchange {
    let exchange = new Exchange(address.toHexString());
    exchange.orders = [];
    exchange.numOfOrders = ZERO_BI;
    exchange.numOfBuyOrders = ZERO_BI;
    exchange.numOfSellOrders = ZERO_BI;
    exchange.save();
    return exchange;
}
  
export function createTokenEscrow(address: Address): TokenEscrow {
    let tokenEscrow = new TokenEscrow(address.toHexString());
    tokenEscrow.supportedTokens = [];
    tokenEscrow.save();
    return tokenEscrow;
}
  
export function createToken(address: Address, escrow: Address): Token {
    let token = new Token(address.toHexString());
    token.address = address;
    token.escrow = escrow.toHexString();
    token.totalVolume = ZERO_BI;
    token.save();
    return token;
}

export function createOrder(id: BigInt, assetId: string, owner: string): Order {
    let order = new Order(id.toHexString());
    order.asset = assetId;
    order.owner = owner;
    order.amountOrdered = ZERO_BI;
    order.amountFilled = ZERO_BI;
    order.status = "Ready";
    order.dateCreated = ZERO_BI;
    order.dateFilled = ZERO_BI;
    order.dateCancelled = ZERO_BI;
    order.dateClaimed = ZERO_BI;
    order.save();
    return order;
}
  
export function createAsset(id: string, parentContract: Address, tokenId: BigInt): Asset {
    let asset = new Asset(id);
    asset.tokenId = tokenId;
    asset.parentContract = parentContract;
    asset.assetVolumeTransacted = ZERO_BI;
    asset.save();
    return asset;
}

export function createAccount(owner: Address): Account {
    let account = new Account(owner.toHexString());
    account.address = owner;
    account.userVolume = ZERO_BI;
    account.save();
    return account;
}

export function createOrderFill(orderFillId: string, filler: string, orderId: string, token: string): OrderFill {
    let orderFill = new OrderFill(orderFillId);
    orderFill.filler = filler;
    orderFill.order = orderId;
    orderFill.amount = ZERO_BI;
    orderFill.pricePerItem = ZERO_BI;
    orderFill.totalPrice = ZERO_BI;
    orderFill.token = token;
    orderFill.save();
    return orderFill;
}

export function createUserRoyalty(id: string, token: string, account: string): UserRoyalty {
    let royalty = new UserRoyalty(id);
    royalty.user = account;
    royalty.token = token;
    royalty.claimedAmount = ZERO_BI;
    royalty.save();
    return royalty;
}


export function getUserRoyaltyId(tokenId: string, accountId: string): string {
    return concat(tokenId, accountId);
}

export function getOrderFillId(orderId: string, transactionHash: string): string {
    return concat(orderId, transactionHash);
}

export function getAssetId(content: string, tokenId: string): string {
    return concat(content, tokenId);
}

function concat(str1: string, str2: string): string {
    return str1 + '-' + str2;
}

function concat2(str1: string, str2: string, str3: string): string {
    return str1 + '-' + str2 + '-' + str3;
}