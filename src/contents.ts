import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"
import {
  ContentManagerRegistered
} from "../generated/ContractRegistry/ContractRegistry";
import {
  Content as ContentContract,
  TransferBatch as TransferBatchEvent,
  TransferSingle as TransferSingleEvent,
  Mint as MintEvent,
  Burn as BurnEvent
} from "../generated/templates/Content/Content";
import {
  ContentManager as ContentManagerContract
} from "../generated/templates/ContentManager/ContentManager";
import {
  ContentStorage as ContentStorageContract,
  AssetsAdded as AssetsAddedEvent,
  ContractRoyaltiesUpdated as ContractRoyaltiesUpdatedEvent,
  HiddenTokenUriUpdated as HiddenTokenUriUpdatedEvent,
  PublicTokenUriUpdated as PublicTokenUriUpdatedEvent,
  TokenRoyaltiesUpdated as TokenRoyaltiesUpdatedEvent
} from "../generated/templates/ContentStorage/ContentStorage";
import {
  SystemsRegistry as SystemsRegistryContract
} from "../generated/templates/SystemsRegistry/SystemsRegistry";
import {
  UserApproved as UserApprovedEvent,
  RegisteredSystemsUpdated as RegisteredSystemsUpdatedEvent
} from "../generated/templates/SystemsRegistry/SystemsRegistry";
import { 
  ContractRegistry as Registry,
  ContentManager,
  Asset,
  AssetBalance,
  Content,
  Account,
  AssetFee,
  ContractFee,
  UserApproval,
  Operator
} from "../generated/schema";

import {
  createContentManager,
  createAccount,
  createAsset,
  createAssetBalance,
  createAssetFees,
  createContractFees,
  createUserApproval,
  createOperator,
  createTransaction,
  createMintTransaction,
  createBurnTransaction,
  getAssetId,
  getAssetBalanceId,
  getAssetFeeId,
  getContractFeeId,
  getUserApprovalId,
  getOperatorId,
  getTransactionId,
  createContractRegistry
} from "./content-helpers";

import { ADDRESS_ZERO, ONE_BI, ZERO_BI } from "./constants";
 
export function handleContentManagerRegistered(event: ContentManagerRegistered): void {
  // let owner = event.params.owner.toHexString();
  let registry = Registry.load(event.address.toHexString());
  if (registry == null) {
    registry = createContractRegistry(event.address, event.params.owner);
  }

  let contentManager = ContentManager.load(event.params.contentManager.toHexString());
  if (contentManager == null) {
    contentManager = createContentManager(event.params.contentManager, event.params.owner, registry.id);
  }

  // Todo: set up content contract royalties
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

  let transaction = createTransaction(event.transaction.hash.toHexString());
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.save();

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());
    let mintId = getTransactionId(transaction.id, assetIds[i].toString());
    let mintTransaction = createMintTransaction(
      mintId,
      transaction.id,
      event.params.operator.toHexString(),
      event.params.data.to.toHexString(),
      assetId
    );

    let asset = Asset.load(assetId);
    asset.mintCount = asset.mintCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.plus(amounts[i]);
    asset.save();
  }
}

export function handleBurn(event: BurnEvent): void {
  // make sure parent content contract has been loaded
  let parent = Content.load(event.address.toHexString());
  if (parent == null) {
    return;
  }

  let transaction = createTransaction(event.transaction.hash.toHexString());
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.save();

  let assetIds = event.params.data.tokenIds;
  let amounts = event.params.data.amounts;
  for (let i = 0; i < assetIds.length; ++i) {
    let assetId = getAssetId(parent.id, assetIds[i].toString());
    let burnId = getTransactionId(transaction.id, assetIds[i].toString());
    let burnTransaction = createBurnTransaction(
      burnId,
      transaction.id,
      event.params.operator.toHexString(),
      event.params.data.account.toHexString(),
      assetId
    );

    let asset = Asset.load(assetId);
    asset.burnCount = asset.burnCount.plus(ONE_BI);
    asset.currentSupply = asset.currentSupply.minus(amounts[i]);
    asset.save();
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

    // Note: we cannot iterate through 'derived' properties. Instead, we have to manually
    // manage them. This is the case for asset royalties and contract royalties
    let royaltyFeesLength = newAsset.fees.length;
    let fees = newAsset.fees;
    let royalties = asset.assetRoyalties;
    for (let i = 0; i < royaltyFeesLength; ++i) {
      let account = fees[i].account;
      let feeId = getAssetFeeId(parent.id, account.toHexString(), tokenId.toString());
      let fee = AssetFee.load(feeId);
      if (fee == null) {
        fee = createAssetFees(feeId, account, asset.id);
        royalties.push(fee.id);
      }
      fee.rate = fees[i].rate;
      fee.save();
    }
    asset.assetRoyalties = royalties;
    asset.save();
  }
}
 
