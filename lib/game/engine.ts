import { cardCatalog, getDeck } from "@/lib/game/content";
import {
  Action,
  AttackTarget,
  CardDefinition,
  GameState,
  MinionInstance,
  PlayerId,
  PlayerState,
} from "@/lib/game/types";

export const MAX_HAND_SIZE = 8;
export const MAX_BOARD_SIZE = 7;
export const STARTING_HEALTH = 30;

let instanceCounter = 0;

function nextInstanceId(): string {
  instanceCounter += 1;
  return `m_${instanceCounter}`;
}

function cloneCard(card: CardDefinition): CardDefinition {
  return {
    ...card,
    keywords: card.keywords ? [...card.keywords] : [],
    battlecry: card.battlecry ? { ...card.battlecry } : undefined,
    palette: { ...card.palette },
  };
}

function getCardDefinition(cardId: string): CardDefinition {
  const card = cardCatalog[cardId];
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`);
  }
  return card;
}

function createMinion(card: CardDefinition, ownerId: PlayerId): MinionInstance {
  return {
    instanceId: nextInstanceId(),
    cardId: card.id,
    ownerId,
    name: card.name,
    role: card.role,
    faction: card.faction,
    image: card.image,
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    maxHealth: card.health,
    text: card.text,
    keywords: card.keywords ? [...card.keywords] : [],
    sleeping: !(card.keywords ?? []).includes("charge"),
    attacksThisTurn: 0,
    palette: { ...card.palette },
  };
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function deckToCards(deckId: string): string[] {
  return [...getDeck(deckId).cardIds];
}

function createPlayerState(id: PlayerId, name: string, deckId: string): PlayerState {
  return {
    id,
    name,
    heroHealth: STARTING_HEALTH,
    mana: 0,
    maxMana: 0,
    deck: shuffle(deckToCards(deckId)),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

function otherPlayer(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "opponent" : "player";
}

function appendLog(state: GameState, message: string): GameState {
  return {
    ...state,
    eventLog: [message, ...state.eventLog].slice(0, 12),
  };
}

function checkWinner(state: GameState): GameState {
  const playerDead = state.players.player.heroHealth <= 0;
  const opponentDead = state.players.opponent.heroHealth <= 0;

  if (playerDead && opponentDead) {
    return { ...state, winner: "player" };
  }
  if (playerDead) {
    return { ...state, winner: "opponent" };
  }
  if (opponentDead) {
    return { ...state, winner: "player" };
  }
  return state;
}

function drawCard(state: GameState, playerId: PlayerId, amount = 1): GameState {
  let nextState = state;
  for (let i = 0; i < amount; i += 1) {
    const player = nextState.players[playerId];
    if (player.deck.length === 0) {
      const fatigue = player.fatigue + 1;
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [playerId]: {
            ...player,
            fatigue,
            heroHealth: player.heroHealth - fatigue,
          },
        },
      };
      nextState = appendLog(nextState, `${player.name} يتلقى ${fatigue} ضرر إرهاق.`);
      nextState = checkWinner(nextState);
      if (nextState.winner) {
        return nextState;
      }
      continue;
    }

    const [nextCardId, ...restDeck] = player.deck;
    const card = cloneCard(getCardDefinition(nextCardId));
    if (player.hand.length >= MAX_HAND_SIZE) {
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [playerId]: {
            ...player,
            deck: restDeck,
          },
        },
      };
      nextState = appendLog(nextState, `${player.name} أحرق بطاقة بسبب امتلاء اليد.`);
      continue;
    }

    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [playerId]: {
          ...player,
          deck: restDeck,
          hand: [...player.hand, card],
        },
      },
    };
  }

  return nextState;
}

function startTurn(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const refreshedBoard = player.board.map((minion) => ({
    ...minion,
    sleeping: false,
    attacksThisTurn: 0,
  }));

  let nextState: GameState = {
    ...state,
    activePlayer: playerId,
    turn: state.turn + (playerId === "player" ? 1 : 0),
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        maxMana: Math.min(10, player.maxMana + 1),
        mana: Math.min(10, player.maxMana + 1),
        board: refreshedBoard,
      },
    },
  };

  nextState = drawCard(nextState, playerId, 1);
  nextState = appendLog(nextState, `بدأ دور ${nextState.players[playerId].name}.`);
  return nextState;
}

function initializeOpeningHand(state: GameState): GameState {
  let next = state;
  for (const playerId of ["player", "opponent"] as const) {
    next = drawCard(next, playerId, 3);
  }
  return next;
}

export function createGame(selectedDeckId: string, opponentDeckId: string): GameState {
  instanceCounter = 0;
  let state: GameState = {
    turn: 0,
    activePlayer: "player",
    winner: null,
    selectedDeckId,
    opponentDeckId,
    players: {
      player: createPlayerState("player", getDeck(selectedDeckId).heroTitle, selectedDeckId),
      opponent: createPlayerState("opponent", getDeck(opponentDeckId).heroTitle, opponentDeckId),
    },
    eventLog: [],
  };

  state = initializeOpeningHand(state);
  state = startTurn(state, "player");
  return appendLog(state, "انطلقت المواجهة داخل ساحة مافيا42.");
}

function applyBattlecry(state: GameState, ownerId: PlayerId, minionId: string): GameState {
  const owner = state.players[ownerId];
  const minion = owner.board.find((item) => item.instanceId === minionId);
  if (!minion) {
    return state;
  }
  const card = cardCatalog[minion.cardId];
  if (!card.battlecry) {
    return state;
  }

  const enemyId = otherPlayer(ownerId);
  let next = state;

  switch (card.battlecry.type) {
    case "damage_enemy_hero": {
      const amount = card.battlecry.amount ?? 0;
      next = {
        ...next,
        players: {
          ...next.players,
          [enemyId]: {
            ...next.players[enemyId],
            heroHealth: next.players[enemyId].heroHealth - amount,
          },
        },
      };
      next = appendLog(next, `${card.name} أصاب زعيم العدو بـ ${amount}.`);
      return checkWinner(next);
    }
    case "damage_enemy_minion": {
      const enemy = next.players[enemyId];
      if (enemy.board.length === 0) {
        return appendLog(next, `${card.name} لم يجد هدفاً على اللوح.`);
      }
      const target = [...enemy.board].sort((a, b) => a.health - b.health)[0];
      const amount = card.battlecry.amount ?? 0;
      const updatedEnemyBoard = enemy.board
        .map((item) =>
          item.instanceId === target.instanceId
            ? { ...item, health: item.health - amount }
            : item,
        )
        .filter((item) => item.health > 0);
      next = {
        ...next,
        players: {
          ...next.players,
          [enemyId]: {
            ...enemy,
            board: updatedEnemyBoard,
          },
        },
      };
      return appendLog(next, `${card.name} أصاب ${target.name} بـ ${amount}.`);
    }
    case "heal_friendly_hero": {
      const amount = card.battlecry.amount ?? 0;
      next = {
        ...next,
        players: {
          ...next.players,
          [ownerId]: {
            ...owner,
            heroHealth: Math.min(STARTING_HEALTH, owner.heroHealth + amount),
          },
        },
      };
      return appendLog(next, `${card.name} عالج زعيمك بـ ${amount}.`);
    }
    case "buff_friendly_minion": {
      const amount = card.battlecry.amount ?? 0;
      const candidates = owner.board.filter((item) => item.instanceId !== minionId);
      if (candidates.length === 0) {
        return appendLog(next, `${card.name} نزل بلا هدف داعم.`);
      }
      const target = candidates.sort((a, b) => b.attack - a.attack)[0];
      next = {
        ...next,
        players: {
          ...next.players,
          [ownerId]: {
            ...owner,
            board: owner.board.map((item) =>
              item.instanceId === target.instanceId
                ? {
                    ...item,
                    attack: item.attack + amount,
                    health: item.health + amount,
                    maxHealth: item.maxHealth + amount,
                  }
                : item,
            ),
          },
        },
      };
      return appendLog(next, `${card.name} عزز ${target.name} بـ +${amount}/+${amount}.`);
    }
    case "draw_card": {
      const amount = card.battlecry.amount ?? 1;
      next = drawCard(next, ownerId, amount);
      return appendLog(next, `${card.name} منح ${amount} بطاقة إضافية.`);
    }
    case "summon_token": {
      if (!card.battlecry.tokenCardId) {
        return next;
      }
      const freshOwner = next.players[ownerId];
      if (freshOwner.board.length >= MAX_BOARD_SIZE) {
        return appendLog(next, `${card.name} لم يجد مكاناً لاستدعاء المساعد.`);
      }
      const tokenCard = getCardDefinition(card.battlecry.tokenCardId);
      const token = createMinion(tokenCard, ownerId);
      next = {
        ...next,
        players: {
          ...next.players,
          [ownerId]: {
            ...freshOwner,
            board: [...freshOwner.board, token],
          },
        },
      };
      return appendLog(next, `${card.name} استدعى ${token.name}.`);
    }
    default:
      return next;
  }
}

function legalAttackTargets(state: GameState, playerId: PlayerId): AttackTarget[] {
  const enemyId = otherPlayer(playerId);
  const enemyBoard = state.players[enemyId].board;
  const taunts = enemyBoard.filter((item) => item.keywords.includes("taunt"));
  if (taunts.length > 0) {
    return taunts.map((item) => ({
      type: "minion",
      playerId: enemyId,
      instanceId: item.instanceId,
    }));
  }
  return [
    { type: "hero", playerId: enemyId },
    ...enemyBoard.map((item) => ({
      type: "minion" as const,
      playerId: enemyId,
      instanceId: item.instanceId,
    })),
  ];
}

export function canPlayCard(state: GameState, playerId: PlayerId, handIndex: number): boolean {
  if (state.winner || state.activePlayer !== playerId) {
    return false;
  }
  const player = state.players[playerId];
  const card = player.hand[handIndex];
  if (!card) {
    return false;
  }
  if (player.board.length >= MAX_BOARD_SIZE) {
    return false;
  }
  return card.cost <= player.mana;
}

export function canAttack(
  state: GameState,
  playerId: PlayerId,
  attackerId: string,
  target: AttackTarget,
): boolean {
  if (state.winner || state.activePlayer !== playerId) {
    return false;
  }
  const player = state.players[playerId];
  const attacker = player.board.find((item) => item.instanceId === attackerId);
  if (!attacker || attacker.sleeping || attacker.attacksThisTurn > 0 || attacker.health <= 0) {
    return false;
  }
  return legalAttackTargets(state, playerId).some((candidate) =>
    candidate.type === "hero" && target.type === "hero"
      ? candidate.playerId === target.playerId
      : candidate.type === "minion" &&
          target.type === "minion" &&
          candidate.instanceId === target.instanceId,
  );
}

function removeDead(board: MinionInstance[]): MinionInstance[] {
  return board.filter((item) => item.health > 0);
}

export function reduceGame(state: GameState, action: Action): GameState {
  if (state.winner) {
    return state;
  }

  switch (action.type) {
    case "play_card": {
      if (!canPlayCard(state, action.playerId, action.handIndex)) {
        return state;
      }
      const player = state.players[action.playerId];
      const card = player.hand[action.handIndex];
      const nextHand = player.hand.filter((_, index) => index !== action.handIndex);
      const minion = createMinion(card, action.playerId);

      let nextState: GameState = {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            mana: player.mana - card.cost,
            hand: nextHand,
            board: [...player.board, minion],
          },
        },
      };
      nextState = appendLog(nextState, `${player.name} لعب ${card.name}.`);
      return applyBattlecry(nextState, action.playerId, minion.instanceId);
    }
    case "attack": {
      if (!canAttack(state, action.playerId, action.attackerId, action.target)) {
        return state;
      }

      const defenderId = otherPlayer(action.playerId);
      const attackerPlayer = state.players[action.playerId];
      const defenderPlayer = state.players[defenderId];
      const attacker = attackerPlayer.board.find((item) => item.instanceId === action.attackerId);
      if (!attacker) {
        return state;
      }
      let attackLabel = "وحدة";

      let nextAttackerBoard = attackerPlayer.board.map((item) =>
        item.instanceId === attacker.instanceId
          ? { ...item, attacksThisTurn: 1, sleeping: false }
          : item,
      );
      let nextDefenderBoard = [...defenderPlayer.board];
      let nextDefenderHeroHealth = defenderPlayer.heroHealth;

      if (action.target.type === "hero") {
        nextDefenderHeroHealth -= attacker.attack;
      } else {
        const targetId = action.target.instanceId;
        const defender = defenderPlayer.board.find(
          (item) => item.instanceId === targetId,
        );
        if (!defender) {
          return state;
        }
        attackLabel = defender.name;
        nextAttackerBoard = nextAttackerBoard.map((item) =>
          item.instanceId === attacker.instanceId
            ? { ...item, health: item.health - defender.attack }
            : item,
        );
        nextDefenderBoard = nextDefenderBoard.map((item) =>
          item.instanceId === defender.instanceId
            ? { ...item, health: item.health - attacker.attack }
            : item,
        );
      }

      let nextState: GameState = {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...attackerPlayer,
            board: removeDead(nextAttackerBoard),
          },
          [defenderId]: {
            ...defenderPlayer,
            board: removeDead(nextDefenderBoard),
            heroHealth: nextDefenderHeroHealth,
          },
        },
      };

      nextState = appendLog(
        nextState,
        action.target.type === "hero"
          ? `${attacker.name} هاجم الزعيم مباشرة بـ ${attacker.attack}.`
          : `${attacker.name} اشتبك مع ${attackLabel}.`,
      );
      return checkWinner(nextState);
    }
    case "end_turn": {
      if (state.activePlayer !== action.playerId) {
        return state;
      }
      const nextPlayer = otherPlayer(action.playerId);
      const nextState = appendLog(state, `${state.players[action.playerId].name} أنهى دوره.`);
      return startTurn(nextState, nextPlayer);
    }
    default:
      return state;
  }
}

export function getLegalAttackTargets(
  state: GameState,
  playerId: PlayerId,
  attackerId: string,
): AttackTarget[] {
  if (!state.players[playerId].board.find((item) => item.instanceId === attackerId)) {
    return [];
  }
  return legalAttackTargets(state, playerId);
}
