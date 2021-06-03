import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"
import {
  ContentManagerRegistered
} from "../generated/ContentManagerRegistry/ContentManagerRegistry";
import {
  Content as ContentContract,
  TransferBatch as TransferBatchEvent,
  TransferSingle as TransferSingleEvent
} from "../generated/templates/Content/Content";
import {
  ContentManager as ContentManagerContract
} from "../generated/templates/ContentManager/ContentManager";
import {
  ContentStorage as ContentStorageContract,
  AssetsAdded as AssetsAddedEvent,
  ContractRoyaltiesUpdated as ContractRoyaltiesUpdatedEvent,
  HiddenTokenUriUpdated as HiddenTokenUriUpdatedEvent,
  TokenRoyaltiesUpdated as TokenRoyaltiesUpdatedEvent,
  TokenUriPrefixUpdated as TokenUriPrefixUpdatedEvent
} from "../generated/templates/ContentStorage/ContentStorage";
import {
  SystemsRegistry as SystemsRegistryContract
} from "../generated/templates/SystemsRegistry/SystemsRegistry";
import {
  UserApproved as UserApprovedEvent,
  RegisteredSystemsUpdated as RegisteredSystemsUpdatedEvent
} from "../generated/templates/SystemsRegistry/SystemsRegistry";
import { 
  ContentManagerRegistry as Registry,
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
  getAssetId,
  getAssetBalanceId,
  getAssetFeeId,
  getContractFeeId,
  getUserApprovalId,
  getOperatorId,
  createContentManagerRegistry
} from "./content-helpers";

let zeroAddress = '0x0000000000000000000000000000000000000000';
 
export function handleContentManagerRegistered(event: ContentManagerRegistered): void {
  // let owner = event.params.owner.toHexString();
  let registry = Registry.load(event.address.toHexString());
  if (registry == null) {
    registry = createContentManagerRegistry(event.address, event.params.owner);
  }

  let contentManager = ContentManager.load(event.params.contentManager.toHexString());
  if (contentManager == null) {
    contentManager = createContentManager(event.params.contentManager, event.params.owner, registry.id);
  }
}

// // Content Events
// export function handleTransferBatch(event: TransferBatchEvent): void {
//   //TransferBatch(address operator, address from, address to, uint256[] ids, u as TransferSingleEventint256[] values)
//   // transfer multiple assets
//   let content = Content.load(event.address.toHexString());
//   if (content == null) {
//     return;
//   }
//   if (content != null) {
//     let ids = event.params.ids;
//     let amounts = event.params.values;
//     for (let i = 0; i < event.params.ids.length; ++i) {
//       // get/create asset
//       let assetId = getAssetId(content.id, ids[i].toString());
//       let asset = Asset.load(assetId);
//       if (asset == null) {
//         asset = createAsset(assetId, content.id, ids[i]);
//         asset.save();
//       }

//       if (event.params.to.toHex() != zeroAddress) {
//         // receiver exists
//         let receiver = Account.load(event.params.to.toHexString());
//         if (receiver == null) {
//           // Add new owner and increment token number of owners
//           receiver = createAccount(event.params.to);
//         }

//         // get/create account balance
//         let assetBalanceId = getAssetBalanceId(content.id, receiver.id, ids[i].toString());
//         let balance = AssetBalance.load(assetBalanceId);
//         if (balance == null) {
//           balance = createAssetBalance(assetBalanceId, asset.id, receiver.id);
//         }

//         balance.amount = balance.amount.plus(amounts[i]);
//         balance.save();
//         receiver.save();
//       }

//       if (event.params.from.toHex() != zeroAddress) {
//         // sender exists
//         let sender = Account.load(event.params.from.toHexString());
        
//         // get/create account balance
//         let assetBalanceId = getAssetBalanceId(content.id, sender.id, ids[i].toString());
//         let balance = AssetBalance.load(assetBalanceId);
        
//         balance.amount = balance.amount.minus(amounts[i]);
//         balance.save();
//       }
//     }
//   }
// }
 
// export function handleTransferSingle(event: TransferSingleEvent): void {
//   let content = Content.load(event.address.toHexString());
//   if (content == null) {
//     return;
//   }
//   // get/create asset
//   let assetId = getAssetId(content.id, event.params.id.toString());
//   let amount = event.params.value;
//   let asset = Asset.load(assetId);
//   if (asset == null) {
//     asset = createAsset(assetId, content.id, event.params.id);
//     asset.save();
//   }

//   if (event.params.to.toHex() != zeroAddress) {
//     // receiver exists
//     let receiver = Account.load(event.params.to.toHexString());
//     if (receiver == null) {
//       // Add new owner and increment token number of owners
//       receiver = createAccount(event.params.to);
//     }

//     // get/create account balance
//     let assetBalanceId = getAssetBalanceId(content.id, receiver.id, event.params.id.toString());
//     let balance = AssetBalance.load(assetBalanceId);
//     if (balance == null) {
//       balance = createAssetBalance(assetBalanceId, asset.id, receiver.id);
//     }

//     balance.amount = balance.amount.plus(amount);
//     balance.save();
//     receiver.save();
//   }

//   if (event.params.from.toHex() != zeroAddress) {
//     // sender exists
//     let sender = Account.load(event.params.from.toHexString());
    
