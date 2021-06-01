import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"
import {
  ContentManagerRegistry,
  ContentManagerRegistered
} from "../generated/ContentManagerRegistry/ContentManagerRegistry";
import {
  ContentManager as ContentManagerContract,
  ContentManagerCreated
} from "../generated/templates/ContentManager/ContentManager";
import {
  Content as ContentContract,
  OwnershipTransferred,
  ApprovalForAll,
  TransferBatch,
  TransferSingle
} from "../generated/templates/Content/Content";
import {
  ContentStorage as ContentStorageContract,
  AssetsAdded,
  ContractRoyaltiesUpdated,
  HiddenTokenUriUpdated,
  TokenRoyaltiesUpdated,
  TokenUriPrefixUpdated
} from "../generated/templates/ContentStorage/ContentStorage";
import {
  SystemsRegistry as SystemsRegistryContract,
  UserApproved,
  RegisteredSystemsUpdated
} from "../generated/templates/SystemsRegistry/SystemsRegistry";
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
    Operator
 } from "../generated/schema";
 
let zeroAddress = '0x0000000000000000000000000000000000000000';
 
export function handleContentManagerRegistered(event: ContentManagerRegistered): void {
  // let owner = event.params.owner.toHexString();
  let contentManagerAddr = event.params.contentManager;

  let contentManager = ContentManager.load(contentManagerAddr.toHexString());
  if (contentManager == null) {
    contentManager = createContentManager(contentManagerAddr, event.params.owner);
  }
  contentManager.save();
}

// Content Events
export function handleTransferBatch(event: TransferBatch): void {
  //TransferBatch(address operator, address from, address to, uint256[] ids, uint256[] values)
  // transfer multiple assets
  let content = Content.load(event.address.toHexString());
  if (content == null) {
    return;
  }
  if (content != null) {
    let ids = event.params.ids;
    let amounts = event.params.values;
    for (let i = 0; i < event.params.ids.length; ++i) {
      // get/create asset
      let assetId = getAssetId(content.id, ids[i].toString());
      let asset = Asset.load(assetId);
      if (asset == null) {
        asset = createAsset(assetId, content.id, ids[i]);
        asset.save();
      }

      if (event.params.to.toHex() != zeroAddress) {
        // receiver exists
        let receiver = Account.load(event.params.to.toHexString());
        if (receiver == null) {
          // Add new owner and increment token number of owners
          receiver = createAccount(event.params.to);
        }

        // get/create account balance
        let assetBalanceId = getAssetBalanceId(content.id, receiver.id, ids[i].toString());
        let balance = AssetBalance.load(assetBalanceId);
        if (balance == null) {
          balance = createAssetBalance(assetBalanceId, asset.id, receiver.id);
        }

        balance.amount = balance.amount.plus(amounts[i]);
        balance.save();
        receiver.save();
      }

      if (event.params.from.toHex() != zeroAddress) {
        // sender exists
        let sender = Account.load(event.params.from.toHexString());
        
        // get/create account balance
        let assetBalanceId = getAssetBalanceId(content.id, sender.id, ids[i].toString());
        let balance = AssetBalance.load(assetBalanceId);
        
        balance.amount = balance.amount.minus(amounts[i]);
        balance.save();
      }
    }
  }
}
 
export function handleTransferSingle(event: TransferSingle): void {
  let content = Content.load(event.address.toHexString());
  if (content == null) {
    return;
  }
  // get/create asset
  let assetId = getAssetId(content.id, event.params.id.toString());
  let amount = event.params.value;
  let asset = Asset.load(assetId);
  if (asset == null) {
    asset = createAsset(assetId, content.id, event.params.id);
    asset.save();
  }

  if (event.params.to.toHex() != zeroAddress) {
    // receiver exists
    let receiver = Account.load(event.params.to.toHexString());
    if (receiver == null) {
      // Add new owner and increment token number of owners
      receiver = createAccount(event.params.to);
    }

    // get/create account balance
    let assetBalanceId = getAssetBalanceId(content.id, receiver.id, event.params.id.toString());
    let balance = AssetBalance.load(assetBalanceId);
    if (balance == null) {
      balance = createAssetBalance(assetBalanceId, asset.id, receiver.id);
    }

    balance.amount = balance.amount.plus(amount);
    balance.save();
    receiver.save();
  }

  if (event.params.from.toHex() != zeroAddress) {
    // sender exists
    let sender = Account.load(event.params.from.toHexString());
    
    // get/create account balance
    let assetBalanceId = getAssetBalanceId(content.id, sender.id, event.params.id.toString());
    let balance = AssetBalance.load(assetBalanceId);
    
    balance.amount = balance.amount.minus(amount);
    balance.save();
  }
}