export function handleContractRoyaltiesUpdated(event: ContractRoyaltiesUpdatedEvent): void {
  // createContractFees
  let parent = Content.load(event.params.parent.toHexString());
  if (parent == null) {
    return;
  }
  
  // Delete existing contract royalties
  parent.contractRoyalties.forEach(currentFee => {
    let fee = ContractFee.load(currentFee);
    fee.rate = ZERO_BI;
    fee.save();
  });

  // For every asset added, create a new asset object
  let fees = event.params.fees;
  let royalties = parent.contractRoyalties;
  for (let i = 0; i < fees.length; ++i) {
    let feeId = getContractFeeId(parent.id, fees[i].account.toHexString());
    let fee = ContractFee.load(feeId);
    if (fee == null) {
      fee = createContractFees(feeId, fees[i].account, parent.id);
      royalties.push(fee.id);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }
  parent.contractRoyalties = royalties;
  parent.save();
}
 
export function handleHiddenTokenUriUpdated(event: HiddenTokenUriUpdatedEvent): void {
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
 
export function handlePublicTokenUriUpdated(event: PublicTokenUriUpdatedEvent): void {
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
 
export function handleTokenRoyaltiesUpdated(event: TokenRoyaltiesUpdatedEvent): void {
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

  asset.assetRoyalties.forEach(currentFeeId => {
    let fee = AssetFee.load(currentFeeId);
    fee.rate = ZERO_BI;
    fee.save();
  });

  // Add/update new asset royalties
  let fees = event.params.fees;
  let royalties = asset.assetRoyalties;
  for (let i = 0; i < fees.length; ++i) {
    let assetFeeId = getAssetFeeId(parent.id, fees[i].account.toHexString(), asset.tokenId.toString());
    let fee = AssetFee.load(assetFeeId);
    if (fee == null) {
      fee = createAssetFees(assetFeeId, fees[i].account, assetId);
      royalties.push(fee.id);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }
  asset.assetRoyalties = royalties;
  asset.save();
}

// SystemsRegistry Events
export function handleUserApproved(event: UserApprovedEvent): void {
  let parent = Content.load(event.params.contentContract.toHexString());
  if (parent == null) {
    return;
  }

  let user = Account.load(event.params.user.toHexString());
  if (user == null) {
    user = createAccount(event.params.user);
    user.save();
  }

  let approvalId = getUserApprovalId(parent.id, event.params.user.toHexString());
  let approval = UserApproval.load(approvalId);
  if (approval == null) {
    approval = createUserApproval(approvalId, parent.id, user.id);
  }
  approval.approved = event.params.approved;
  approval.save();
}

// Content 
export function handleRegisteredSystemsUpdated(event: RegisteredSystemsUpdatedEvent): void {
  let parent = Content.load(event.params.contentContract.toHexString());
  if (parent == null) {
    return;
  }

  let operatorPairs = event.params.operators;
  for (let i = 0; i < operatorPairs.length; ++i) {
    // let operatorPair = operatorPairs[i];
    let operatorId = getOperatorId(parent.id, operatorPairs[i].operator.toHexString());
    let operator = Operator.load(operatorId);
    if (operator == null) {
      operator = createOperator(operatorId, parent.id, operatorPairs[i].operator);
    }
    operator.approved = operatorPairs[i].approved;
    operator.save();
  }
}