//     // get/create account balance
//     let assetBalanceId = getAssetBalanceId(content.id, sender.id, event.params.id.toString());
//     let balance = AssetBalance.load(assetBalanceId);
    
//     balance.amount = balance.amount.minus(amount);
//     balance.save();
//   }
// }

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
    let assetId = getAssetId(parent.id, tokenId.toHexString());
    let asset = Asset.load(assetId);
    if (asset == null) {
      asset = createAsset(assetId, parent.id, tokenId);
    }
    asset.maxSupply = newAsset.maxSupply;

    let royaltyFeesLength = newAsset.fees.length;
    let fees = newAsset.fees;
    for (let i = 0; i < royaltyFeesLength; ++i) {
      let account = fees[i].account;
      let feeId = getAssetFeeId(parent.id, account.toHexString(), tokenId.toHexString());
      let fee = AssetFee.load(feeId);
      if (fee == null) {
        fee = createAssetFees(feeId, account, asset.id);
      }
      fee.rate = fees[i].rate;
      fee.save();
    }
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
    fee.rate = BigInt.fromI32(0);
    fee.save();
  });

  // For every asset added, create a new asset object
  // let fees = event.params.fees;
  let fees = event.params.fees;
  for (let i = 0; i < fees.length; ++i) {
    // let newFee = fees[i];
    let feeId = getContractFeeId(parent.id, fees[i].account.toHexString());
    let fee = ContractFee.load(feeId);
    if (fee == null) {
      fee = createContractFees(feeId, fees[i].account, parent.id);
    }
    fee.rate = fees[i].rate;
    fee.save();
  }
}
 
// export function handleHiddenTokenUriUpdated(event: HiddenTokenUriUpdatedEvent): void {
//   let parent = Content.load(event.params.parent.toString());
//   if (parent == null) {
//     return;
//   }
//   // (address indexed parent, uint256 indexed id, uint256 indexed version);
//   let assetId = getAssetId(parent.id, event.params.id.toString());
//   let asset = Asset.load(assetId);
//   if (asset != null) {
//     asset.latestHiddenUriVersion = event.params.version;
//     asset.save();
//   }
// }
 
// export function handleTokenRoyaltiesUpdated(event: TokenRoyaltiesUpdatedEvent): void {
//   let parent = Content.load(event.params.parent.toString());
//   if (parent == null) {
//     return;
//   }
//   // Delete all asset royalties first
//   let assetId = getAssetId(parent.id, event.params.tokenId.toString());
//   let asset = Asset.load(assetId);
//   if (asset == null) {
//     return;
//   }

//   // let currentFees = asset.assetRoyalties;
//   asset.assetRoyalties.forEach(currentFeeId => {
//     let fee = AssetFee.load(currentFeeId);
//     fee.rate = BigInt.fromI32(0);
//     fee.save();
//   });

//   // Add/update new asset royalties
//   let fees = event.params.fees;
//   for (let i = 0; i < fees.length; ++i) {
//     // let newFee = fees[i];
//     let assetFeeId = getAssetFeeId(parent.id, fees[i].account.toString(), asset.tokenId.toString());
//     let fee = AssetFee.load(assetFeeId);
//     if (fee == null) {
//       fee = createAssetFees(assetFeeId, fees[i].account, assetId);
//     }
//     fee.rate = fees[i].rate;
//     fee.save();
//   }
//   asset.save();
// }
 
// export function handleTokenUriPrefixUpdated(event: TokenUriPrefixUpdatedEvent): void {
//   // event TokenUriPrefixUpdated(address indexed parent, string uriPrefix);
//   let parent = Content.load(event.params.parent.toString());
//   if (parent == null) {
//     return;
//   }
  
//   parent.contractUriPrefix = event.params.uriPrefix;
//   parent.save();
// }

// // SystemsRegistry Events
// export function handleUserApproved(event: UserApprovedEvent): void {
//   // UserApproved(address indexed contentContract, address indexed user, bool approved);
//   let parent = Content.load(event.params.contentContract.toString());
//   if (parent == null) {
//     return;
//   }

//   let user = Account.load(event.params.user.toString());
//   if (user == null) {
//     user = createAccount(event.params.user);
//     user.save();
//   }

//   let approvalId = getUserApprovalId(parent.id, event.params.user.toString());
//   let approval = UserApproval.load(approvalId);
//   if (approval == null) {
//     approval = createUserApproval(approvalId, parent.id, user.id);
//   }
//   approval.approved = event.params.approved;
//   approval.save();
// }

// // Content 
// export function handleRegisteredSystemsUpdated(event: RegisteredSystemsUpdatedEvent): void {
//   // RegisteredSystemsUpdated(address indexed contentContract, LibAsset.SystemApprovalPair[] operators);
//   // UserApproved(address indexed contentContract, address indexed user, bool approved);
//   let parent = Content.load(event.params.contentContract.toString());
//   if (parent == null) {
//     return;
//   }

//   let operatorPairs = event.params.operators;
//   for (let i = 0; i < operatorPairs.length; ++i) {
//     // let operatorPair = operatorPairs[i];
//     let operatorId = getOperatorId(parent.id, operatorPairs[i].operator.toString());
//     let operator = Operator.load(operatorId);
//     if (operator == null) {
//       operator = createOperator(operatorId, parent.id, operatorPairs[i].operator);
//     }
//     operator.approved = operatorPairs[i].approved;
//     operator.save();
//   }
// }