// ContentStorage Events
export function handleAssetsAdded(event: AssetsAdded): void {
  let parent = Content.load(event.params.parent.toString());
  if (parent == null) {
    return;
  }
  let assets = event.params.assets;

  // For every asset added, create a new asset object
  for (let j = 0; j < assets.length; ++j) {
    let newAsset = assets[j];
    let tokenId = newAsset.tokenId;
    let assetId = getAssetId(parent.id, tokenId.toString());
    let asset = Asset.load(assetId);
    if (asset == null) {
      asset = createAsset(assetId, parent.id, tokenId);
    }
    asset.maxSupply = newAsset.maxSupply;

    let royaltyFeesLength = newAsset.fees.length;
    let fees = newAsset.fees;
    for (let i = 0; i < royaltyFeesLength; ++i) {
      let account = fees[i].account;
      let feeId = getAssetFeeId(parent.id, account.toString(), tokenId.toString());
      let fee = AssetFee.load(feeId);
      if (fee == null) {
        fee = createAssetFees(feeId, account, asset.id);
      }
      fee.rate = fees[i].rate;
      fee.save();
    }
    asset.save();
  }
  parent.save();
}
 
export function handleContractRoyaltiesUpdated(event: ContractRoyaltiesUpdated): void {
  // createContractFees
  let parent = Content.load(event.params.parent.toString());
  if (parent == null) {
    return;
  }
  
  // Delete existing contract royalties
  parent.contractRoyalties.forEach(currentFee => {
    let fee = ContractFee.load(currentFee);
    fee.rate = BigInt.fromI32(0);
    fee.save();
  });

  // For every asset added, create a new asset object
  // let fees = event.params.fees;
  let fees = event.params.fees;
  for (let i = 0; i < fees.length; ++i) {
    // let newFee = fees[i];
    let feeId = getContractFeeId(parent.id, fees[i].account.toString());
    let fee = ContractFee.load(feeId);
    if (fee == null) {
      fee = createContractFees(feeId, fees[i].account, parent.id);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }

  parent.save();
}
 
export function handleHiddenTokenUriUpdated(event: HiddenTokenUriUpdated): void {
  let parent = Content.load(event.params.parent.toString());
  if (parent == null) {
    return;
  }
  // (address indexed parent, uint256 indexed id, uint256 indexed version);
  let assetId = getAssetId(parent.id, event.params.id.toString());
  let asset = Asset.load(assetId);
  if (asset != null) {
    asset.latestHiddenUriVersion = event.params.version;
    asset.save();
  }
}
 
export function handleTokenRoyaltiesUpdated(event: TokenRoyaltiesUpdated): void {
  let parent = Content.load(event.params.parent.toString());
  if (parent == null) {
    return;
  }
  // Delete all asset royalties first
  let assetId = getAssetId(parent.id, event.params.tokenId.toString());
  let asset = Asset.load(assetId);
  if (asset == null) {
    return;
  }

  // let currentFees = asset.assetRoyalties;
  asset.assetRoyalties.forEach(currentFeeId => {
    let fee = AssetFee.load(currentFeeId);
    fee.rate = BigInt.fromI32(0);
    fee.save();
  });

  // Add/update new asset royalties
  let fees = event.params.fees;
  for (let i = 0; i < fees.length; ++i) {
    // let newFee = fees[i];
    let assetFeeId = getAssetFeeId(parent.id, fees[i].account.toString(), asset.tokenId.toString());
    let fee = AssetFee.load(assetFeeId);
    if (fee == null) {
      fee = createAssetFees(assetFeeId, fees[i].account, assetId);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }
  asset.save();
}
 
export function handleTokenUriPrefixUpdated(event: TokenUriPrefixUpdated): void {
  // event TokenUriPrefixUpdated(address indexed parent, string uriPrefix);
  let parent = Content.load(event.params.parent.toString());
  if (parent == null) {
    return;
  }
  
  parent.contractUriPrefix = event.params.uriPrefix;
  parent.save();
}

// SystemsRegistry Events
export function handleUserApproved(event: UserApproved): void {
  // UserApproved(address indexed contentContract, address indexed user, bool approved);
  let parent = Content.load(event.params.contentContract.toString());
  if (parent == null) {
    return;
  }

  let user = Account.load(event.params.user.toString());
  if (user == null) {
    user = createAccount(event.params.user);
    user.save();
  }

  let approvalId = getUserApprovalId(parent.id, event.params.user.toString());
  let approval = UserApproval.load(approvalId);
  if (approval == null) {
    approval = createUserApproval(approvalId, parent.id, user.id);
  }
  approval.approved = event.params.approved;
  approval.save();
}

// Content 
export function handleRegisteredSystemsUpdated(event: RegisteredSystemsUpdated): void {
  // RegisteredSystemsUpdated(address indexed contentContract, LibAsset.SystemApprovalPair[] operators);
  // UserApproved(address indexed contentContract, address indexed user, bool approved);
  let parent = Content.load(event.params.contentContract.toString());
  if (parent == null) {
    return;
  }

  let operatorPairs = event.params.operators;
  for (let i = 0; i < operatorPairs.length; ++i) {
    // let operatorPair = operatorPairs[i];
    let operatorId = getOperatorId(parent.id, operatorPairs[i].operator.toString());
    let operator = Operator.load(operatorId);
    if (operator == null) {
      operator = createOperator(operatorId, parent.id, operatorPairs[i].operator);
    }
    operator.approved = operatorPairs[i].approved;
    operator.save();
  }
}

function createContentManager(id: Address, owner: Address): ContentManager {
  let contentManager = new ContentManager(id.toHexString());
  let contentManagerContract = ContentManagerContract.bind(id);
  let contentAddress = contentManagerContract.content()
  
  // Get the new objects
  let systemRegistry = SystemRegistry.load(contentManagerContract.systemsRegistry().toHexString());
  let content = Content.load(contentManagerContract.content().toHexString());
  let contentStorage = ContentStorage.load(contentManagerContract.contentStorage().toHexString());
  
  if (content == null) {
    content = createContent(contentAddress);
    content.save();
  }
  
  if (systemRegistry == null) {
    systemRegistry = createSystemRegistry(contentManagerContract.systemsRegistry(), contentAddress);
    systemRegistry.save();
  }
  if (contentStorage == null) {
    contentStorage = createContentStorage(contentManagerContract.contentStorage(), contentAddress);
    contentStorage.save();
  }

  contentManager.content = contentManagerContract.content().toHexString();
  contentManager.systemRegistry = contentManagerContract.systemsRegistry().toHexString();
  contentManager.contentStorage = contentManagerContract.contentStorage().toHexString();

  return contentManager;
}


function createSystemRegistry(id: Address, content: Address): SystemRegistry {
  let systemRegistry = new SystemRegistry(id.toHexString());
  systemRegistry.content = content.toHexString();

  return systemRegistry;
}

function createContent(id: Address): Content {
  let content = new Content(id.toHexString());
  content.contractAddress = id;

  let contentContract = ContentContract.bind(id);
  content.name = contentContract.name();
  content.symbol = contentContract.symbol();

  return content;
}

function createContentStorage(id: Address, content: Address): ContentStorage {
  let contentStorage = new ContentStorage(id.toHexString());
  contentStorage.content = content.toHexString();

  return contentStorage;
}

function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.address = address;

  return account;
}

function createAsset(id: string, parent: string, tokenId: BigInt): Asset {
  let asset = new Asset(id);
  asset.tokenId = tokenId;
  asset.parentContract = parent;
  asset.currentSupply = BigInt.fromI32(0);
  asset.maxSupply = BigInt.fromI32(0);
  asset.latestHiddenUriVersion = BigInt.fromI32(0);
  return asset;
}

function createAssetBalance(id: string, asset: string, owner: string): AssetBalance {
  let balance = new AssetBalance(id);
  balance.asset = asset;
  balance.owner = owner;
  balance.amount = BigInt.fromI32(0);
  return balance;
}

function createAssetFees(id: string, creator: Address, assetId: string): AssetFee {
  let fee = new AssetFee(id);
  fee.creator = creator; 
  fee.asset = assetId;
  fee.rate = BigInt.fromI32(0);
  return fee;
}

function createContractFees(id: string, creator: Address, content: string): ContractFee {
  let fee = new ContractFee(id);
  fee.creator = creator; 
  fee.content = content;
  fee.rate = BigInt.fromI32(0);
  return fee;
}

function createUserApproval(id: string, content: string, user: string): UserApproval {
  let approval = new UserApproval(id)
  approval.content = content;
  approval.user = user;
  approval.approved = false;
  return approval;
}

function createOperator(id: string, content: string, address: Address): Operator {
  let operator = new Operator(id)
  operator.content = content;
  operator.address = address;
  operator.approved = false;
  return operator;
}

function getAssetId(content: string, tokenId: string): string {
  return concat(content, tokenId);
}

function getAssetBalanceId(content: string, account: string, tokenId: string): string {
  return concat2(content, account, tokenId); 
}

function getAssetFeeId(content: string, account: string, tokenId: string): string {
  return concat2(content, account, tokenId);
}

function getContractFeeId(content: string, account: string): string {
  return concat(content, account);
}

function getUserApprovalId(content: string, account: string): string {
  return concat(content, account);
}

function getOperatorId(content: string, address: string): string {
  return concat(content, address);
}

function concat(str1: string, str2: string): string {
  return str1 + '-' + str2;
}

function concat2(str1: string, str2: string, str3: string): string {
  return str1 + '-' + str2 + '-' + str3;
}