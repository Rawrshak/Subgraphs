import { log, ByteArray, BigInt, Address, crypto, ipfs, Bytes, json, JSONValue, JSONValueKind, Value } from "@graphprotocol/graph-ts"

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
  Minter,
  Tag
} from "../generated/schema";

import {
  ContentStorage as ContentStorageTemplate,
  AccessControlManager as AccessControlManagerTemplate,
  Content as ContentTemplate
} from '../generated/templates';

import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";

export function createContentFactory(id: Address): Factory {
  let contentFactory = new Factory(id.toHexString());
  contentFactory.contentsCount = ZERO_BI;
  contentFactory.contentManagersCount = ZERO_BI;
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
  content.royaltyReceiver = royalties.value0.toHexString();
  content.royaltyRate = royalties.value1;
  content.contractUri = contentContract.contractUri();
  content.factory = factory;
  content.tags = [];
  content.assetsCount = ZERO_BI;
  content.mintersCount = 0;
  content.tagsCount = 0;

  // get URI metadata
  // log.info('-------- LOG: contract: {}, Uri CID: {}', [content.id, hash]);

  let metadata = ipfs.cat(content.contractUri);
  if (metadata) {
    let tryData = json.try_fromBytes(metadata as Bytes);
    if (tryData.isOk) {
      let data = tryData.value.toObject();
        
      content.name = jsonToString(data.get("name"));
      content.game = jsonToString(data.get("game"));
      content.creator = jsonToString(data.get("creator"));
      content.owner = jsonToString(data.get("owner"));

      let tagsArray = jsonToArray(data.get("tags"));
      content.tags = createTags(content.tags, tagsArray);
      content.tagsCount = tagsArray.length;
    }
  }
  content.save();
  return content;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.address = address;
  account.mintCount = ZERO_BI;
  account.burnCount = ZERO_BI;
  account.uniqueAssetCount = ZERO_BI;
  account.transactionsCount = ZERO_BI;
  account.transactionsAsOperatorCount = ZERO_BI;
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
  asset.ownersCount = ZERO_BI;
  asset.transactionsCount = ZERO_BI;
  asset.tags = [];
  asset.tagsCount = 0;

  let contentContract = ContentContract.bind(Address.fromString(parent));
  let hash = contentContract.uri(tokenId);

  let metadata = ipfs.cat(hash);
  if (metadata) {
    let tryData = json.try_fromBytes(metadata as Bytes);
    if (tryData.isOk) {
      let data = tryData.value.toObject();
        
      asset.name = jsonToString(data.get("name"));
      asset.type = jsonToString(data.get("type"));
      asset.subtype = jsonToString(data.get("subtype"));

      let tagsArray = jsonToArray(data.get("tags"));
      asset.tags = createTags(asset.tags, tagsArray);
      asset.tagsCount = tagsArray.length;
    }
  }

  asset.save();

  // Update Content asset count
  let content = Content.load(parent)!;
  content.assetsCount = content.assetsCount.plus(ONE_BI);
  content.save();

  return asset;
}
  
export function createAssetBalance(id: string, assetId: string, owner: string): AssetBalance {
  let asset = Asset.load(assetId)!;
  let balance = new AssetBalance(id);
  balance.asset = assetId;
  balance.owner = owner;
  balance.parentContract = asset.parentContract;
  balance.amount = ZERO_BI;
  balance.type = asset.type;
  balance.subtype = asset.subtype;
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
  transaction.assetAmounts = [];
  transaction.transactionType = transactionType;
  transaction.blockNumber = ZERO_BI;
  transaction.timestamp = ZERO_BI;
  transaction.gasUsed = ZERO_BI;
  transaction.gasPrice = ZERO_BI;
  transaction.save();
  return transaction;
}

function createTags(array: string[], tags: JSONValue[]) : string[] {
  let tagsArray = array;
  for (let i = 0; i < tags.length; ++i) {
    // log.info('-------- LOG: contract: {}, Tag: {}', [content.id, tagEntity.id]);
    // Clear an array: this.array = [] as CustomType[];
    let tagStr = jsonToString(tags[i]);
    let tagEntity = Tag.load(tagStr);
    if (tagEntity == null) {
      tagEntity = new Tag(tagStr);
      tagEntity.save();
    }
    tagsArray.push(tagEntity.id);
  }
  return tagsArray;
}

export function createTag(tagString: string) : Tag {
    return new Tag(tagString);
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

export function concat(str1: string, str2: string): string {
  return str1 + '-' + str2;
}

export function concat2(str1: string, str2: string, str3: string): string {
  return str1 + '-' + str2 + '-' + str3;
}

export function jsonToString(val: JSONValue | null): string {
    if (val != null && val.kind === JSONValueKind.STRING) {
      return val.toString()
    }
    return ''
}

export function jsonToArray(val: JSONValue | null): JSONValue[] {
    if (val != null && val.kind === JSONValueKind.ARRAY) {
      return val.toArray();
    }
    return [];
}