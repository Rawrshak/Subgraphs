import { log, ByteArray, BigInt, Address, crypto, store } from "@graphprotocol/graph-ts"
import {
  ContractsDeployed as ContractsDeployedEvent
} from "../generated/ContentFactory/ContentFactory";
import {
  Content as ContentContract,
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
  ContentManager as ContentManagerContract,
  OwnershipTransferred as OwnershipTransferredEvent
} from "../generated/templates/ContentManager/ContentManager";
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
  Minter,
  TransactionAssetAmount
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
  createMinter,
  concat,
  updateAssetPublicUri
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
    content = createContent(event.params.content, factory.id);
  }

  let contentManager = ContentManager.load(event.params.contentManager.toHexString());
  if (contentManager == null) {
    contentManager = createContentManager(event.params.contentManager, factory.id);
  }

  // set the Content Creator Address to the current ContentManager owner
  content.creatorAddress = contentManager.owner;
  content.owner = contentManager.owner;
  content.save();
  
  factory.contentManagersCount = factory.contentManagersCount.plus(ONE_BI);
  factory.contentsCount = factory.contentsCount.plus(ONE_BI);
  factory.save();
}

// Content Events
export function handleTransferBatch(event: TransferBatchEvent): void {
  //TransferBatch(address operator, address from, address to, uint256[] ids, u as TransferSingleEventint256[] values)
  // transfer multiple assets
  let content = Content.load(event.address.toHexString())!;
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

      // if balance is new or was at zero again previously, increment unique asset count
      if (balance.amount == ZERO_BI) {
        receiver.uniqueAssetCount = receiver.uniqueAssetCount.plus(ONE_BI);
        receiver.save();

        let asset = Asset.load(assetId)!;
        asset.ownersCount = asset.ownersCount.plus(ONE_BI);
        asset.save();
      }

      balance.amount = balance.amount.plus(amounts[i]);
      balance.save();
    }

    if (event.params.from.toHex() != ADDRESS_ZERO) {
      // sender exists
      let sender = Account.load(event.params.from.toHexString())!;
      
      // get/create account balance
      let assetBalanceId = getAssetBalanceId(content.id, sender.id, ids[i].toString());
      let balance = AssetBalance.load(assetBalanceId)!;
      
      balance.amount = balance.amount.minus(amounts[i]);
      balance.save();

      // if balance drops to 0, decrement unique asset count
      if (balance.amount == ZERO_BI) {
        sender.uniqueAssetCount = sender.uniqueAssetCount.minus(ONE_BI);
        sender.save();

        let asset = Asset.load(assetId)!;
        asset.ownersCount = asset.ownersCount.minus(ONE_BI);
        asset.save();
      }
    }
  }
}
 
export function handleTransferSingle(event: TransferSingleEvent): void {
  let content = Content.load(event.address.toHexString())!;
  
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

    // if balance is new or was at zero again previously, increment unique asset count
    if (balance.amount == ZERO_BI) {
      receiver.uniqueAssetCount = receiver.uniqueAssetCount.plus(ONE_BI);
      receiver.save();

      let asset = Asset.load(assetId)!;
      asset.ownersCount = asset.ownersCount.plus(ONE_BI);
      asset.save();
    }

    balance.amount = balance.amount.plus(amount);
    balance.save();
  } 

  if (event.params.from.toHex() != ADDRESS_ZERO) {
    // sender exists
    let sender = Account.load(event.params.from.toHexString())!;

    // get/create account balance
    let assetBalanceId = getAssetBalanceId(content.id, sender.id, event.params.id.toString());
    let balance = AssetBalance.load(assetBalanceId)!;
    
    balance.amount = balance.amount.minus(amount);
    balance.save();

    // if balance drops to 0, decrement unique asset count
    if (balance.amount == ZERO_BI) {
      sender.uniqueAssetCount = sender.uniqueAssetCount.minus(ONE_BI);
      sender.save();

      let asset = Asset.load(assetId)!;
      asset.ownersCount = asset.ownersCount.minus(ONE_BI);
      asset.save();
    }
  }
}

export function handleMint(event: MintEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.address.toHexString())!;

  // Add Account Mint Count
  let receiver = Account.load(event.params.data.to.toHexString());
  if (receiver == null) {
    // Add new owner and increment token number of owners
    receiver = createAccount(event.params.data.to);
  }
  receiver.mintCount = receiver.mintCount.plus(ONE_BI);
  receiver.transactionsCount = receiver.transactionsCount.plus(ONE_BI);
  receiver.save();

  let operator = Account.load(event.params.operator.toHexString())!;
  operator.transactionsAsOperatorCount = operator.transactionsAsOperatorCount.plus(ONE_BI);
  operator.save();

  let transaction = createTransaction(
    event.transaction.hash.toHexString(),
    event.params.operator.toHexString(),
    event.params.data.to.toHexString(),
    "Mint");
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUsed = event.block.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  let assetAmounts = transaction.assetAmounts;
  let assets = transaction.assets;

  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());

    // Add Asset Mint Count
    let asset = Asset.load(assetId)!;
    asset.mintCount = asset.mintCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.plus(amounts[i]);
    asset.transactionsCount = asset.transactionsCount.plus(ONE_BI);
    asset.save();

    let assetAmount = new TransactionAssetAmount(concat(event.transaction.hash.toHexString(), assetId));
    assetAmount.asset = assetId;
    assetAmount.amount = amounts[i];
    assetAmount.save();

    // Update transaction arrays
    assets.push(assetId);
    assetAmounts.push(assetAmount.id);
  }

  transaction.assets = assets;
  transaction.assetAmounts = assetAmounts;
  transaction.save();
}

