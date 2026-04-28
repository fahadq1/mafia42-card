import { reduceGame, canPlayCard, canAttack, getLegalAttackTargets } from "@/lib/game/engine";
import { Action, AttackTarget, GameState, MinionInstance } from "@/lib/game/types";

function scoreAttack(attacker: MinionInstance, target: AttackTarget, state: GameState): number {
  if (target.type === "hero") {
    return attacker.attack * 2 + state.players.player.heroHealth <= attacker.attack ? 100 : 0;
  }

  const defender = state.players.player.board.find((item) => item.instanceId === target.instanceId);
  if (!defender) {
    return -999;
  }
  const killsDefender = attacker.attack >= defender.health;
  const survives = attacker.health > defender.attack;
  return (killsDefender ? 8 : 0) + (survives ? 4 : 0) + defender.attack;
}

export function getAiAction(state: GameState): Action | null {
  if (state.winner || state.activePlayer !== "opponent") {
    return null;
  }

  const ai = state.players.opponent;
  const playable = ai.hand
    .map((card, index) => ({ card, index }))
    .filter(({ index }) => canPlayCard(state, "opponent", index))
    .sort((a, b) => {
      if (b.card.cost !== a.card.cost) {
        return b.card.cost - a.card.cost;
      }
      return b.card.attack + b.card.health - (a.card.attack + a.card.health);
    });

  if (playable.length > 0) {
    return { type: "play_card", playerId: "opponent", handIndex: playable[0].index };
  }

  let bestAttack:
    | {
        attackerId: string;
        target: AttackTarget;
        score: number;
      }
    | null = null;

  for (const attacker of ai.board) {
    const targets = getLegalAttackTargets(state, "opponent", attacker.instanceId);
    for (const target of targets) {
      if (!canAttack(state, "opponent", attacker.instanceId, target)) {
        continue;
      }
      const score = scoreAttack(attacker, target, state);
      if (!bestAttack || score > bestAttack.score) {
        bestAttack = { attackerId: attacker.instanceId, target, score };
      }
    }
  }

  if (bestAttack) {
    return {
      type: "attack",
      playerId: "opponent",
      attackerId: bestAttack.attackerId,
      target: bestAttack.target,
    };
  }

  return { type: "end_turn", playerId: "opponent" };
}

export function runAiTurnStep(state: GameState): GameState {
  const action = getAiAction(state);
  return action ? reduceGame(state, action) : state;
}
