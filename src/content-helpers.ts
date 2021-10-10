import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import {
  Content as ContentContract
} from "../generated/templates/Content/Content";
import {
  ContentManager as ContentManagerContract
} from "../generated/ContentFactory/ContentManager";

import { 
  ContentFactory as Factory,
  ContentManager,
  Asset,
  AssetBalance,
  Content,
  Account,
  Approval,
  Transaction,
  Minter
} from "../generated/schema";

import {
  ContentStorage as ContentStorageTemplate,
  AccessControlManager as AccessControlManagerTemplate,
  Content as ContentTemplate
} from '../generated/templates';

import { ADDRESS_ZERO, ZERO_BI } from "./constants";

export function createContentFactory(id: Address): Factory {
  let contentFactory = new Factory(id.toHexString());
  contentFactory.save();
  return contentFactory;
}

export function createContentManager(id: Address, factory: string): ContentManager {
  let contentManager = new ContentManager(id.toHexString());

  // Bind allows you to call content manager contract functions
  let contentManagerContract = ContentManagerContract.bind(id);

  // Create() allows you to start indexing events from these contracts
  AccessControlManagerTemplate.create(contentManagerContract.accessControlManager());
  ContentStorageTemplate.create(contentManagerContract.contentStorage());

  let contentAddress = contentManagerContract.content();

  // Set the rest of the content manager data
  contentManager.content = contentAddress.toHexString();
  contentManager.owner = contentManagerContract.owner().toHexString();
  contentManager.factory = factory;
  contentManager.save();
  
  return contentManager;
}
  
export function createContent(id: Address, factory: string): Content {
  ContentTemplate.create(id);
  let content = new Content(id.toHexString());
  content.contractAddress = id;
  
  // Get Contract URI
  let contentContract = ContentContract.bind(id);
  let royalties = contentContract.contractRoyalty();
  // Todo: update the return names so this isn't value0 and value1
  content.royaltyReceiver = royalties.value0.toHexString();
  content.royaltyRate = royalties.value1;
  content.contractUri = contentContract.contractUri();
  content.factory = factory;
  content.save();
  return content;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.address = address;
  account.mintCount = ZERO_BI;
  account.burnCount = ZERO_BI;
  account.save();
  return account;
}
  
export function createAsset(id: string, parent: string, tokenId: BigInt): Asset {
  let asset = new Asset(id);
  asset.tokenId = tokenId;
  asset.parentContract = parent;
  asset.currentSupply = ZERO_BI;
  asset.maxSupply = ZERO_BI;
  asset.latestHiddenUriVersion = ZERO_BI;
  asset.latestPublicUriVersion = ZERO_BI;
  asset.royaltyReceiver = ADDRESS_ZERO;
  asset.royaltyRate = 0;
  asset.mintCount = ZERO_BI;
  asset.burnCount = ZERO_BI;
  asset.save();
  return asset;
}
  
export function createAssetBalance(id: string, asset: string, owner: string): AssetBalance {
  let balance = new AssetBalance(id);
  balance.asset = asset;
  balance.owner = owner;
  balance.amount = ZERO_BI;
  balance.save();
  return balance;
}
  
export function createApproval(id: string, content: string, operator: string, user: string): Approval {
  let approval = new Approval(id);
  approval.content = content;
  approval.user = user;
  approval.operator = operator;
  approval.save();
  return approval;
}

export function createMinter(id: string, content: string, operator: string) : Minter {
  let minter = new Minter(id);
  minter.content = content;
  minter.operator = operator;
  minter.save();
  return minter;
}

export function createTransaction(id: string, operator: string, user: string, transactionType: string): Transaction {
  let transaction = new Transaction(id);
  transaction.operator = operator;
  transaction.user = user;
  transaction.assets = [];
  transaction.amounts = [];
  transaction.transactionType = transactionType;
  transaction.blockNumber = ZERO_BI;
  transaction.timestamp = ZERO_BI;
  transaction.gasUSed = ZERO_BI;
  transaction.gasPrice = ZERO_BI;
  transaction.save();
  return transaction;
}

export function getAssetId(content: string, tokenId: string): string {
  return concat(content, tokenId);
}

export function getAssetBalanceId(content: string, account: string, tokenId: string): string {
  return concat2(content, account, tokenId); 
}

export function getAssetFeeId(content: string, account: string, tokenId: string): string {
  return concat2(content, account, tokenId);
}

export function getContractFeeId(content: string, account: string): string {
  return concat(content, account);
}

export function getApprovalId(content: string, account: string, operator: string): string {
  return concat2(content, account, operator);
}

export function getMinterId(content: string, operator: string): string {
  return concat(content, operator);
}

export function getTransactionId(transactionId: string, tokenId: string): string {
  return concat(transactionId, tokenId);
}

function concat(str1: string, str2: string): string {
  return str1 + '-' + str2;
}

function concat2(str1: string, str2: string, str3: string): string {
  return str1 + '-' + str2 + '-' + str3;
}