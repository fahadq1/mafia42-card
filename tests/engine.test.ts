import { describe, expect, it } from "vitest";
import { cardCatalog } from "../lib/game/content";
import { createGame, reduceGame } from "../lib/game/engine";
import { GameState, MinionInstance, PlayerId } from "../lib/game/types";

function withState(mutator: (state: GameState) => GameState): GameState {
  return mutator(createGame("city_watch", "midnight_syndicate"));
}

function buildMinion(cardId: string, ownerId: PlayerId, instanceId: string): MinionInstance {
  const card = cardCatalog[cardId];
  return {
    instanceId,
    cardId,
    ownerId,
    name: card.name,
    role: card.role,
    faction: card.faction,
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    maxHealth: card.health,
    text: card.text,
    keywords: [...(card.keywords ?? [])],
    sleeping: false,
    attacksThisTurn: 0,
    palette: { ...card.palette },
  };
}

describe("game engine", () => {
  it("plays a card when mana is sufficient", () => {
    const state = withState((current) => ({
      ...current,
      players: {
        ...current.players,
        player: {
          ...current.players.player,
          mana: 10,
          maxMana: 10,
          hand: [current.players.player.hand[0]],
          board: [],
        },
      },
    }));

    const next = reduceGame(state, { type: "play_card", playerId: "player", handIndex: 0 });
    expect(next.players.player.board.length).toBe(1);
    expect(next.players.player.hand.length).toBe(0);
  });

  it("resolves combat and removes dead minions", () => {
    const state = withState((current) => {
      const attacker = {
        ...buildMinion("shadow_blade", "player", "a1"),
        attack: 4,
        health: 3,
        maxHealth: 3,
      };
      const defender = {
        ...buildMinion("safehouse_keeper", "opponent", "d1"),
        attack: 2,
        health: 2,
        maxHealth: 2,
      };
      return {
        ...current,
        players: {
          ...current.players,
          player: { ...current.players.player, board: [attacker] },
          opponent: { ...current.players.opponent, board: [defender] },
        },
      };
    });

    const next = reduceGame(state, {
      type: "attack",
      playerId: "player",
      attackerId: "a1",
      target: { type: "minion", playerId: "opponent", instanceId: "d1" },
    });

    expect(next.players.opponent.board.length).toBe(0);
    expect(next.players.player.board[0].health).toBe(1);
  });

  it("end turn increases opponent mana and draws a card", () => {
    const state = createGame("city_watch", "midnight_syndicate");
    const opponentHand = state.players.opponent.hand.length;
    const next = reduceGame(state, { type: "end_turn", playerId: "player" });

    expect(next.activePlayer).toBe("opponent");
    expect(next.players.opponent.maxMana).toBe(1);
    expect(next.players.opponent.hand.length).toBe(opponentHand + 1);
  });

  it("declares winner when hero health drops to zero", () => {
    const state = withState((current) => ({
      ...current,
      players: {
        ...current.players,
        player: {
          ...current.players.player,
          board: [
            {
              ...buildMinion("rooftop_hunter", "player", "finisher"),
              attack: 5,
              health: 5,
              maxHealth: 5,
            },
          ],
        },
        opponent: {
          ...current.players.opponent,
          board: [],
          heroHealth: 4,
        },
      },
    }));

    const next = reduceGame(state, {
      type: "attack",
      playerId: "player",
      attackerId: "finisher",
      target: { type: "hero", playerId: "opponent" },
    });

    expect(next.winner).toBe("player");
  });
});
