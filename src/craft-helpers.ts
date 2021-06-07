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

import { ADDRESS_ZERO, ZERO_BI } from "./constants";

export function createContractRegistry(id: Address, creator: Address): Registry {
  let contractRegistry = new Registry(id.toHexString());
  contractRegistry.save();
  return contractRegistry;
}

export function createCraft(id: Address, manager: Address, registry: string): Craft {
  CraftTemplate.create(id);
  let craft = new Craft(id.toHexString());
  craft.registry = registry;
  craft.recipesCount = ZERO_BI;
  craft.craftCount = ZERO_BI;
  craft.parents = [];
  craft.save();
  return craft;
}

export function createSalvage(id: Address, manager: Address, registry: string): Salvage {
  SalvageTemplate.create(id);
  let salvage = new Salvage(id.toHexString());
  salvage.registry = registry;
  salvage.salvageableAssetsCount = ZERO_BI;
  salvage.salvageCount = ZERO_BI;
  salvage.parents = [];
  salvage.save();
  return salvage;
}

export function createTransaction(id: string): Transaction {
  let transaction = new Transaction(id);
  transaction.blockNumber = ZERO_BI;
  transaction.timestamp = ZERO_BI;
  transaction.gasUSed = ZERO_BI;
  transaction.gasPrice = ZERO_BI;
  transaction.save();
  return transaction;
}

export function createCraftTransaction(id: string, transactionId: string): CraftTransaction {
  let transaction = new CraftTransaction(id);
  transaction.account = "";
  transaction.transaction = transactionId;
  transaction.recipe = "";
  transaction.contract = "";
  transaction.amount = ZERO_BI;
  transaction.save();
  return transaction;
}

export function createSalvageTransaction(id: string, transactionId: string): SalvageTransaction {
  let transaction = new SalvageTransaction(id);
  transaction.account = "";
  transaction.transaction = transactionId;
  transaction.salvageableAsset = "";
  transaction.contract = "";
  transaction.amount = ZERO_BI;
  transaction.save();
  return transaction;
}

export function createAccount(address: Address): Account {
  let account = new Account(address.toHexString());
  account.craftCount = ZERO_BI;
  account.salvageCount = ZERO_BI;
  account.save();
  return account;
}

export function createRecipe(id: string, parent: string, recipeId: BigInt): Recipe {
  let recipe = new Recipe(id);
  recipe.recipeId = recipeId;
  recipe.craftCount = ZERO_BI;
  recipe.parent = parent;
  recipe.enabled = false;
  recipe.save();
  return recipe;
}

export function createSalvageableAsset(id: string, parent: string, salvageableAssetId: BigInt): SalvageableAsset {
  let asset = new SalvageableAsset(id);
  asset.content = Address.fromString(ADDRESS_ZERO);
  asset.tokenId = ZERO_BI;
  asset.salvageId = salvageableAssetId;
  asset.salvageCount = ZERO_BI;
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