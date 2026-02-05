// src/ai.ts
import { Card, Suit, PlayerPosition } from "./types";
import { validateMove, getTrickWinner } from "./rules";
import { getPartner } from "./deck";

// --- HAFIZA VE KART SAYMA ---
let playedCardsMemory: Card[] = [];

export const resetAIMemory = () => {
  playedCardsMemory = [];
};

export const rememberCard = (card: Card) => {
  playedCardsMemory.push(card);
};

/**
 * Bir kartın şu anki durumda "Patron" (En büyük) olup olmadığını kontrol eder.
 * Örnek: Dışarıda AS çıktıysa, PAPAZ artık patrondur.
 */
const isMasterCard = (card: Card, trumpSuit: string): boolean => {
  // O renkten dışarıda bu karttan daha büyük bir kart kaldı mı?
  // Hafızadaki kartlara bak:
  const sameSuitPlayed = playedCardsMemory.filter((c) => c.suit === card.suit);
  
  // Bu renkteki benden büyük kartlar oynandı mı?
  // (Örn: Elimde Papaz(13) var. As(14) oynandı mı?)
  const higherCards = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].filter(
    (rank) => rank > card.rank
  );

  // Eğer benden büyük olan tüm kartlar zaten oynanmışsa, benim kartım patrondur.
  const allHigherPlayed = higherCards.every((rank) =>
    sameSuitPlayed.some((played) => played.rank === rank)
  );

  return allHigherPlayed;
};

// --- İHALE STRATEJİSİ ---
export const calculateAdvancedBotBid = (
  hand: Card[]
): { bid: number | "PAS"; preferredSuit: Suit } => {
  const suits: Suit[] = ["Maca", "Kupa", "Sinek", "Karo"];
  let bestBid = 0;
  let bestSuit: Suit = "Maca";

  suits.forEach((suit) => {
    const mySuit = hand.filter((c) => c.suit === suit);
    let points = 0;

    // 1. Kendi elimin gücü (Koz uzunluğu)
    if (mySuit.length >= 4) points += mySuit.length - 3; 

    // Yüksek kartlar (As=1, Papaz=0.8, Kız=0.5)
    hand.forEach((c) => {
      let val = 0;
      if (c.rank === 14) val = 1;       
      else if (c.rank === 13) val = 0.8; 
      else if (c.rank === 12) val = 0.5; 
      
      // Eğer bu kart koz ise değeri artar
      if (c.suit === suit) val += 0.2;
      
      points += val;
    });

    // 2. ORTAK FAKTÖRÜ
    // Elimiz belirli bir gücün üzerindeyse ortağın da en az 2 el alacağını varsayarız.
    if (points >= 4) {
      points += 2.2; 
    }

    if (points > bestBid) {
      bestBid = Math.floor(points);
      bestSuit = suit;
    }
  });

  // İhale Kararları (Sayı veya PAS döndürür)
  if (bestBid < 8) return { bid: "PAS", preferredSuit: bestSuit };
  if (bestBid > 13) return { bid: 14, preferredSuit: bestSuit }; // ÇİZ

  return { bid: bestBid, preferredSuit: bestSuit };
};

