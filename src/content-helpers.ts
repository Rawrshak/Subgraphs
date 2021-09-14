import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import {
  Content as ContentContract
} from "../generated/templates/Content/Content";
import {
  ContentManager as ContentManagerContract
} from "../generated/ContractRegistry/ContentManager";
import {
  ContentStorage as ContentStorageContract
} from "../generated/templates/ContentStorage/ContentStorage";

import { 
  ContractRegistry as Registry,
  ContentManager,
  Asset,
  AssetBalance,
  Content,
  Account,
  AssetFee,
  ContractFee,
  Approval,
  Transaction,
  Minter
} from "../generated/schema";

import {
    ContentStorage as ContentStorageTemplate,
    AccessControlManager as AccessControlManagerTemplate,
    Content as ContentTemplate
} from '../generated/templates';

import { ZERO_BI } from "./constants";

export function createContractRegistry(id: Address, creator: Address): Registry {
  let contractRegistry = new Registry(id.toHexString());
  contractRegistry.save();
  return contractRegistry;
}

export function createContentManager(id: Address, creator: Address, registry: string): ContentManager {
  let contentManager = new ContentManager(id.toHexString());

  // Bind allows you to call content manager contract functions
  let contentManagerContract = ContentManagerContract.bind(id);
  let contentAddress = contentManagerContract.content();
  let contentStorageAddress = contentManagerContract.contentStorage();

  // Get the objects if they exist
  AccessControlManagerTemplate.create(contentManagerContract.accessControlManager());
  ContentStorageTemplate.create(contentStorageAddress);
  let content = Content.load(contentAddress.toHexString());

  // Create content object
  if (content == null) {
    content = createContent(contentAddress);
  }

  // Get Contract Fees
  let contentStorage = ContentStorageContract.bind(contentStorageAddress);
  let fees = contentStorage.contractRoyalties();
  let royalties = content.contractRoyalties;
  for (let i = 0; i < fees.length; ++i) {
    let feeId = getContractFeeId(contentAddress.toHexString(), fees[i].account.toHexString());
    let fee = ContractFee.load(feeId);
    if (fee == null) {
      fee = createContractFees(feeId, fees[i].account, contentAddress.toHexString());
      royalties.push(fee.id);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }
  content.contractRoyalties = royalties;
  content.save();
  
  // Set the rest of the content manager data
  contentManager.content = contentAddress.toHexString();
  contentManager.creator = creator.toHexString();
  contentManager.registry = registry;
  contentManager.save();
  
  return contentManager;
}
  
export function createContent(id: Address): Content {
  ContentTemplate.create(id);
  let content = new Content(id.toHexString());
  content.contractAddress = id;
  
  // Get Contract URI
  let contentContract = ContentContract.bind(id);
  content.contractUri = contentContract.contractUri();
  content.contractRoyalties = [];
  content.assets = [];
  content.minters = [];
  content.save();
  return content;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.address = address;
  account.assetBalances = [];
  account.approvals = [];
  account.minters = [];
  account.transactions = [];
  account.transactionsAsOperator = [];
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
  asset.assetRoyalties = [];
  asset.balances = [];
  asset.transactions = [];
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
  
export function createAssetFees(id: string, creator: Address, assetId: string): AssetFee {
  let fee = new AssetFee(id);
  fee.creator = creator.toHexString(); 
  fee.asset = assetId;
  fee.rate = ZERO_BI;
  fee.save();
  return fee;
}
  
export function createContractFees(id: string, creator: Address, content: string): ContractFee {
  let fee = new ContractFee(id);
  fee.creator = creator.toHexString(); 
  fee.content = content;
  fee.rate = ZERO_BI;
  fee.save();
  return fee;
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