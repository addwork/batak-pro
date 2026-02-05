import { Card, Suit, Rank, PlayerPosition } from "./types";

const suits: Suit[] = ["Maca", "Kupa", "Sinek", "Karo"];
const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const sortHand = (hand: Card[]): Card[] => {
  const suitOrder: Record<string, number> = {
    Maca: 1,
    Kupa: 2,
    Sinek: 3,
    Karo: 4,
  };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.rank - a.rank;
  });
};

export const getNextPlayer = (current: PlayerPosition): PlayerPosition => {
  if (current === "south") return "east"; // Batak ters saat yönü
  if (current === "east") return "north";
  if (current === "north") return "west";
  return "south";
};

export const getPartner = (player: PlayerPosition): PlayerPosition => {
  if (player === "south") return "north";
  if (player === "north") return "south";
  if (player === "west") return "east";
  return "west";
};
