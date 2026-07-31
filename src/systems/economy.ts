import {
  accepted,
  appendReceipt,
  gameplayEvent,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isSafeIdentifier,
  rejected,
  type GameplayEvent,
  type GameplayUnlockRequirement,
  type SystemResult,
} from './types';

export interface WalletState {
  currencyId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export interface StoredItemDisposition {
  kind: 'stored';
}

export interface PlacedItemDisposition {
  kind: 'placed';
  placementId: string;
  locationId: string;
}

export type ItemDisposition = StoredItemDisposition | PlacedItemDisposition;

export interface OwnedItemInstance {
  instanceId: string;
  itemId: string;
  acquiredAtUtcMs: number;
  disposition: ItemDisposition;
}

/**
 * Stack quantities are suited to consumables and repeated small decorations.
 * Furniture can instead be represented by instances, which lets the world
 * renderer refer to one durable owned identity without duplicating ownership.
 */
export interface InventoryState {
  stacks: Record<string, number>;
  instances: Record<string, OwnedItemInstance>;
  policies: Record<string, InventoryPolicy>;
}

export interface EconomyState {
  wallet: WalletState;
  inventory: InventoryState;
  processedTransactionIds: string[];
}

export type InventoryStorageMode = 'stack' | 'instance';

export interface InventoryPolicy {
  storage: InventoryStorageMode;
  unique?: boolean;
  maxOwned?: number;
}

export interface ShopOffer {
  offerId: string;
  itemId: string;
  currencyId?: string;
  unitPrice: number;
  bundleSize?: number;
  active?: boolean;
  minimumLevel?: number;
  requiredAchievementIds?: readonly string[];
  progressRequirements?: readonly GameplayUnlockRequirement[];
}

export interface PurchaseRequest {
  commandId: string;
  offer: ShopOffer;
  bundles?: number;
  policy?: InventoryPolicy;
  nowUtcMs: number;
  playerLevel?: number;
  unlockedAchievementIds?: readonly string[];
  totalFocusMinutes?: number;
  progressCounters?: Readonly<Record<string, number>>;
  /**
   * Optional optimistic quote guard. The shop should create this fingerprint
   * while displaying a quote and send it back at checkout.
   */
  quoteFingerprint?: string;
}

export interface PurchaseReceipt {
  commandId: string;
  offerId: string;
  itemId: string;
  quantity: number;
  totalPrice: number;
  instanceIds: string[];
  balanceAfter: number;
}

export interface WalletReceipt {
  commandId: string;
  amount: number;
  balanceAfter: number;
}

export interface InventoryReceipt {
  commandId: string;
  itemId: string;
  quantity: number;
  instanceIds: string[];
}

const DEFAULT_POLICY: InventoryPolicy = { storage: 'stack' };

function compactInstanceId(source: string, index: number): string {
  const identifierCandidate: unknown = source;
  if (isSafeIdentifier(identifierCandidate)) return source;
  let hash = 2_166_136_261;
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    hash ^= source.charCodeAt(cursor);
    hash = Math.imul(hash, 16_777_619);
  }
  return `owned:${(hash >>> 0).toString(16).padStart(8, '0')}:${index}`;
}

export function createEconomyState(
  initialBalance = 0,
  currencyId = 'hikari',
): EconomyState {
  if (!isNonNegativeSafeInteger(initialBalance)) {
    throw new RangeError('Initial balance must be a non-negative safe integer.');
  }
  if (!isSafeIdentifier(currencyId)) {
    throw new RangeError('Currency id is invalid.');
  }
  return {
    wallet: {
      currencyId,
      balance: initialBalance,
      lifetimeEarned: initialBalance,
      lifetimeSpent: 0,
    },
    inventory: { stacks: {}, instances: {}, policies: {} },
    processedTransactionIds: [],
  };
}

export function getOwnedQuantity(inventory: InventoryState, itemId: string): number {
  const stacked = inventory.stacks[itemId] ?? 0;
  let instances = 0;
  for (const item of Object.values(inventory.instances)) {
    if (item.itemId === itemId) instances += 1;
  }
  return stacked + instances;
}

export function getStoredQuantity(inventory: InventoryState, itemId: string): number {
  const stacked = inventory.stacks[itemId] ?? 0;
  let instances = 0;
  for (const item of Object.values(inventory.instances)) {
    if (item.itemId === itemId && item.disposition.kind === 'stored') instances += 1;
  }
  return stacked + instances;
}

