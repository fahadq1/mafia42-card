export type PlayerId = "player" | "opponent";

export type CardRole =
  | "investigator"
  | "medic"
  | "killer"
  | "guardian"
  | "trickster"
  | "civilian";

export type Keyword = "charge" | "taunt";

export type EffectType =
  | "damage_enemy_hero"
  | "damage_enemy_minion"
  | "heal_friendly_hero"
  | "buff_friendly_minion"
  | "draw_card"
  | "summon_token";

export interface EffectDefinition {
  type: EffectType;
  amount?: number;
  tokenCardId?: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  role: CardRole;
  faction: string;
  image: string;
  cost: number;
  attack: number;
  health: number;
  text: string;
  keywords?: Keyword[];
  battlecry?: EffectDefinition;
  palette: {
    accent: string;
    glow: string;
  };
}

export interface MinionInstance {
  instanceId: string;
  cardId: string;
  ownerId: PlayerId;
  name: string;
  role: CardRole;
  faction: string;
  image: string;
  cost: number;
  attack: number;
  health: number;
  maxHealth: number;
  text: string;
  keywords: Keyword[];
  sleeping: boolean;
  attacksThisTurn: number;
  palette: {
    accent: string;
    glow: string;
  };
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  heroHealth: number;
  mana: number;
  maxMana: number;
  deck: string[];
  hand: CardDefinition[];
  board: MinionInstance[];
  fatigue: number;
}

export interface GameState {
  turn: number;
  activePlayer: PlayerId;
  winner: PlayerId | null;
  players: Record<PlayerId, PlayerState>;
  eventLog: string[];
  selectedDeckId: string;
  opponentDeckId: string;
}

export type AttackTarget =
  | { type: "hero"; playerId: PlayerId }
  | { type: "minion"; playerId: PlayerId; instanceId: string };

export type Action =
  | { type: "play_card"; playerId: PlayerId; handIndex: number }
  | {
      type: "attack";
      playerId: PlayerId;
      attackerId: string;
      target: AttackTarget;
    }
  | { type: "end_turn"; playerId: PlayerId };

export interface DeckDefinition {
  id: string;
  name: string;
  theme: string;
  summary: string;
  heroTitle: string;
  cardIds: string[];
}
