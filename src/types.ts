export type Suit = "Maca" | "Kupa" | "Sinek" | "Karo";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export const SuitSymbols: Record<Suit, string> = {
  Maca: "♠",
  Kupa: "♥",
  Sinek: "♣",
  Karo: "♦",
};

export type GamePhase =
  | "IDLE"
  | "BIDDING"
  | "TRUMP_SELECTION"
  | "PLAYING"
  | "FINISHED";
export type PlayerPosition = "south" | "west" | "north" | "east";

// YENİ: İstatistik ve Lig
export type League = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

export interface UserStats {
  totalGames: number;
  wins: number;
  cizCount: number;
  totalPoints: number;
  league: League;
}