// --- OYUN STRATEJİSİ (MASTER AI) ---
export const findSmartMove = (
  hand: Card[],
  tableCards: { player: PlayerPosition; card: Card }[],
  trumpSuit: string,
  myPosition: PlayerPosition,
  isBidder: boolean, // Bu bot ihaleyi aldı mı?
  dummyHand: Card[] | null // Masadaki açık el (Varsa)
): Card => {
  const partner = getPartner(myPosition);

  // 1. Kurallara uygun (Legal) kartları bul.
  // rules.ts dosyasındaki "validateMove" fonksiyonu zorunlu hamleleri zaten filtreler.
  // Bot sadece bu filtrelenmiş kartlar arasından seçim yapar.
  const validCards = hand.filter(
    (card) =>
      validateMove(
        card,
        hand,
        tableCards.map((t) => ({ card: t.card })),
        trumpSuit
      ).isValid
  );

  // Tek seçenek varsa düşünmeye gerek yok, mecburi hamle.
  if (validCards.length === 0) return hand[0]; // Güvenlik
  if (validCards.length === 1) return validCards[0];

  // --- SENARYO A: İLK KART ATILIYOR (LEAD) ---
  if (tableCards.length === 0) {
    
    // 1. İhaleyi ben aldıysam ve elimde koz varsa:
    // Rakiplerin kozunu sökmek için KOZ çek.
    if (isBidder) {
      const trumps = validCards.filter((c) => c.suit === trumpSuit);
      
      // Dışarıda koz bitti mi diye hafızayı kontrol et
      const playedTrumpsCount = playedCardsMemory.filter(c => c.suit === trumpSuit).length;
      const myTrumpsCount = hand.filter(c => c.suit === trumpSuit).length;
      const totalTrumps = 13;
      
      // Hala dışarıda koz varsa ve elimde koz varsa, en büyük kozu çek.
      if (trumps.length > 0 && (playedTrumpsCount + myTrumpsCount < totalTrumps)) {
        trumps.sort((a, b) => b.rank - a.rank);
        return trumps[0];
      }
    }

    // 2. AÇIK EL (DUMMY) ANALİZİ VE DÜRTME (PROVOKASYON)
    // Eğer ben ihaleci değilsem ve masada açık bir el varsa:
    if (dummyHand && dummyHand.length > 0 && !isBidder) {
        // Koz dışındaki renklere bak
        const safeSuits = ['Maca', 'Kupa', 'Sinek', 'Karo'].filter(s => s !== trumpSuit);
        
        for (const s of safeSuits) {
             const dummyCardsInSuit = dummyHand.filter(c => c.suit === s);
             // Dummy'de bu renkten Papaz(13) veya Kız(12) var mı? (Ama As yoksa)
             const hasTrappable = dummyCardsInSuit.some(c => c.rank === 13 || c.rank === 12);
             const hasAce = dummyCardsInSuit.some(c => c.rank === 14);

             if (hasTrappable && !hasAce) {
                 // Fırsat! O renkten elimde küçük bir kart varsa oynayayım.
                 // Böylece ihaleci Dummy'deki Papazı/Kızı kullanmak zorunda kalsın veya ezilsin.
                 const mySmallProvokers = validCards.filter(c => c.suit === s && c.rank < 10);
                 if (mySmallProvokers.length > 0) {
                     return mySmallProvokers[0]; // Dürt!
                 }
             }
        }
    }

    // 3. Normal Hamle: "Patron" (Master) kartları oyna.
    // As veya dışarıda büyüğü kalmamış Papaz gibi kartları çekip puan topla.
    const masterCards = validCards.filter(c => isMasterCard(c, trumpSuit));
    if (masterCards.length > 0) {
      masterCards.sort((a, b) => b.rank - a.rank); // En büyüğünü at
      return masterCards[0];
    }

    // 4. Hiçbiri yoksa, rakibe koz çaktırmayacak güvenli bir küçük kart at.
    // Tercihen koz olmayan en küçük kart.
    const nonTrumps = validCards.filter(c => c.suit !== trumpSuit);
    if (nonTrumps.length > 0) {
        nonTrumps.sort((a, b) => a.rank - b.rank); // En küçük
        return nonTrumps[0];
    }
    
    // Mecbur koz veya kalan ne varsa en küçüğü
    validCards.sort((a, b) => a.rank - b.rank);
    return validCards[0];
  }

  // --- SENARYO B: YERE KART ATILMIŞ (FOLLOW) ---
  
  // Şu anki kazananı ve en büyük kartı bul
  const leadSuit = tableCards[0].card.suit;
  const playedTrumps = tableCards.filter(t => t.card.suit === trumpSuit);
  const playedInSuit = tableCards.filter(t => t.card.suit === leadSuit);
  
  let currentMaxRank = 0;
  let winnerPlayer: string = "";

  if (playedTrumps.length > 0) {
     const maxC = playedTrumps.reduce((p, c) => (p.card.rank > c.card.rank ? p : c));
     currentMaxRank = maxC.card.rank;
     winnerPlayer = maxC.player;
  } else if (playedInSuit.length > 0) {
     const maxC = playedInSuit.reduce((p, c) => (p.card.rank > c.card.rank ? p : c));
     currentMaxRank = maxC.card.rank;
     winnerPlayer = maxC.player;
  }

  const isPartnerWinning = winnerPlayer === partner;
  const isTableAce = currentMaxRank === 14; // Yerde AS var mı? (Veya en büyük koz)

  // 1. ORTAĞIM KAZANIYORSA -> KORUMA MODU
  if (isPartnerWinning) {
    // Ortağım alıyorsa ve kurallar (validateMove) izin veriyorsa, elimdeki EN KÜÇÜK kartı atmalıyım.
    // Asla ortağın Papazının üstüne As atmamalıyım (Ezmemeliyim).
    validCards.sort((a, b) => a.rank - b.rank); // Küçükten büyüğe
    return validCards[0]; // En küçüğü oyna
  }

  // 2. RAKİP KAZANIYORSA -> MÜCADELE MODU
  
  // A) Rakibin kartı çok büyükse (AS) veya geçmem imkansızsa:
  // Boşuna Papaz veya Kız harcama. En küçüğünü at.
  // Not: playedTrumps.length === 0 kontrolü, eğer koz oynanıyorsa As olsa bile kozla geçebilirim demek.
  if (isTableAce && playedTrumps.length === 0 && validCards[0].suit === leadSuit) {
      validCards.sort((a, b) => a.rank - b.rank);
      return validCards[0];
  }

  // B) Geçebiliyor muyum?
  let winningCards: Card[] = [];

  if (playedTrumps.length > 0) {
      // Yerde koz var, daha büyük koz lazım
      winningCards = validCards.filter(c => c.suit === trumpSuit && c.rank > currentMaxRank);
  } else {
      // Yerde koz yok
      if (validCards[0].suit === leadSuit) {
          // Rengi yükselterek alabilirim
          winningCards = validCards.filter(c => c.suit === leadSuit && c.rank > currentMaxRank);
      } else if (validCards[0].suit === trumpSuit) {
          // Çakarak alabilirim
          winningCards = validCards.filter(c => c.suit === trumpSuit);
      }
  }

  if (winningCards.length > 0) {
      // Rakibi geçebiliyorum!
      // TASARRUF KURALI: Rakibi geçebilecek EN KÜÇÜK kartı at.
      // Örnek: Yerde 10'lu var. Elimde As ve Kız var. As atma, Kız at.
      winningCards.sort((a, b) => a.rank - b.rank); // Küçükten büyüğe
      return winningCards[0];
  }

  // 3. KAZANAMIYORSAM -> TESLİM MODU
  // Rakibi geçemiyorum. O halde elimdeki en değersiz kartı atayım.
  validCards.sort((a, b) => a.rank - b.rank);
  return validCards[0];
};