export function toOwnedItemCounts(inventory: InventoryState): Record<string, number> {
  const counts: Record<string, number> = { ...inventory.stacks };
  for (const item of Object.values(inventory.instances)) {
    counts[item.itemId] = (counts[item.itemId] ?? 0) + 1;
  }
  return counts;
}

export function createQuoteFingerprint(
  offer: ShopOffer,
  bundles = 1,
  policy: InventoryPolicy = DEFAULT_POLICY,
): string {
  const achievements = [...(offer.requiredAchievementIds ?? [])].sort().join(',');
  const progress = [...(offer.progressRequirements ?? [])]
    .map((requirement) =>
      requirement.kind === 'location-sessions'
        ? `${requirement.kind}:${requirement.locationId}:${requirement.atLeast}`
        : `${requirement.kind}:${requirement.atLeast}`,
    )
    .sort()
    .join(',');
  return [
    offer.offerId,
    offer.itemId,
    offer.currencyId ?? 'hikari',
    offer.unitPrice,
    offer.bundleSize ?? 1,
    bundles,
    policy.storage,
    policy.unique ? 1 : 0,
    policy.maxOwned ?? '',
    offer.minimumLevel ?? '',
    achievements,
    progress,
    offer.active === false ? 0 : 1,
  ].join('|');
}

function validateOffer(
  state: EconomyState,
  request: PurchaseRequest,
): SystemResult<EconomyState, { quantity: number; totalPrice: number; policy: InventoryPolicy }> {
  const { offer } = request;
  const bundles = request.bundles ?? 1;
  const bundleSize = offer.bundleSize ?? 1;
  const policy = request.policy ?? DEFAULT_POLICY;

  if (
    !isSafeIdentifier(request.commandId) ||
    !isSafeIdentifier(offer.offerId) ||
    !isSafeIdentifier(offer.itemId)
  ) {
    return rejected(state, 'INVALID_PURCHASE', 'Purchase ids may not be empty.');
  }
  if (!isNonNegativeSafeInteger(request.nowUtcMs)) {
    return rejected(state, 'INVALID_TIME', 'Purchase time must be a non-negative safe integer.');
  }
  if (!isPositiveSafeInteger(bundles) || !isPositiveSafeInteger(bundleSize)) {
    return rejected(state, 'INVALID_QUANTITY', 'Purchase quantity must be a positive safe integer.');
  }
  if (!isNonNegativeSafeInteger(offer.unitPrice)) {
    return rejected(state, 'INVALID_PRICE', 'Offer price must be a non-negative safe integer.');
  }
  if (offer.active === false) {
    return rejected(state, 'OFFER_UNAVAILABLE', 'This offer is no longer available.');
  }
  if ((offer.currencyId ?? state.wallet.currencyId) !== state.wallet.currencyId) {
    return rejected(state, 'WRONG_CURRENCY', 'The offer uses a different currency.');
  }
  if (policy.storage !== 'stack' && policy.storage !== 'instance') {
    return rejected(state, 'INVALID_INVENTORY_POLICY', 'Inventory storage mode is invalid.');
  }
  if (policy.unique !== undefined && typeof policy.unique !== 'boolean') {
    return rejected(state, 'INVALID_INVENTORY_POLICY', 'Unique ownership must be boolean.');
  }
  if (policy.maxOwned !== undefined && !isPositiveSafeInteger(policy.maxOwned)) {
    return rejected(state, 'INVALID_INVENTORY_POLICY', 'Maximum ownership must be positive.');
  }
  const persistedPolicy = state.inventory.policies[offer.itemId];
  if (
    persistedPolicy &&
    (persistedPolicy.storage !== policy.storage ||
      Boolean(persistedPolicy.unique) !== Boolean(policy.unique) ||
      persistedPolicy.maxOwned !== policy.maxOwned)
  ) {
    return rejected(state, 'INVENTORY_POLICY_MISMATCH', 'The item ownership policy changed unexpectedly.');
  }
  if ((request.playerLevel ?? 1) < (offer.minimumLevel ?? 1)) {
    return rejected(state, 'LEVEL_LOCKED', 'The required player level has not been reached.', {
      requiredLevel: offer.minimumLevel ?? 1,
    });
  }
  const unlocked = new Set(request.unlockedAchievementIds ?? []);
  const missingAchievement = (offer.requiredAchievementIds ?? []).find((id) => !unlocked.has(id));
  if (missingAchievement) {
    return rejected(state, 'ACHIEVEMENT_LOCKED', 'A required achievement is still locked.', {
      achievementId: missingAchievement,
    });
  }
  for (const requirement of offer.progressRequirements ?? []) {
    if (!isNonNegativeSafeInteger(requirement.atLeast)) {
      return rejected(state, 'INVALID_UNLOCK_REQUIREMENT', 'The offer has an invalid unlock requirement.');
    }
    const actual =
      requirement.kind === 'focus-minutes'
        ? request.totalFocusMinutes ?? 0
        : requirement.kind === 'rhythm-days'
          ? request.progressCounters?.qualifyingRhythmDays ?? 0
          : request.progressCounters?.[
              `locationStudySessions:${requirement.locationId}`
            ] ?? 0;
    if (actual < requirement.atLeast) {
      return rejected(state, 'PROGRESS_LOCKED', 'The item has not been unlocked by focus progress.', {
        requirement: requirement.kind,
        required: requirement.atLeast,
        actual,
      });
    }
  }
  if (request.quoteFingerprint) {
    const currentFingerprint = createQuoteFingerprint(offer, bundles, policy);
    if (request.quoteFingerprint !== currentFingerprint) {
      return rejected(state, 'STALE_QUOTE', 'The shop quote changed before checkout.');
    }
  }

  const quantity = bundles * bundleSize;
  const totalPrice = bundles * offer.unitPrice;
  if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(totalPrice)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'The purchase is too large to process safely.');
  }
  const currentOwned = getOwnedQuantity(state.inventory, offer.itemId);
  if (
    !isNonNegativeSafeInteger(currentOwned) ||
    !Number.isSafeInteger(currentOwned + quantity)
  ) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'The inventory quantity cannot increase safely.');
  }
  const limit = policy.unique ? 1 : policy.maxOwned;
  if (limit !== undefined) {
    if (currentOwned + quantity > limit) {
      return rejected(state, policy.unique ? 'UNIQUE_ALREADY_OWNED' : 'OWNERSHIP_LIMIT', 'There is not enough inventory capacity for this purchase.', {
        currentlyOwned: currentOwned,
        requested: quantity,
        maximum: limit,
      });
    }
  }
  if (state.wallet.balance < totalPrice) {
    return rejected(state, 'INSUFFICIENT_FUNDS', 'There is not enough hikari for this purchase.', {
      balance: state.wallet.balance,
      required: totalPrice,
    });
  }
  return accepted(state, { quantity, totalPrice, policy });
}

