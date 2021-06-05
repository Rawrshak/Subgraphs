import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import {
  Content as ContentContract
} from "../generated/templates/Content/Content";
import {
  ContentManager as ContentManagerContract
} from "../generated/templates/ContentManager/ContentManager";

import { 
  ContentManagerRegistry as Registry,
  ContentManager,
  SystemRegistry,
  ContentStorage,
  Asset,
  AssetBalance,
  Content,
  Account,
  AssetFee,
  ContractFee,
  UserApproval,
  Operator,
  Transaction,
  MintTransaction,
  BurnTransaction
} from "../generated/schema";

export function createContentManagerRegistry(id: Address, creator: Address): Registry {
  let contentManagerRegistry = new Registry(id.toHexString());
  contentManagerRegistry.save();
  return contentManagerRegistry;
}

import {
    ContentStorage as ContentStorageTemplate,
    SystemsRegistry as SystemsRegistryTemplate,
    Content as ContentTemplate
} from '../generated/templates';

export function createContentManager(id: Address, creator: Address, registry: string): ContentManager {
  let contentManager = new ContentManager(id.toHexString());
  let contentManagerContract = ContentManagerContract.bind(id);
  let contentAddress = contentManagerContract.content();
  let contentStorageAddress = contentManagerContract.contentStorage();
  let systemRegistryAddress = contentManagerContract.systemsRegistry();

  // Get the objects if they exist
  let systemRegistry = SystemRegistry.load(systemRegistryAddress.toHexString());
  let content = Content.load(contentAddress.toHexString());
  let contentStorage = ContentStorage.load(contentStorageAddress.toHexString());

  // Create content object
  if (content == null) {
    content = createContent(contentAddress);
    content.save();
  }
  
  // Create system registry object
  if (systemRegistry == null) {
    systemRegistry = createSystemRegistry(systemRegistryAddress, contentAddress);
    systemRegistry.save();
  }
  
  // Create content storage object
  if (contentStorage == null) {
    contentStorage = createContentStorage(contentStorageAddress, contentAddress);
    contentStorage.save();
  }
  
  contentManager.content = contentAddress.toHexString();
  contentManager.systemRegistry = systemRegistryAddress.toHexString();
  contentManager.contentStorage = contentStorageAddress.toHexString();
  contentManager.creator = creator;
  contentManager.registry = registry;
  contentManager.save();
  
  return contentManager;
}
  
  
export function createSystemRegistry(id: Address, content: Address): SystemRegistry {
  SystemsRegistryTemplate.create(id);
  let systemRegistry = new SystemRegistry(id.toHexString());
  systemRegistry.content = content.toHexString();
  systemRegistry.save();
  return systemRegistry;
}
  
export function createContent(id: Address): Content {
  ContentTemplate.create(id);
  let content = new Content(id.toHexString());
  content.contractAddress = id;
  
  let contentContract = ContentContract.bind(id);
  content.name = contentContract.name();
  content.symbol = contentContract.symbol();
  content.contractRoyalties = [];
  content.assets = [];
  content.userApprovals = [];
  content.operators = [];
  content.save();
  return content;
}
  
export function createContentStorage(id: Address, content: Address): ContentStorage {
  ContentStorageTemplate.create(id);
  let contentStorage = new ContentStorage(id.toHexString());
  contentStorage.content = content.toHexString();
  contentStorage.save();
  return contentStorage;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.address = address;
  account.assetBalances = [];
  account.approvals = [];
  account.mints = [];
  account.burns = [];
  account.save();
  return account;
}
  
export function createAsset(id: string, parent: string, tokenId: BigInt): Asset {
  let asset = new Asset(id);
  asset.tokenId = tokenId;
  asset.parentContract = parent;
  asset.currentSupply = BigInt.fromI32(0);
  asset.maxSupply = BigInt.fromI32(0);
  asset.latestHiddenUriVersion = BigInt.fromI32(0);
  asset.assetRoyalties = [];
  asset.balances = [];
  asset.mintTransactions = [];
  asset.burnTransactions = [];
  asset.mintCount = BigInt.fromI32(0);
  asset.burnCount = BigInt.fromI32(0);
  asset.save();
  return asset;
}
  
export function createAssetBalance(id: string, asset: string, owner: string): AssetBalance {
  let balance = new AssetBalance(id);
  balance.asset = asset;
  balance.owner = owner;
  balance.amount = BigInt.fromI32(0);
  balance.save();
  return balance;
}
  
export function createAssetFees(id: string, creator: Address, assetId: string): AssetFee {
  let fee = new AssetFee(id);
  fee.creator = creator; 
  fee.asset = assetId;
  fee.rate = BigInt.fromI32(0);
  fee.save();
  return fee;
}
  
export function createContractFees(id: string, creator: Address, content: string): ContractFee {
  let fee = new ContractFee(id);
  fee.creator = creator; 
  fee.content = content;
  fee.rate = BigInt.fromI32(0);
  fee.save();
  return fee;
}
  
export function createUserApproval(id: string, content: string, user: string): UserApproval {
  let approval = new UserApproval(id);
  approval.content = content;
  approval.user = user;
  approval.approved = false;
  approval.save();
  return approval;
}
  
export function createOperator(id: string, content: string, address: Address): Operator {
  let operator = new Operator(id)
  operator.content = content;
  operator.address = address;
  operator.approved = false;
  operator.save();
  return operator;
}

export function createTransaction(id: string): Transaction {
  let transaction = new Transaction(id);
  transaction.blockNumber = BigInt.fromI32(0);
  transaction.timestamp = BigInt.fromI32(0);
  transaction.gasUSed = BigInt.fromI32(0);
  transaction.gasPrice = BigInt.fromI32(0);
  transaction.mints = [];
  transaction.burns = [];
  transaction.save();
  return transaction;
}

export function createMintTransaction(id: string, transactionId: string, operator: string, receiver: string, asset: string): MintTransaction {
  let transaction = new MintTransaction(id);
  transaction.operator = operator;
  transaction.receiver = receiver;
  transaction.transaction = transactionId;
  transaction.asset = asset;
  transaction.amount = BigInt.fromI32(0);
  transaction.save();
  return transaction;
}

export function createBurnTransaction(id: string, transactionId: string, operator: string, burner: string, asset: string): BurnTransaction {
  let transaction = new BurnTransaction(id);
  transaction.operator = operator;
  transaction.burner = burner;
  transaction.transaction = transactionId;
  transaction.asset = asset;
  transaction.amount = BigInt.fromI32(0);
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

export function getUserApprovalId(content: string, account: string): string {
  return concat(content, account);
}

export function getOperatorId(content: string, address: string): string {
  return concat(content, address);
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