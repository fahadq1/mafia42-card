"use client";

import type { CSSProperties, MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

interface InspectCardState {
  name: string;
  faction: string;
  text: string;
  image: string;
  attack: number;
  health: number;
  maxHealth?: number;
  cost?: number;
  keywords?: string[];
}

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
  entering,
  onClick,
  onInspect,
}: {
  minion: MinionInstance;
  active?: boolean;
  entering?: boolean;
  onClick?: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      className="card-shell"
      style={
        {
          "--card-accent": minion.palette.accent,
          "--card-glow": minion.palette.glow,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`board-card${active ? " is-active" : ""}${entering ? " is-entering" : ""}`}
        onClick={onClick}
      >
        <CardArtwork src={minion.image} name={minion.name} compact />
        <div className="combat-stats">
          <span>{minion.attack}</span>
          <span>
            {minion.health}/{minion.maxHealth}
          </span>
        </div>
      </button>
      <button
        type="button"
        className="card-info-button"
        onClick={(event) => {
          event.stopPropagation();
          onInspect();
        }}
        aria-label={`معلومات ${minion.name}`}
      >
        !
      </button>
    </div>
  );
}

function HandCard({
  card,
  playable,
  onPlay,
  onInspect,
}: {
  card: CardDefinition;
  playable: boolean;
  onPlay: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      className="card-shell"
      style={
        {
          "--card-accent": card.palette.accent,
          "--card-glow": card.palette.glow,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`hand-card${playable ? " is-playable" : ""}`}
        disabled={!playable}
        onClick={onPlay}
      >
        <span className="mana-gem">{card.cost}</span>
        <CardArtwork src={card.image} name={card.name} />
        <div className="combat-stats">
          <span>{card.attack}</span>
          <span>{card.health}</span>
        </div>
      </button>
      <button
        type="button"
        className="card-info-button"
        onClick={(event) => {
          event.stopPropagation();
          onInspect();
        }}
        aria-label={`معلومات ${card.name}`}
      >
        !
      </button>
    </div>
  );
}

export default function HomePage() {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0].id);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [inspectedCard, setInspectedCard] = useState<InspectCardState | null>(null);
  const [latestEvent, setLatestEvent] = useState<string | null>(null);
  const [boardFlash, setBoardFlash] = useState(false);
  const [enteringMinionId, setEnteringMinionId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousEventRef = useRef<string | null>(null);
  const previousBoardIdsRef = useRef<{ player: string[]; opponent: string[] }>({
    player: [],
    opponent: [],
  });

  useEffect(() => {
    if (!game || game.winner || game.activePlayer !== "opponent") {
      return;
    }

    const timer = window.setTimeout(() => {
      setGame((current) => (current ? runAiTurnStep(current) : current));
    }, AI_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [game]);

  useEffect(() => {
    const nextEvent = game?.eventLog[0] ?? null;
    if (!nextEvent || nextEvent === previousEventRef.current) {
      return;
    }

    previousEventRef.current = nextEvent;
    setLatestEvent(nextEvent);
    setBoardFlash(true);

    const flashTimer = window.setTimeout(() => setBoardFlash(false), 380);
    const eventTimer = window.setTimeout(() => setLatestEvent(null), 1800);
    playFeedbackTone(nextEvent, audioContextRef);

    return () => {
      window.clearTimeout(flashTimer);
      window.clearTimeout(eventTimer);
    };
  }, [game]);

  useEffect(() => {
    if (!game) {
      previousBoardIdsRef.current = { player: [], opponent: [] };
      setEnteringMinionId(null);
      return;
    }

    const currentPlayerIds = game.players.player.board.map((minion) => minion.instanceId);
    const currentOpponentIds = game.players.opponent.board.map((minion) => minion.instanceId);
    const knownIds = new Set([
      ...previousBoardIdsRef.current.player,
      ...previousBoardIdsRef.current.opponent,
    ]);
    const addedId = [...currentPlayerIds, ...currentOpponentIds].find((id) => !knownIds.has(id));

    previousBoardIdsRef.current = {
      player: currentPlayerIds,
      opponent: currentOpponentIds,
    };

    if (!addedId) {
      return;
    }

    setEnteringMinionId(addedId);
    const timer = window.setTimeout(() => setEnteringMinionId(null), 900);
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
    setInspectedCard(null);
  }

  function resetMatch() {
    setGame(null);
    setSelectedAttackerId(null);
    setInspectedCard(null);
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

  function inspectHandCard(card: CardDefinition) {
    setInspectedCard({
      name: card.name,
      faction: card.faction,
      text: card.text,
      image: card.image,
      attack: card.attack,
      health: card.health,
      cost: card.cost,
      keywords: card.keywords,
    });
  }

  function inspectBoardCard(minion: MinionInstance) {
    setInspectedCard({
      name: minion.name,
      faction: minion.faction,
      text: minion.text,
      image: minion.image,
      attack: minion.attack,
      health: minion.health,
      maxHealth: minion.maxHealth,
      cost: minion.cost,
      keywords: minion.keywords,
    });
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
            <span>قاتل</span>
            <span>تشكيلات جاهزة</span>
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
        <div className="top-bar-copy">
          <span className="eyebrow">المباراة {game.turn}</span>
          <h1>لعبه بطاقات مافيا42</h1>
        </div>
        <div className="status-pills">
          <span>{game.activePlayer === "player" ? "دورك الآن" : "الخصم يفكر"}</span>
          <span>{getDeck(game.selectedDeckId).name}</span>
          <span>{getDeck(game.opponentDeckId).name}</span>
        </div>
      </section>

      <section className="battle-layout">
        <section className={`board-area${boardFlash ? " is-flashing" : ""}`}>
          <div className="duel-ribbon">
            <div className="duel-hero player-side">
              <span className="duel-label">اللاعب</span>
              <strong>{player.name}</strong>
              <div className="duel-stats">
                <span>{player.heroHealth} صحة</span>
                <span>
                  {player.mana}/{player.maxMana} مانا
                </span>
                <span>{player.hand.length} بطاقة</span>
              </div>
            </div>

            <div className="duel-center">
              <span className="versus-token">VS</span>
              <span>{game.activePlayer === "player" ? "دورك" : "دور الخصم"}</span>
            </div>

            <div className="duel-hero enemy-side">
              <span className="duel-label">الخصم</span>
              <strong>{opponent.name}</strong>
              <div className="duel-stats">
                <span>{opponent.heroHealth} صحة</span>
                <span>
                  {opponent.mana}/{opponent.maxMana} مانا
                </span>
                <span>{opponent.hand.length} بطاقة</span>
              </div>
            </div>
          </div>

          <div className="board-stage enemy-stage">
            <button
              type="button"
              className={`leader-plate enemy direct-hit${selectedAttackerId ? " can-target" : ""}`}
              onClick={attackHero}
              disabled={!selectedAttackerId}
            >
              هجوم مباشر
            </button>

            <div className="board-row enemy-board">
              {opponent.board.map((minion) => (
                <BoardCard
                  key={minion.instanceId}
                  minion={minion}
                  active={targetIds.has(minion.instanceId)}
                  entering={enteringMinionId === minion.instanceId}
                  onClick={() => attackMinion(minion.instanceId)}
                  onInspect={() => inspectBoardCard(minion)}
                />
              ))}
              {Array.from({
                length: Math.max(0, MAX_BOARD_SIZE - opponent.board.length),
              }).map((_, index) => (
                <div key={`enemy-slot-${index}`} className="board-slot" />
              ))}
            </div>
          </div>

          <div className="versus-band">
            <span>اللوح القتالي</span>
          </div>

          <div className="board-stage player-stage">
            <div className="board-row player-board">
              {player.board.map((minion) => (
                <BoardCard
                  key={minion.instanceId}
                  minion={minion}
                  active={selectedAttackerId === minion.instanceId}
                  entering={enteringMinionId === minion.instanceId}
                  onClick={() => chooseAttacker(minion)}
                  onInspect={() => inspectBoardCard(minion)}
                />
              ))}
              {Array.from({
                length: Math.max(0, MAX_BOARD_SIZE - player.board.length),
              }).map((_, index) => (
                <div key={`player-slot-${index}`} className="board-slot" />
              ))}
            </div>
          </div>

          <div className="controls-row">
            <button
              type="button"
              className="primary-action"
              disabled={!canEndTurn}
              onClick={endTurn}
            >
              إنهاء الدور
            </button>
            <button type="button" className="ghost-action" onClick={resetMatch}>
              رجوع لاختيار التشكيلة
            </button>
          </div>
        </section>
      </section>

      <section className="log-panel arena-log">
        <div className="hand-header">
          <h2>سجل الأحداث</h2>
          <span>{latestEvent ?? "الساحة هادئة"}</span>
        </div>
        <div className="log-list">
          {game.eventLog.map((entry, index) => (
            <p key={`${entry}-${index}`}>{entry}</p>
          ))}
        </div>
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
              onInspect={() => inspectHandCard(card)}
            />
          ))}
        </div>
      </section>

      {latestEvent ? <div className="event-toast">{latestEvent}</div> : null}

      {inspectedCard ? (
        <div className="result-overlay" onClick={() => setInspectedCard(null)}>
          <div className="result-card inspect-card" onClick={(event) => event.stopPropagation()}>
            <div className="inspect-top">
              <CardArtwork src={inspectedCard.image} name={inspectedCard.name} />
              <div className="inspect-copy">
                <span className="eyebrow">{inspectedCard.faction}</span>
                <h2>{inspectedCard.name}</h2>
                <p>{inspectedCard.text}</p>
              </div>
            </div>
            <div className="inspect-stats">
              <span>الكلفة: {inspectedCard.cost ?? "-"}</span>
              <span>الهجوم: {inspectedCard.attack}</span>
              <span>
                الصحة:{" "}
                {inspectedCard.maxHealth
                  ? `${inspectedCard.health}/${inspectedCard.maxHealth}`
                  : inspectedCard.health}
              </span>
              <span>
                الحالة:{" "}
                {inspectedCard.keywords?.length
                  ? inspectedCard.keywords
                      .map((keyword) => (keyword === "taunt" ? "استفزاز" : "اندفاع"))
                      .join(" - ")
                  : "عادي"}
              </span>
            </div>
            <button type="button" className="ghost-action" onClick={() => setInspectedCard(null)}>
              إغلاق
            </button>
          </div>
        </div>
      ) : null}

      {game.winner ? (
        <div className="result-overlay">
          <div className="result-card">
            <span className="eyebrow">نهاية المباراة</span>
            <h2>{game.winner === "player" ? "فوز مستحق" : "خسارة تكتيكية"}</h2>
            <p>
              {game.winner === "player"
                ? "سيطرت على اللوح وأغلقت المواجهة لصالحك."
                : "الخصم سبقك في الإيقاع. أعد ترتيب التشكيلة وحاول من جديد."}
            </p>
            <div className="result-actions">
              <button type="button" className="primary-action" onClick={startMatch}>
                إعادة اللعب
              </button>
              <button type="button" className="ghost-action" onClick={resetMatch}>
                تغيير التشكيلة
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function playFeedbackTone(
  eventText: string,
  audioContextRef: MutableRefObject<AudioContext | null>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtor();
  }

  const audioContext = audioContextRef.current;
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const frequency = eventText.includes("لعب")
    ? 560
    : eventText.includes("هاجم") || eventText.includes("أصاب")
      ? 300
      : 380;

  oscillator.type = eventText.includes("هاجم") ? "sawtooth" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.26);
}
