import { log, ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import {
  CraftRegistered as CraftRegisteredEvent,
  SalvageRegistered as SalvageRegisteredEvent
} from "../generated/ContractRegistry/ContractRegistry";

import {
  Craft as CraftContract,
  AssetsCrafted as AssetsCraftedEvent,
  RecipeCraftingRateUpdated as RecipeCraftingRateUpdatedEvent,
  RecipeEnabled as RecipeEnabledEvent,
  RecipeUpdated as RecipeUpdatedEvent
} from "../generated/templates/Craft/Craft";

import {
  Salvage as SalvageContract,
  AssetSalvaged as AssetSalvagedEvent,
  AssetSalvagedBatch as AssetSalvagedBatchEvent,
  SalvageableAssetsUpdated as SalvageableAssetsUpdatedEvent
} from "../generated/templates/Salvage/Salvage";

import { 
  ContractRegistry as Registry,
  Content,
  Account,
  Craft,
  Salvage,
  Recipe,
  SalvageableAsset,
  Transaction,
  CraftTransaction,
  SalvageTransaction
} from "../generated/schema";

import {
  createContractRegistry,
  createCraft,
  createSalvage,
  createRecipe,
  createTransaction,
  getRecipeId,
  getSalvageableAssetId,
  getTransactionId,
  createCraftTransaction,
  createSalvageTransaction,
  createSalvageableAsset,
  createAccount
} from "./craft-helpers";

let zeroAddress = '0x0000000000000000000000000000000000000000';

export function handleCraftRegistered(event: CraftRegisteredEvent): void {
  let registry = Registry.load(event.address.toHexString());
  if (registry == null) {
    registry = createContractRegistry(event.address, event.params.manager);
  }

  let craft = Craft.load(event.params.craft.toHexString());
  if (craft == null) {
    craft = createCraft(event.params.craft, event.params.manager, registry.id);
  }
}

export function handleSalvageRegistered(event: SalvageRegisteredEvent): void {
  let registry = Registry.load(event.address.toHexString());
  if (registry == null) {
    registry = createContractRegistry(event.address, event.params.manager);
  }
  
  let salvage = Salvage.load(event.params.salvage.toHexString());
  if (salvage == null) {
    salvage = createSalvage(event.params.salvage, event.params.manager, registry.id);
  }
}

export function handleAssetsCrafted(event: AssetsCraftedEvent): void {
  // Get Craft contract and increment craft count
  let craft = Craft.load(event.address.toHexString());
  if (craft == null) {
    return;
  }
  craft.craftCount = craft.craftCount.plus(BigInt.fromI32(1));
  craft.save();

  // Get recipe and increment craft count
  let recipeId = getRecipeId(craft.id, event.params.id.toString());
  let recipe = Recipe.load(recipeId);
  recipe.craftCount = recipe.craftCount.plus(BigInt.fromI32(1));
  recipe.save();

  // Get account and increment craft count
  let account = Account.load(event.params.user.toHexString());
  if (account == null) {
      account = createAccount(event.params.user);
  }
  account.craftCount = account.craftCount.plus(BigInt.fromI32(1));
  account.save();

  // Create Craft Transaction
  let transaction = createTransaction(event.transaction.hash.toHexString());
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.save();

  let transactionId = getTransactionId(transaction.id, recipeId);
  let craftTransaction = createCraftTransaction(transactionId, transaction.id);
  craftTransaction.account = account.id;
  craftTransaction.recipe = recipeId;
  craftTransaction.contract = craft.id;
  craftTransaction.amount = event.params.amountSucceeded;
  craftTransaction.save();
}

export function handleRecipeUpdated(event: RecipeUpdatedEvent): void {
  // event RecipeUpdated(address indexed operator, LibCraft.Recipe[] recipes);
  // Get Craft contract
  let craft = Craft.load(event.address.toHexString());
  if (craft == null) {
    return;
  }

  let recipes = event.params.recipes;
  for (let i = 0; i < recipes.length; ++i) {
    // Get recipe and increment craft count
    let recipeId = getRecipeId(craft.id, recipes[i].id.toString());
    let recipe = Recipe.load(recipeId);
    if (recipe == null) {
      recipe = createRecipe(recipeId, craft.id, recipes[i].id);
      craft.recipesCount = craft.recipesCount.plus(BigInt.fromI32(1));
    }
    recipe.enabled = recipes[i].enabled;
    recipe.save(); 
  }

  craft.save();
}

export function handleRecipeEnabled(event: RecipeEnabledEvent): void {
  let craft = Craft.load(event.address.toHexString());
  if (craft == null) {
    return;
  }

  let recipeId = getRecipeId(craft.id, event.params.id.toString());
  let recipe = Recipe.load(recipeId);
  if (recipe != null) {
    recipe.enabled = event.params.enabled;
    recipe.save();
  }
}

export function handleAssetSalvaged(event: AssetSalvagedEvent): void {
  // Get Salvage contract and increment salvage count
  let salvage = Salvage.load(event.address.toHexString());
  if (salvage == null) {
    return;
  }
  salvage.salvageCount = salvage.salvageCount.plus(BigInt.fromI32(1));
  salvage.save();

  // Get salvageable asset and increment salvage count
  let assetId = getSalvageableAssetId(salvage.id, event.params.asset.content.toHexString(), event.params.asset.tokenId.toString());
  let asset = SalvageableAsset.load(assetId);
  asset.salvageCount = asset.salvageCount.plus(BigInt.fromI32(1));
  asset.save();

  // Get account and increment salvage count
  let account = Account.load(event.params.user.toHexString());
  if (account == null) {
      account = createAccount(event.params.user);
  }
  account.salvageCount = account.salvageCount.plus(BigInt.fromI32(1));
  account.save();

  // Create Salvage Transaction
  let transaction = createTransaction(event.transaction.hash.toHexString());
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.save();
  
  let transactionId = getTransactionId(transaction.id, assetId);
  let salvageTransaction = createSalvageTransaction(transactionId, transaction.id);
  salvageTransaction.account = account.id;
  salvageTransaction.salvageableAsset = asset.id;
  salvageTransaction.contract = salvage.id;
  salvageTransaction.amount = event.params.amount;
  salvageTransaction.save();
}

export function handleAssetSalvagedBatch(event: AssetSalvagedBatchEvent): void {
  // Get Salvage contract and increment salvage count
  let salvage = Salvage.load(event.address.toHexString());
  if (salvage == null) {
    return;
  }
  salvage.salvageCount = salvage.salvageCount.plus(BigInt.fromI32(1));
  salvage.save();
  
  // Get account and increment salvage count
  let account = Account.load(event.params.user.toHexString());
  if (account == null) {
    account = createAccount(event.params.user);
  }
  account.salvageCount = account.salvageCount.plus(BigInt.fromI32(1));
  account.save();
  
  // Create Salvage Transaction
  let transaction = createTransaction(event.transaction.hash.toHexString());
  transaction.blockNumber = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.gasUSed = event.transaction.gasUsed;
  transaction.gasPrice = event.transaction.gasPrice;
  transaction.save();
  
  // Get salvageable asset and increment salvage count
  let salvageableAssets = event.params.assets;
  let amounts = event.params.amounts;
  for (let i = 0; i < salvageableAssets.length; ++i) {
    let assetId = getSalvageableAssetId(salvage.id, salvageableAssets[i].content.toHexString(), salvageableAssets[i].tokenId.toString());
    let asset = SalvageableAsset.load(assetId);
    asset.salvageCount = asset.salvageCount.plus(BigInt.fromI32(1));
    asset.save();

    let transactionId = getTransactionId(transaction.id, assetId);
    let salvageTransaction = createSalvageTransaction(transactionId, transaction.id);
    salvageTransaction.account = account.id;
    salvageTransaction.salvageableAsset = asset.id;
    salvageTransaction.contract = salvage.id;
    salvageTransaction.amount = amounts[i];
    salvageTransaction.save();
  }
}

export function handleSalvageableAssetsUpdated(event: SalvageableAssetsUpdatedEvent): void {
  // Get Salvage contract and increment salvage count
  let salvage = Salvage.load(event.address.toHexString());
  if (salvage == null) {
    return;
  }

  let salvageableAssets = event.params.assets;
  let ids = event.params.ids;
  for (let i = 0; i < salvageableAssets.length; ++i) {
    // Get recipe and increment craft count
    let assetId = getSalvageableAssetId(salvage.id, salvageableAssets[i].asset.content.toHexString(), salvageableAssets[i].asset.tokenId.toString());
    let salvageableAsset = SalvageableAsset.load(assetId);
    if (salvageableAsset == null) {
      salvageableAsset = createSalvageableAsset(assetId, salvage.id, ids[i]);
      salvageableAsset.content = salvageableAssets[i].asset.content;
      salvageableAsset.tokenId = salvageableAssets[i].asset.tokenId;
      salvageableAsset.save();
      salvage.salvageableAssetsCount = salvage.salvageableAssetsCount.plus(BigInt.fromI32(1));
    }
  }

  salvage.save();
}
