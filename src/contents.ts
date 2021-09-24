import { log, ByteArray, BigInt, Address, crypto, store } from "@graphprotocol/graph-ts"
import {
  ContractsDeployed as ContractsDeployedEvent
} from "../generated/ContentFactory/ContentFactory";
import {
  TransferBatch as TransferBatchEvent,
  TransferSingle as TransferSingleEvent,
  Mint as MintEvent,
  Burn as BurnEvent,
  ApprovalForAll as ApprovalForAllEvent
} from "../generated/templates/Content/Content";
import {
  ContentStorage as ContentStorageContract,
  AssetsAdded as AssetsAddedEvent,
  ContractRoyaltyUpdated as ContractRoyaltyUpdatedEvent,
  HiddenUriUpdated as HiddenUriUpdatedEvent,
  PublicUriUpdated as PublicUriUpdatedEvent,
  TokenRoyaltyUpdated as TokenRoyaltyUpdatedEvent
} from "../generated/templates/ContentStorage/ContentStorage";
import {
  AccessControlManager as AccessControlManagerContract,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent
} from "../generated/templates/AccessControlManager/AccessControlManager";
import { 
  ContentFactory as Factory,
  ContentManager,
  Asset,
  AssetBalance,
  Content,
  Account,
  Approval,
  Minter
} from "../generated/schema";

import {
  createContentFactory,
  createContentManager,
  createContent,
  createAccount,
  createAsset,
  createAssetBalance,
  createApproval,
  createTransaction,
  getAssetId,
  getAssetBalanceId,
  getApprovalId,
  getMinterId,
  createMinter
} from "./content-helpers";

import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";
 
export function handleContractsDeployed(event: ContractsDeployedEvent): void {
  let factory = Factory.load(event.address.toHexString());
  if (factory == null) {
    factory = createContentFactory(event.address);
  }

  let content = Content.load(event.params.content.toHexString());
  // Create content object
  if (content == null) {
    content = createContent(event.params.content);
  }

  let contentManager = ContentManager.load(event.params.contentManager.toHexString());
  if (contentManager == null) {
    contentManager = createContentManager(event.params.contentManager, factory.id);
  }
}

// Content Events
export function handleTransferBatch(event: TransferBatchEvent): void {
  //TransferBatch(address operator, address from, address to, uint256[] ids, u as TransferSingleEventint256[] values)
  // transfer multiple assets
  let content = Content.load(event.address.toHexString());
  if (content == null) {
    return;
  }
  //   log.info('-------- LOG: content address: {}, ID: {}', [event.address.toHexString(), content.id])

  let ids = event.params.ids;
  let amounts = event.params.values;
  for (let i = 0; i < ids.length; ++i) {
    // get asset
    let assetId = getAssetId(content.id, ids[i].toString());
    
    if (event.params.to.toHex() != ADDRESS_ZERO) {
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
        balance = createAssetBalance(assetBalanceId, assetId, receiver.id);
      }

      balance.amount = balance.amount.plus(amounts[i]);
      balance.save();
    }

    if (event.params.from.toHex() != ADDRESS_ZERO) {
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
 
export function handleTransferSingle(event: TransferSingleEvent): void {
  let content = Content.load(event.address.toHexString());
  if (content == null) {
    return;
  }
  // get asset
  let assetId = getAssetId(content.id, event.params.id.toString());
  let amount = event.params.value;
  if (event.params.to.toHex() != ADDRESS_ZERO) {
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
      balance = createAssetBalance(assetBalanceId, assetId, receiver.id);
    }

    balance.amount = balance.amount.plus(amount);
    balance.save();
  } 

  if (event.params.from.toHex() != ADDRESS_ZERO) {
    // sender exists
    let sender = Account.load(event.params.from.toHexString());
    
    // get/create account balance
    let assetBalanceId = getAssetBalanceId(content.id, sender.id, event.params.id.toString());
    let balance = AssetBalance.load(assetBalanceId);
    
    balance.amount = balance.amount.minus(amount);
    balance.save();
  }
}

export function handleMint(event: MintEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.address.toHexString());
  if (parent == null) {
    return;
  }

  // Add Account Mint Count
  let receiver = Account.load(event.params.data.to.toHexString());
  if (receiver == null) {
    // Add new owner and increment token number of owners
    receiver = createAccount(event.params.data.to);
  }
  receiver.mintCount = receiver.mintCount.plus(ONE_BI);
  receiver.save();

  let transaction = createTransaction(
    event.transaction.hash.toHexString(),
    event.params.operator.toHexString(),
    event.params.data.to.toHexString(),
    "Mint");
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());

    // Add Asset Mint Count
    let asset = Asset.load(assetId);
    asset.mintCount = asset.mintCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.plus(amounts[i]);
    asset.save();
    
    // Update transaction
    transaction.assets.push(assetId);
    transaction.amounts.push(amounts[i]);
  }
  transaction.save();
}