export function purchaseItem(
  state: EconomyState,
  request: PurchaseRequest,
): SystemResult<EconomyState, PurchaseReceipt> {
  if (state.processedTransactionIds.includes(request.commandId)) {
    return rejected(state, 'DUPLICATE_TRANSACTION', 'This purchase was already processed.');
  }

  const validation = validateOffer(state, request);
  if (!validation.ok) return validation;
  const { quantity, totalPrice, policy } = validation.value;

  const stacks = { ...state.inventory.stacks };
  const instances = { ...state.inventory.instances };
  const policies = {
    ...state.inventory.policies,
    [request.offer.itemId]: { ...policy },
  };
  const instanceIds: string[] = [];

  if (policy.storage === 'stack') {
    stacks[request.offer.itemId] = (stacks[request.offer.itemId] ?? 0) + quantity;
  } else {
    for (let index = 0; index < quantity; index += 1) {
      const instanceId = compactInstanceId(
        `${request.commandId}:${request.offer.itemId}:${index + 1}`,
        index + 1,
      );
      if (instances[instanceId]) {
        return rejected(state, 'INSTANCE_COLLISION', 'The generated item identity already exists.');
      }
      instances[instanceId] = {
        instanceId,
        itemId: request.offer.itemId,
        acquiredAtUtcMs: request.nowUtcMs,
        disposition: { kind: 'stored' },
      };
      instanceIds.push(instanceId);
    }
  }

  const wallet: WalletState = {
    ...state.wallet,
    balance: state.wallet.balance - totalPrice,
    lifetimeSpent: state.wallet.lifetimeSpent + totalPrice,
  };
  const next: EconomyState = {
    wallet,
    inventory: { stacks, instances, policies },
    processedTransactionIds: appendReceipt(state.processedTransactionIds, request.commandId),
  };
  const receipt: PurchaseReceipt = {
    commandId: request.commandId,
    offerId: request.offer.offerId,
    itemId: request.offer.itemId,
    quantity,
    totalPrice,
    instanceIds,
    balanceAfter: wallet.balance,
  };
  const events: GameplayEvent[] = [
    gameplayEvent(request.commandId, 'wallet.debited', request.nowUtcMs, {
      currencyId: wallet.currencyId,
      amount: totalPrice,
      balance: wallet.balance,
      reason: 'purchase',
    }),
    gameplayEvent(request.commandId, 'inventory.added', request.nowUtcMs, {
      itemId: request.offer.itemId,
      quantity,
      instanceIds,
    }, 1),
    gameplayEvent(request.commandId, 'shop.purchased', request.nowUtcMs, {
      offerId: request.offer.offerId,
      itemId: request.offer.itemId,
      quantity,
      totalPrice,
    }, 2),
  ];
  return accepted(next, receipt, events);
}

