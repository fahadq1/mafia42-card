"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { runAiTurnStep } from "@/lib/game/ai";
import { decks, getDeck } from "@/lib/game/content";
import {
  canAttack,
  canPlayCard,
  createGame,
  getLegalAttackTargets,
  MAX_BOARD_SIZE,
  reduceGame,
} from "@/lib/game/engine";
import { AttackTarget, CardDefinition, GameState, MinionInstance } from "@/lib/game/types";

const AI_DELAY_MS = 850;
const FALLBACK_CARD_ART = "cards/card-placeholder.svg";

function pickOpponentDeck(selectedDeckId: string): string {
  const options = decks.filter((deck) => deck.id !== selectedDeckId);
  return options[Math.floor(Math.random() * options.length)].id;
}

function CardArtwork({
  src,
  name,
  compact = false,
}: {
  src: string;
  name: string;
  compact?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <div className={`card-art${compact ? " is-compact" : ""}`}>
      <img
        src={hasError ? FALLBACK_CARD_ART : src}
        alt={name}
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function BoardCard({
  minion,
  active,
  onClick,
}: {
  minion: MinionInstance;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`board-card${active ? " is-active" : ""}`}
      onClick={onClick}
      style={
        {
          "--card-accent": minion.palette.accent,
          "--card-glow": minion.palette.glow,
        } as CSSProperties
      }
    >
      <CardArtwork src={minion.image} name={minion.name} compact />
      <span className="role-pill">{minion.faction}</span>
      <strong>{minion.name}</strong>
      <span className="card-text">{minion.text}</span>
      <div className="stats-row">
        <span>{minion.attack} هجوم</span>
        <span>
          {minion.health}/{minion.maxHealth} صحة
        </span>
      </div>
      <div className="keywords-row">
        {minion.keywords.length > 0 ? (
          minion.keywords.map((tag) => (
            <span key={tag}>{tag === "taunt" ? "استفزاز" : "اندفاع"}</span>
          ))
        ) : (
          <span>{minion.sleeping ? "ينتظر الدور" : "جاهز"}</span>
        )}
      </div>
    </button>
  );
}

function HandCard({
  card,
  playable,
  onPlay,
}: {
  card: CardDefinition;
  playable: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className={`hand-card${playable ? " is-playable" : ""}`}
      disabled={!playable}
      onClick={onPlay}
      style={
        {
          "--card-accent": card.palette.accent,
          "--card-glow": card.palette.glow,
        } as CSSProperties
      }
    >
      <span className="mana-gem">{card.cost}</span>
      <CardArtwork src={card.image} name={card.name} />
      <span className="role-pill">{card.faction}</span>
      <strong>{card.name}</strong>
      <span className="card-text">{card.text}</span>
      <div className="stats-row">
        <span>{card.attack} هجوم</span>
        <span>{card.health} صحة</span>
      </div>
    </button>
  );
}

export default function HomePage() {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0].id);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);

  useEffect(() => {
    if (!game || game.winner || game.activePlayer !== "opponent") {
      return;
    }

    const timer = window.setTimeout(() => {
      setGame((current) => (current ? runAiTurnStep(current) : current));
    }, AI_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [game]);

  const player = game?.players.player ?? null;
  const opponent = game?.players.opponent ?? null;

  const targetIds = useMemo(() => {
    if (!game || !selectedAttackerId) {
      return new Set<string>();
    }

    return new Set(
      getLegalAttackTargets(game, "player", selectedAttackerId)
        .filter((target) => target.type === "minion")
        .map((target) => target.instanceId),
    );
  }, [game, selectedAttackerId]);

  function startMatch() {
    const opponentDeckId = pickOpponentDeck(selectedDeckId);
    setGame(createGame(selectedDeckId, opponentDeckId));
    setSelectedAttackerId(null);
  }

  function resetMatch() {
    setGame(null);
    setSelectedAttackerId(null);
  }

  function playCard(handIndex: number) {
    setGame((current) => {
      if (!current) {
        return current;
      }
      if (!canPlayCard(current, "player", handIndex)) {
        return current;
      }
      return reduceGame(current, { type: "play_card", playerId: "player", handIndex });
    });
  }

  function endTurn() {
    setSelectedAttackerId(null);
    setGame((current) => {
      if (!current) {
        return current;
      }
      return reduceGame(current, { type: "end_turn", playerId: "player" });
    });
  }

  function chooseAttacker(minion: MinionInstance) {
    if (!game || game.activePlayer !== "player") {
      return;
    }
    if (selectedAttackerId === minion.instanceId) {
      setSelectedAttackerId(null);
      return;
    }
    const legalTargets = getLegalAttackTargets(game, "player", minion.instanceId);
    const canStrike = legalTargets.some((target) =>
      canAttack(game, "player", minion.instanceId, target),
    );
    if (canStrike) {
      setSelectedAttackerId(minion.instanceId);
    }
  }

  function attackHero() {
    if (!game || !selectedAttackerId) {
      return;
    }
    const target: AttackTarget = { type: "hero", playerId: "opponent" };
    if (!canAttack(game, "player", selectedAttackerId, target)) {
      return;
    }
    setGame(
      reduceGame(game, {
        type: "attack",
        playerId: "player",
        attackerId: selectedAttackerId,
        target,
      }),
    );
    setSelectedAttackerId(null);
  }

  function attackMinion(instanceId: string) {
    if (!game || !selectedAttackerId) {
      return;
    }
    const target: AttackTarget = { type: "minion", playerId: "opponent", instanceId };
    if (!canAttack(game, "player", selectedAttackerId, target)) {
      return;
    }
    setGame(
      reduceGame(game, {
        type: "attack",
        playerId: "player",
        attackerId: selectedAttackerId,
        target,
      }),
    );
    setSelectedAttackerId(null);
  }

  if (!game) {
    return (
      <main className="shell">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">MVP قابل للعب</span>
            <h1>لعبه بطاقات مافيا42</h1>
            <p>
              مبارزة بطاقات عربية سريعة، بروح شخصيات التحقيق والمافيا، لكن بقواعد قتال
              مباشرة تعتمد على اللوح والمانا وإدارة الإيقاع.
            </p>
          </div>
          <div className="hero-badges">
            <span>ضد بوت</span>
            <span>مواجهه اونلاين</span>
            <span>تشكيلات جاهزه</span>
          </div>
        </section>

        <section className="deck-grid">
          {decks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              className={`deck-tile${selectedDeckId === deck.id ? " is-selected" : ""}`}
              onClick={() => setSelectedDeckId(deck.id)}
            >
              <strong>{deck.name}</strong>
              <span>{deck.heroTitle}</span>
              <p>{deck.summary}</p>
              <small>{deck.theme}</small>
            </button>
          ))}
        </section>

        <section className="start-row">
          <div className="deck-preview">
            <h2>{getDeck(selectedDeckId).name}</h2>
            <p>{getDeck(selectedDeckId).summary}</p>
          </div>
          <button type="button" className="primary-action" onClick={startMatch}>
            ابدأ المواجهة
          </button>
        </section>
      </main>
    );
  }

  if (!player || !opponent) {
    return null;
  }

  const canEndTurn = game.activePlayer === "player" && !game.winner;

  return (
    <main className="arena-shell">
      <section className="top-bar">
        <div>
          <span className="eyebrow">المباراة {game.turn}</span>
          <h1>لعبه بطاقات مافيا42</h1>
        </div>
        <div className="status-pills">
          <span>{game.activePlayer === "player" ? "دورك الآن" : "البوت يفكر"}</span>
          <span>{getDeck(game.selectedDeckId).name}</span>
          <span>{getDeck(game.opponentDeckId).name}</span>
        </div>
      </section>

      <section className="battle-layout">
        <aside className="side-panel">
          <div className="hero-card enemy">
            <strong>{opponent.name}</strong>
            <span>{opponent.heroHealth} صحة</span>
            <span>
              {opponent.mana}/{opponent.maxMana} مانا
            </span>
            <span>{opponent.hand.length} يد</span>
          </div>
          <div className="log-panel">
            <h2>سجل الأحداث</h2>
            <div className="log-list">
              {game.eventLog.map((entry, index) => (
                <p key={`${entry}-${index}`}>{entry}</p>
              ))}
            </div>
          </div>
          <button type="button" className="ghost-action" onClick={resetMatch}>
            رجوع لاختيار التشكيله
          </button>
        </aside>

        <section className="board-area">
          <div className="leader-row">
            <button
              type="button"
              className={`leader-plate enemy${selectedAttackerId ? " can-target" : ""}`}
              onClick={attackHero}
              disabled={!selectedAttackerId}
            >
              <strong>{opponent.name}</strong>
              <span>{opponent.heroHealth} صحة</span>
            </button>
          </div>

          <div className="board-row enemy-board">
            {opponent.board.map((minion) => (
              <BoardCard
                key={minion.instanceId}
                minion={minion}
                active={targetIds.has(minion.instanceId)}
                onClick={() => attackMinion(minion.instanceId)}
              />
            ))}
            {Array.from({
              length: Math.max(0, MAX_BOARD_SIZE - opponent.board.length),
            }).map((_, index) => (
              <div key={`enemy-slot-${index}`} className="board-slot" />
            ))}
          </div>

          <div className="versus-band">
            <span>اللوح القتالي</span>
          </div>

          <div className="board-row player-board">
            {player.board.map((minion) => (
              <BoardCard
                key={minion.instanceId}
                minion={minion}
                active={selectedAttackerId === minion.instanceId}
                onClick={() => chooseAttacker(minion)}
              />
            ))}
            {Array.from({
              length: Math.max(0, MAX_BOARD_SIZE - player.board.length),
            }).map((_, index) => (
              <div key={`player-slot-${index}`} className="board-slot" />
            ))}
          </div>

          <div className="leader-row player">
            <div className="leader-plate player">
              <strong>{player.name}</strong>
              <span>{player.heroHealth} صحة</span>
              <span>
                {player.mana}/{player.maxMana} مانا
              </span>
            </div>
            <button
              type="button"
              className="primary-action"
              disabled={!canEndTurn}
              onClick={endTurn}
            >
              إنهاء الدور
            </button>
          </div>
        </section>
      </section>

      <section className="hand-panel">
        <div className="hand-header">
          <h2>اليد</h2>
          <span>{player.hand.length} بطاقات</span>
        </div>
        <div className="hand-row">
          {player.hand.map((card, index) => (
            <HandCard
              key={`${card.id}-${index}`}
              card={card}
              playable={canPlayCard(game, "player", index)}
              onPlay={() => playCard(index)}
            />
          ))}
        </div>
      </section>

      {game.winner ? (
        <div className="result-overlay">
          <div className="result-card">
            <span className="eyebrow">نهاية المباراة</span>
            <h2>{game.winner === "player" ? "فوز مستحق" : "خسارة تكتيكية"}</h2>
            <p>
              {game.winner === "player"
                ? "سيطرت على اللوح وأغلقت المواجهة لصالحك."
                : "البوت سبقك في الإيقاع. أعد ترتيب التشكيله وحاول من جديد."}
            </p>
            <div className="result-actions">
              <button type="button" className="primary-action" onClick={startMatch}>
                إعادة اللعب
              </button>
              <button type="button" className="ghost-action" onClick={resetMatch}>
                تغيير التشكيله
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