export function handleBurn(event: BurnEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.address.toHexString());
  if (parent == null) {
    return;
  }

  // Add Account Burn Count; Cannot burn on an account that doesn't already exist
  let account = Account.load(event.params.data.account.toHexString());
  account.burnCount = account.burnCount.plus(ONE_BI);
  account.save();

  let transaction = createTransaction(
    event.transaction.hash.toHexString(),
    event.params.operator.toHexString(),
    event.params.data.account.toHexString(),
    "Burn");
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());

    // Add Asset Burn Count
    let asset = Asset.load(assetId);
    asset.burnCount = asset.burnCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.minus(amounts[i]);
    asset.save();
    
    // Update transaction
    transaction.assets.push(assetId);
    transaction.amounts.push(amounts[i]);
  }
  transaction.save();
}
// ApprovalForAll(address account, address operator, bool approved)
export function handleApprovalForAll(event: ApprovalForAllEvent): void {
  let approvalId = getApprovalId(
    event.address.toHexString(),
    event.params.account.toHexString(),
    event.params.operator.toHexString());

  // Get/Create approval
  if (event.params.approved) {
    let approval = Approval.load(approvalId);
    if (approval == null) {
      approval = createApproval(
        approvalId, 
        event.address.toHexString(),
        event.params.account.toHexString(),
        event.params.operator.toHexString());
    }
  } else {
    store.remove('Approval', approvalId);
  }
}

// ContentStorage Events
export function handleAssetsAdded(event: AssetsAddedEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.params.parent.toHexString());
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
    asset.royaltyRate = newAsset.royaltyRate;
    asset.royaltyReceiver = newAsset.royaltyReceiver.toHexString();
    asset.save();
  }
}
 
export function handleContractRoyaltyUpdated(event: ContractRoyaltyUpdatedEvent): void {
  // createContractFees
  let parent = Content.load(event.params.parent.toHexString());
  if (parent == null) {
    return;
  }

  parent.royaltyRate = event.params.rate;
  parent.royaltyReceiver = event.params.receiver.toHexString();
  parent.save();
}
 
export function handleHiddenUriUpdated(event: HiddenUriUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString());
  if (parent == null) {
    return;
  }
  
  let assetId = getAssetId(parent.id, event.params.id.toString());
  let asset = Asset.load(assetId);
  if (asset != null) {
    asset.latestHiddenUriVersion = event.params.version;
    asset.save();
  }
}
 
export function handlePublicUriUpdated(event: PublicUriUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString());
  if (parent == null) {
    return;
  }
  
  let assetId = getAssetId(parent.id, event.params.id.toString());
  let asset = Asset.load(assetId);
  if (asset != null) {
    asset.latestPublicUriVersion = event.params.version;
    asset.save();
  }
}
 
export function handleTokenRoyaltyUpdated(event: TokenRoyaltyUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString());
  if (parent == null) {
    return;
  }
  // Delete all asset royalties first
  let assetId = getAssetId(parent.id, event.params.tokenId.toString());
  let asset = Asset.load(assetId);
  if (asset == null) {
    return;
  }

  asset.royaltyReceiver = event.params.receiver.toHexString();
  asset.royaltyRate = event.params.rate;
  asset.save();
}

// AccessControlManager 
export function handleRoleGranted(event: RoleGrantedEvent) : void {
  // Get minter role and compare if it is the role that was granted
  let accessControlManager = AccessControlManagerContract.bind(event.address);
  if (event.params.role == accessControlManager.MINTER_ROLE()) {
    let content = Content.load(accessControlManager.parent().toHexString());
    if (content == null) {
      return;
    }
    
    let minterId = getMinterId(content.id, event.params.account.toHexString());
    let minter = Minter.load(minterId);
    if (minter == null) {
      minter = createMinter(minterId, content.id, event.params.account.toHexString());
    }
  }
}

export function handleRoleRevoked(event: RoleRevokedEvent) : void {
  // Get minter role and compare if it is the role that was revoked
  let accessControlManager = AccessControlManagerContract.bind(event.address);
  if (event.params.role == accessControlManager.MINTER_ROLE()) {
    let content = Content.load(accessControlManager.parent().toHexString());
    if (content == null) {
      return;
    }
    
    let minterId = getMinterId(content.id, event.params.account.toHexString());
    store.remove('Minter', minterId);
  }
}