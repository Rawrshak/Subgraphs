import { ByteArray, BigInt, Address, crypto } from "@graphprotocol/graph-ts"

import { 
  ContractRegistry as Registry,
  Account,
  Transaction,
  CraftTransaction,
  SalvageTransaction,
  Craft,
  Salvage,
  Recipe,
  SalvageableAsset
} from "../generated/schema";

import {
    Craft as CraftTemplate,
    Salvage as SalvageTemplate
} from '../generated/templates';

let zeroAddress = '0x0000000000000000000000000000000000000000';

export function createContractRegistry(id: Address, creator: Address): Registry {
  let contractRegistry = new Registry(id.toHexString());
  contractRegistry.save();
  return contractRegistry;
}

export function createCraft(id: Address, manager: Address, registry: string): Craft {
  CraftTemplate.create(id);
  let craft = new Craft(id.toHexString());
  craft.registry = registry;
  craft.recipesCount = BigInt.fromI32(0);
  craft.craftCount = BigInt.fromI32(0);
  craft.parents = [];
  craft.save();
  return craft;
}

export function createSalvage(id: Address, manager: Address, registry: string): Salvage {
  SalvageTemplate.create(id);
  let salvage = new Salvage(id.toHexString());
  salvage.registry = registry;
  salvage.salvageableAssetsCount = BigInt.fromI32(0);
  salvage.salvageCount = BigInt.fromI32(0);
  salvage.parents = [];
  salvage.save();
  return salvage;
}

export function createTransaction(id: string): Transaction {
  let transaction = new Transaction(id);
  transaction.blockNumber = BigInt.fromI32(0);
  transaction.timestamp = BigInt.fromI32(0);
  transaction.gasUSed = BigInt.fromI32(0);
  transaction.gasPrice = BigInt.fromI32(0);
  transaction.save();
  return transaction;
}

export function createCraftTransaction(id: string, transactionId: string): CraftTransaction {
  let transaction = new CraftTransaction(id);
  transaction.account = "";
  transaction.transaction = transactionId;
  transaction.recipe = "";
  transaction.contract = "";
  transaction.amount = BigInt.fromI32(0);
  transaction.save();
  return transaction;
}

export function createSalvageTransaction(id: string, transactionId: string): SalvageTransaction {
  let transaction = new SalvageTransaction(id);
  transaction.account = "";
  transaction.transaction = transactionId;
  transaction.salvageableAsset = "";
  transaction.contract = "";
  transaction.amount = BigInt.fromI32(0);
  transaction.save();
  return transaction;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.craftCount = BigInt.fromI32(0);
  account.salvageCount = BigInt.fromI32(0);
  account.save();
  return account;
}

export function createRecipe(id: string, parent: string, recipeId: BigInt): Recipe {
  let recipe = new Recipe(id);
  recipe.recipeId = recipeId;
  recipe.craftCount = BigInt.fromI32(0);
  recipe.parent = parent;
  recipe.enabled = false;
  recipe.save();
  return recipe;
}

export function createSalvageableAsset(id: string, parent: string, salvageableAssetId: BigInt): SalvageableAsset {
  let asset = new SalvageableAsset(id);
  asset.content = Address.fromString(zeroAddress);
  asset.tokenId = BigInt.fromI32(0);
  asset.salvageId = salvageableAssetId;
  asset.salvageCount = BigInt.fromI32(0);
  asset.parent = parent;
  asset.save();
  return asset;
}

export function getRecipeId(craft: string, id: string): string {
  return concat(craft, id);
}

export function getSalvageableAssetId(craft: string, content: string, tokenId: string): string {
  return concat2(craft, content, tokenId);
}

export function getTransactionId(transactionId: string, assetId: string): string {
  return concat(transactionId, assetId);
}

function concat(str1: string, str2: string): string {
  return str1 + '-' + str2;
}

function concat2(str1: string, str2: string, str3: string): string {
  return str1 + '-' + str2 + '-' + str3;
}