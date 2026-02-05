import { Card, Suit, PlayerPosition } from "./types";
import { validateMove, getTrickWinner } from "./rules";
import { getPartner } from "./deck";

// Botların hafızası (Basitleştirilmiş: Çıkan kartları takip eder)
let playedCardsMemory: Card[] = [];

export const resetAIMemory = () => {
  playedCardsMemory = [];
};
export const rememberCard = (card: Card) => {
  playedCardsMemory.push(card);
};

// İhale Stratejisi
export const calculateAdvancedBotBid = (
  hand: Card[]
): { bid: number; preferredSuit: Suit } => {
  const suits: Suit[] = ["Maca", "Kupa", "Sinek", "Karo"];
  let bestBid = 0;
  let bestSuit: Suit = "Maca";

  suits.forEach((suit) => {
    const mySuit = hand.filter((c) => c.suit === suit);
    let points = 0;

    // 1. Koz Gücü
    if (mySuit.length >= 5) points += mySuit.length - 3; // Uzunluk avantajı

    // 2. Yüksek Kartlar (As=1, Papaz=0.75)
    hand.forEach((c) => {
      if (c.rank === 14) points += 1;
      else if (c.rank === 13) points += 0.75;
      else if (c.rank === 12) points += 0.25;
    });

    // 3. BLÖF FAKTÖRÜ (%10 ihtimalle elini olduğundan 1 fazla gör)
    if (Math.random() < 0.1) points += 1;

    if (points > bestBid) {
      bestBid = Math.floor(points);
      bestSuit = suit;
    }
  });

  // 8 altı YOK. Ya PAS ya 8+
if (bestBid < 8) {
  return { bid: "PAS" as any, preferredSuit: bestSuit };
}

if (bestBid <= 9) {
  return { bid: 8, preferredSuit: bestSuit };
}

if (bestBid <= 11) {
  return { bid: 9, preferredSuit: bestSuit };
}

if (bestBid <= 13) {
  return { bid: 10, preferredSuit: bestSuit };
}

return { bid: 14, preferredSuit: bestSuit }; // ÇİZ

};

// Oyun Stratejisi
export const findSmartMove = (
  hand: Card[],
  tableCards: { player: PlayerPosition; card: Card }[],
  trumpSuit: string,
  myPosition: PlayerPosition,
  isBidder: boolean // Bu bot ihaleyi aldı mı?
): Card => {
  const validCards = hand.filter(
    (card) =>
      validateMove(
        card,
        hand,
        tableCards.map((t) => ({ card: t.card })),
        trumpSuit
      ).isValid
  );
  if (validCards.length === 0) return hand[0];
  if (validCards.length === 1) return validCards[0];

  // SENARYO 1: İLK KART ATILIYOR
  if (tableCards.length === 0) {
    // Eğer ihaleyi ben aldıysam ve elimde koz varsa, koz çekip rakiplerin kozunu bitirmeye çalışırım.
    const trumps = validCards.filter((c) => c.suit === trumpSuit);

    // Koz Çekme Mantığı: Dışarıda hala koz var mı? (Hafıza kontrolü)
    const trumpsPlayed = playedCardsMemory.filter(
      (c) => c.suit === trumpSuit
    ).length;
    const totalTrumps = 13;
    const myTrumps = hand.filter((c) => c.suit === trumpSuit).length;
    const trumpsOutside = totalTrumps - trumpsPlayed - myTrumps;

    if (isBidder && trumps.length > 0 && trumpsOutside > 0) {
      // En büyük kozu çekerek başla (Hakimiyet)
      trumps.sort((a, b) => b.rank - a.rank);
      return trumps[0];
    }

    // Koz çekmiyorsam, en güçlü yan rengimin en büyüğünü (As varsa) oynarım
    validCards.sort((a, b) => b.rank - a.rank);
    return validCards[0];
  }

  // SENARYO 2: YERE KART ATILMIŞ
  const partner = getPartner(myPosition);
  const currentWinner = getTrickWinner(tableCards, trumpSuit);

  // Eğer ortağım alıyorsa -> Kart ezme (Puanlı oyun değil ama yine de düşük at)
  if (currentWinner === partner) {
    validCards.sort((a, b) => a.rank - b.rank); // En küçük
    return validCards[0];
  }

  // Rakip alıyorsa -> Geçmeye çalış
  // Geçebileceklerim:
  // a) Rengi yükseltmek
  // b) Çakmak

  // Basit mantık: Kazanabileceğim en düşük kartı at (Boşa As atma)
  // Bu kısım çok karmaşık olabilir, şimdilik "En büyüğü atıp almaya çalış" yapalım.
  validCards.sort((a, b) => b.rank - a.rank);
  return validCards[0];
};