export function creditWallet(
  state: EconomyState,
  input: {
    commandId: string;
    amount: number;
    nowUtcMs: number;
    reason: string;
  },
): SystemResult<EconomyState, WalletReceipt> {
  if (state.processedTransactionIds.includes(input.commandId)) {
    return rejected(state, 'DUPLICATE_TRANSACTION', 'This wallet credit was already processed.');
  }
  if (!isSafeIdentifier(input.commandId) || !input.reason || !isPositiveSafeInteger(input.amount)) {
    return rejected(state, 'INVALID_CREDIT', 'Wallet credits require an id, reason, and positive integer amount.');
  }
  const balance = state.wallet.balance + input.amount;
  const lifetimeEarned = state.wallet.lifetimeEarned + input.amount;
  if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(lifetimeEarned)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'The wallet cannot safely hold this credit.');
  }
  const next: EconomyState = {
    ...state,
    wallet: { ...state.wallet, balance, lifetimeEarned },
    processedTransactionIds: appendReceipt(state.processedTransactionIds, input.commandId),
  };
  const receipt = { commandId: input.commandId, amount: input.amount, balanceAfter: balance };
  return accepted(next, receipt, [
    gameplayEvent(input.commandId, 'wallet.credited', input.nowUtcMs, {
      currencyId: state.wallet.currencyId,
      amount: input.amount,
      balance,
      reason: input.reason,
    }),
  ]);
}

export function spendWallet(
  state: EconomyState,
  input: {
    commandId: string;
    amount: number;
    nowUtcMs: number;
    reason: string;
  },
): SystemResult<EconomyState, WalletReceipt> {
  if (state.processedTransactionIds.includes(input.commandId)) {
    return rejected(state, 'DUPLICATE_TRANSACTION', 'This wallet debit was already processed.');
  }
  if (!isSafeIdentifier(input.commandId) || !input.reason || !isPositiveSafeInteger(input.amount)) {
    return rejected(state, 'INVALID_DEBIT', 'Wallet debits require an id, reason, and positive integer amount.');
  }
  if (state.wallet.balance < input.amount) {
    return rejected(state, 'INSUFFICIENT_FUNDS', 'There is not enough currency for this debit.');
  }
  const next: EconomyState = {
    ...state,
    wallet: {
      ...state.wallet,
      balance: state.wallet.balance - input.amount,
      lifetimeSpent: state.wallet.lifetimeSpent + input.amount,
    },
    processedTransactionIds: appendReceipt(state.processedTransactionIds, input.commandId),
  };
  const receipt = {
    commandId: input.commandId,
    amount: input.amount,
    balanceAfter: next.wallet.balance,
  };
  return accepted(next, receipt, [
    gameplayEvent(input.commandId, 'wallet.debited', input.nowUtcMs, {
      currencyId: state.wallet.currencyId,
      amount: input.amount,
      balance: next.wallet.balance,
      reason: input.reason,
    }),
  ]);
}