export function handleBurn(event: BurnEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.address.toHexString())!;

  // Add Account Burn Count; Cannot burn on an account that doesn't already exist
  let account = Account.load(event.params.data.account.toHexString())!;
  account.burnCount = account.burnCount.plus(ONE_BI);
  account.transactionsCount = account.transactionsCount.plus(ONE_BI);
  account.save();

  let operator = Account.load(event.params.operator.toHexString())!;
  operator.transactionsAsOperatorCount = operator.transactionsAsOperatorCount.plus(ONE_BI);
  operator.save();

  let transaction = createTransaction(
    event.transaction.hash.toHexString(),
    event.params.operator.toHexString(),
    event.params.data.account.toHexString(),
    "Burn");
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUsed = event.block.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  let assetAmounts = transaction.assetAmounts;
  let assets = transaction.assets;

  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());

    // Add Asset Burn Count
    let asset = Asset.load(assetId)!;
    asset.burnCount = asset.burnCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.minus(amounts[i]);
    asset.transactionsCount = asset.transactionsCount.plus(ONE_BI);
    asset.save();
    
    let assetAmount = new TransactionAssetAmount(concat(event.transaction.hash.toHexString(), assetId));
    assetAmount.asset = assetId;
    assetAmount.amount = amounts[i];
    assetAmount.save();

    // Update transaction arrays
    assets.push(assetId);
    assetAmounts.push(assetAmount.id);
  }

  transaction.assets = assets;
  transaction.assetAmounts = assetAmounts;
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
  let parent = Content.load(event.params.parent.toHexString())!;
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
  let parent = Content.load(event.params.parent.toHexString())!;
  parent.royaltyRate = event.params.rate;
  parent.royaltyReceiver = event.params.receiver.toHexString();
  parent.save();
}
 
export function handleHiddenUriUpdated(event: HiddenUriUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString())!;
  let assetId = getAssetId(parent.id, event.params.id.toString());
  let asset = Asset.load(assetId);
  if (asset == null) {
    asset = createAsset(assetId, parent.id, event.params.id);
  }
  asset.latestHiddenUriVersion = event.params.version;
  asset.save();
}
 
export function handlePublicUriUpdated(event: PublicUriUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString())!;
  let assetId = getAssetId(parent.id, event.params.id.toString());
  let asset = Asset.load(assetId);
  if (asset == null) {
    asset = createAsset(assetId, parent.id, event.params.id);
  }
  asset.latestPublicUriVersion = event.params.version;
  asset.save();
  
  // Set Information from the Asset's public uri
  let content = ContentContract.bind(Address.fromString(parent.id));
  let hash = content.uri(event.params.id);
  updateAssetPublicUri(assetId, hash);
}
 
export function handleTokenRoyaltyUpdated(event: TokenRoyaltyUpdatedEvent): void {
  let parent = Content.load(event.params.parent.toHexString())!;
  // Delete all asset royalties first
  let assetId = getAssetId(parent.id, event.params.tokenId.toString());
  let asset = Asset.load(assetId);
  if (asset == null) {
    asset = createAsset(assetId, parent.id, event.params.tokenId);
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
    let content = Content.load(accessControlManager.parent().toHexString())!;    
    let minterId = getMinterId(content.id, event.params.account.toHexString());
    let minter = Minter.load(minterId);
    if (minter == null) {
      minter = createMinter(minterId, content.id, event.params.account.toHexString());
      content.mintersCount += 1;
      content.save();
    }
  }
}

export function handleRoleRevoked(event: RoleRevokedEvent) : void {
  // Get minter role and compare if it is the role that was revoked
  let accessControlManager = AccessControlManagerContract.bind(event.address);
  if (event.params.role == accessControlManager.MINTER_ROLE()) {
    let content = Content.load(accessControlManager.parent().toHexString())!;    
    let minterId = getMinterId(content.id, event.params.account.toHexString());
    store.remove('Minter', minterId);
    content.mintersCount -= 1;
    content.save();
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent) : void {
  // Note: the ContentManager and Content objects must already exist at this point
  let contentManager = ContentManager.load(event.address.toHexString())!;
  let content = Content.load(contentManager.content)!;
  
  // Create Account object for 'owner' if it doesn't exist
  let owner = Account.load(event.params.newOwner.toHexString());
  if (owner == null) {
    // Create owner
    owner = createAccount(event.params.newOwner);
  }

  contentManager.owner = owner.id;
  contentManager.save();

  content.owner = owner.id;
  content.save();
}