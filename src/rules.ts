// src/rules.ts
import { Card, PlayerPosition, Suit } from "./types";
import { getPartner } from "./deck";

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

// --- HAMLE KONTROLÜ (HAKEM) ---
export const validateMove = (
  cardToPlay: Card,
  hand: Card[],
  tableCards: { card: Card }[],
  trumpSuit: string
): ValidationResult => {

  if (tableCards.length === 0) return { isValid: true };

  const leadCard = tableCards[0].card;
  const leadSuit = leadCard.suit;

  // Masa şu an kimde? (Koz kontrolü)
  const playedTrumps = tableCards.filter(t => t.card.suit === trumpSuit);
  const isTrumped = playedTrumps.length > 0;
  
  // Yerdeki en büyük kozu bul
  let maxTrumpRank = 0;
  if (isTrumped) {
      maxTrumpRank = Math.max(...playedTrumps.map(t => t.card.rank));
  }

  // --- SENARYO 1: ELİMDE YERDEKİ RENKTEN VAR ---
  if (cardToPlay.suit === leadSuit) {
      // ÖZEL KURAL: Eğer el kozlandıysa, artık o rengi yükseltmek zorunda değilim.
      if (isTrumped) {
          return { isValid: true }; 
      }

      // Kozlanmadıysa, o rengi yükseltmek ZORUNDAYIM.
      const sameSuitCards = tableCards.filter(t => t.card.suit === leadSuit);
      let maxRankOnTable = 0;
      if (sameSuitCards.length > 0) {
          maxRankOnTable = Math.max(...sameSuitCards.map(t => t.card.rank));
      }

      const canBeat = hand.some(c => c.suit === leadSuit && c.rank > maxRankOnTable);
      // Eğer elimde geçen kağıt varsa ve attığım kağıt geçmiyorsa -> HATA
      if (canBeat && cardToPlay.rank <= maxRankOnTable) {
          return { isValid: false, message: `Elinizde daha büyük ${leadSuit} varken küçüğünü atamazsınız!` };
      }
      return { isValid: true };
  }

  // --- SENARYO 2: RENK YOK ---
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    return { isValid: false, message: `Yerde ${leadSuit} varken başka renk atamazsın!` };
  }

  // A) Koz atıyorsam (Çakıyorsam)
  if (trumpSuit && cardToPlay.suit === trumpSuit) {
      // Yerde daha büyük bir koz varsa onu geçmek zorundayım
      if (isTrumped) {
          const canOverTrump = hand.some(c => c.suit === trumpSuit && c.rank > maxTrumpRank);
          if (canOverTrump && cardToPlay.rank <= maxTrumpRank) {
              return { isValid: false, message: "Yerdeki kozdan daha büyüğünü atmalısın!" };
          }
      }
      return { isValid: true };
  }

  // B) Koz da atmıyorsam
  // Kural: Elimde koz varsa ÇAKMAK ZORUNDAYIM.
  if (trumpSuit && cardToPlay.suit !== trumpSuit) {
      const hasTrump = hand.some(c => c.suit === trumpSuit);
      if (hasTrump) {
          return { isValid: false, message: "Elinizde renk yoksa koz ile çakmalısınız!" };
      }
  }

  return { isValid: true };
};

export const getTrickWinner = (
  tableCards: { player: PlayerPosition; card: Card }[],
  trumpSuit: string
): PlayerPosition => {
  if (tableCards.length === 0) return 'south';
  const playedTrumps = tableCards.filter(m => m.card.suit === trumpSuit);
  if (playedTrumps.length > 0) {
    playedTrumps.sort((a, b) => b.card.rank - a.card.rank);
    return playedTrumps[0].player;
  }
  const leadSuit = tableCards[0].card.suit;
  const validCards = tableCards.filter(m => m.card.suit === leadSuit);
  validCards.sort((a, b) => b.card.rank - a.card.rank);
  return validCards[0].player;
};

// Basit Bot Zekası (Yedek)
export const findBestMove = (
    hand: Card[],
    tableCards: { player: PlayerPosition; card: Card }[],
    trumpSuit: string,
    myPosition: PlayerPosition
): Card => {
    const validCards = hand.filter(card => validateMove(card, hand, tableCards.map(t => ({card: t.card})), trumpSuit).isValid);
    if (validCards.length === 0) return hand[0];
    validCards.sort((a, b) => a.rank - b.rank); // Basitçe en küçüğü at
    return validCards[0];
};

// Basit İhale Zekası (Yedek)
export const calculateBotBid = (hand: Card[]): { bid: number, preferredSuit: Suit } => {
    const suits: Suit[] = ['Maca', 'Kupa', 'Sinek', 'Karo'];
    let bestBid = 0;
    let bestSuit: Suit = 'Maca';
    suits.forEach(suit => {
        const mySuit = hand.filter(c => c.suit === suit);
        let points = 0;
        if (mySuit.length >= 5) points += (mySuit.length - 4);
        hand.forEach(c => { if (c.rank === 14) points++; if (c.rank === 13) points += 0.5; });
        if (points > bestBid) { bestBid = Math.floor(points); bestSuit = suit; }
    });
    return { bid: Math.max(8, bestBid), preferredSuit: bestSuit };
};