export function addInventoryItem(
  state: EconomyState,
  input: {
    commandId: string;
    itemId: string;
    quantity: number;
    policy?: InventoryPolicy;
    nowUtcMs: number;
  },
): SystemResult<EconomyState, InventoryReceipt> {
  const offer: ShopOffer = {
    offerId: `grant:${input.itemId}`,
    itemId: input.itemId,
    unitPrice: 0,
    bundleSize: input.quantity,
  };
  const result = purchaseItem(state, {
    commandId: input.commandId,
    offer,
    policy: input.policy,
    nowUtcMs: input.nowUtcMs,
  });
  if (!result.ok) return result;
  return accepted(result.state, {
    commandId: input.commandId,
    itemId: input.itemId,
    quantity: input.quantity,
    instanceIds: result.value.instanceIds,
  }, result.events.filter((event) => event.type !== 'wallet.debited' && event.type !== 'shop.purchased'));
}

export function markItemPlaced(
  state: EconomyState,
  input: {
    commandId: string;
    instanceId: string;
    placementId: string;
    locationId: string;
    nowUtcMs: number;
  },
): SystemResult<EconomyState, OwnedItemInstance> {
  if (state.processedTransactionIds.includes(input.commandId)) {
    return rejected(state, 'DUPLICATE_TRANSACTION', 'This placement was already processed.');
  }
  if (
    !isSafeIdentifier(input.commandId) ||
    !isSafeIdentifier(input.instanceId) ||
    !isSafeIdentifier(input.placementId) ||
    !isSafeIdentifier(input.locationId)
  ) {
    return rejected(state, 'INVALID_PLACEMENT_REFERENCE', 'Placement references are invalid.');
  }
  const instance = state.inventory.instances[input.instanceId];
  if (!instance) return rejected(state, 'ITEM_NOT_OWNED', 'The furniture instance is not owned.');
  if (instance.disposition.kind === 'placed') {
    return rejected(state, 'ITEM_ALREADY_PLACED', 'The furniture instance is already placed.');
  }
  const placementCollision = Object.values(state.inventory.instances).some(
    (candidate) =>
      candidate.instanceId !== input.instanceId &&
      candidate.disposition.kind === 'placed' &&
      candidate.disposition.placementId === input.placementId,
  );
  if (placementCollision) {
    return rejected(state, 'PLACEMENT_ID_COLLISION', 'Another owned item already uses this placement id.');
  }
  if (!input.placementId || !input.locationId) {
    return rejected(state, 'INVALID_PLACEMENT_REFERENCE', 'Placement references may not be empty.');
  }
  const updated: OwnedItemInstance = {
    ...instance,
    disposition: {
      kind: 'placed',
      placementId: input.placementId,
      locationId: input.locationId,
    },
  };
  const next: EconomyState = {
    ...state,
    inventory: {
      ...state.inventory,
      instances: { ...state.inventory.instances, [input.instanceId]: updated },
    },
    processedTransactionIds: appendReceipt(state.processedTransactionIds, input.commandId),
  };
  return accepted(next, updated, [
    gameplayEvent(input.commandId, 'inventory.placed', input.nowUtcMs, {
      instanceId: input.instanceId,
      itemId: instance.itemId,
      placementId: input.placementId,
      locationId: input.locationId,
    }),
  ]);
}

export function markItemStored(
  state: EconomyState,
  input: { commandId: string; instanceId: string; nowUtcMs: number },
): SystemResult<EconomyState, OwnedItemInstance> {
  if (state.processedTransactionIds.includes(input.commandId)) {
    return rejected(state, 'DUPLICATE_TRANSACTION', 'This storage command was already processed.');
  }
  if (
    !isSafeIdentifier(input.commandId) ||
    !isSafeIdentifier(input.instanceId)
  ) {
    return rejected(state, 'INVALID_STORAGE_REFERENCE', 'Storage references are invalid.');
  }
  const instance = state.inventory.instances[input.instanceId];
  if (!instance) return rejected(state, 'ITEM_NOT_OWNED', 'The furniture instance is not owned.');
  if (instance.disposition.kind === 'stored') {
    return rejected(state, 'ITEM_ALREADY_STORED', 'The furniture instance is already stored.');
  }
  const updated: OwnedItemInstance = { ...instance, disposition: { kind: 'stored' } };
  const next: EconomyState = {
    ...state,
    inventory: {
      ...state.inventory,
      instances: { ...state.inventory.instances, [input.instanceId]: updated },
    },
    processedTransactionIds: appendReceipt(state.processedTransactionIds, input.commandId),
  };
  return accepted(next, updated, [
    gameplayEvent(input.commandId, 'inventory.stored', input.nowUtcMs, {
      instanceId: input.instanceId,
      itemId: instance.itemId,
    }),
  ]);
}
