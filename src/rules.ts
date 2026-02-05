// src/rules.ts
import { Card, PlayerPosition } from "./types";

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * BATAK OYUN KURALLARI (HAKEM)
 * 1. Renk Mecburiyeti: Yerdeki rengi oynamak zorundasın.
 * 2. Geçme Zorunluluğu: Yerdeki rengi geçebiliyorsan (ortağın olsa bile) geçmek zorundasın.
 * 3. Çakma Zorunluluğu: Renk yoksa ve elinde koz varsa çakmak zorundasın.
 * 4. Koz Büyütme Zorunluluğu: Çakılıyorsa ve elinde daha büyük koz varsa, büyük kozu atmak zorundasın.
 * 5. Alt Koz Mecburiyeti: Çakılıyorsa, elinde büyük koz yoksa ama küçük koz varsa, yine de koz atmak zorundasın (Yanlış yere kaçamazsın).
 */
export const validateMove = (
  cardToPlay: Card,
  hand: Card[],
  tableCards: { card: Card }[],
  trumpSuit: string
): ValidationResult => {

  // A) Masa boşsa her kart oynanabilir.
  if (tableCards.length === 0) return { isValid: true };

  const leadCard = tableCards[0].card;
  const leadSuit = leadCard.suit;
  
  // Masada koz oynanmış mı?
  const playedTrumps = tableCards.filter(t => t.card.suit === trumpSuit);
  const isTableTrumped = playedTrumps.length > 0;

  // Yerdeki en yüksek kartları belirle
  let maxRankInLeadSuit = 0;
  const cardsInLeadSuit = tableCards.filter(t => t.card.suit === leadSuit);
  if (cardsInLeadSuit.length > 0) {
      maxRankInLeadSuit = Math.max(...cardsInLeadSuit.map(t => t.card.rank));
  }

  let maxRankInTrump = 0;
  if (isTableTrumped) {
      maxRankInTrump = Math.max(...playedTrumps.map(t => t.card.rank));
  }

  // --- SENARYO 1: ELİMDE YERDEKİ RENKTEN VAR MI? ---
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit) {
      // KURAL: Elimde o renk varken başka renk atamam.
      if (cardToPlay.suit !== leadSuit) {
          return { isValid: false, message: `Elinizde ${leadSuit} varken başka renk atamazsınız!` };
      }

      // KURAL: Eğer yer kozlanmadıysa, rengi yükseltmek ZORUNDAYIM.
      if (!isTableTrumped) {
          const canBeat = hand.some(c => c.suit === leadSuit && c.rank > maxRankInLeadSuit);
          // Elimde büyüğü varken küçüğünü mü atıyorum?
          if (canBeat && cardToPlay.rank <= maxRankInLeadSuit) {
              return { isValid: false, message: "Geçme Zorunluluğu: Yerdeki kağıttan daha büyüğünü atmalısınız!" };
          }
      }
      
      // NOT: Eğer yer kozlandıysa, rengi yükseltmek zorunda değilim (istediğim sineği atabilirim).
      // Çünkü zaten koz yediği için benim sinek asım bile olsa işe yaramaz. 
      // Sadece "Sinek" atmam yeterli.
      return { isValid: true };
  }

  // --- SENARYO 2: ELİMDE O RENK YOK ---
  
  // KURAL: O renk yoksa, elimde KOZ var mı?
  const hasTrump = hand.some(c => c.suit === trumpSuit);

  if (hasTrump) {
      // a) Koz atmıyorsam (ve elimde koz varken) -> YASAK
      if (cardToPlay.suit !== trumpSuit) {
          return { isValid: false, message: "Elinizde renk yoksa Koz atmak zorundasınız!" };
      }

      // b) Koz atıyorsam...
      // Yerde daha önce koz atılmış mı?
      if (isTableTrumped) {
          // Elimde yerdeki kozu geçebilecek bir koz var mı?
          const canOverTrump = hand.some(c => c.suit === trumpSuit && c.rank > maxRankInTrump);
          
          if (canOverTrump) {
              // Varsa, büyüğünü atmak ZORUNDAYIM.
              if (cardToPlay.rank <= maxRankInTrump) {
                  return { isValid: false, message: "Yerdeki kozdan daha büyüğünü atmalısınız!" };
              }
          } else {
              // Yoksa (elimdeki kozlar yerdekinden küçük), yine de KOZ atmak zorundayım.
              // (Zaten yukarıdaki 'cardToPlay.suit !== trumpSuit' kontrolü bunu sağladı).
              // Yani küçük kozumu atıp ezilirim, sorun yok.
          }
      }
      
      return { isValid: true };
  }

  // --- SENARYO 3: NE RENK VAR, NE DE KOZ VAR ---
  // Bu durumda istediğim kartı atabilirim (Slaft / Yana kaçış).
  return { isValid: true };
};

/**
 * ELİ KİM KAZANDI HESAPLAYICISI
 */
export const getTrickWinner = (
  tableCards: { player: PlayerPosition; card: Card }[],
  trumpSuit: string
): PlayerPosition => {
  if (tableCards.length === 0) return 'south';

  // 1. Koz oynandı mı? Oynandıysa en büyük kozu atan alır.
  const playedTrumps = tableCards.filter(t => t.card.suit === trumpSuit);
  if (playedTrumps.length > 0) {
      playedTrumps.sort((a, b) => b.card.rank - a.card.rank); // Büyükten küçüğe
      return playedTrumps[0].player;
  }

  // 2. Koz yoksa, ilk atılan rengin en büyüğünü atan alır.
  const leadSuit = tableCards[0].card.suit;
  const validCards = tableCards.filter(t => t.card.suit === leadSuit);
  
  // (Başka renk atanlar zaten kaybetmiştir)
  validCards.sort((a, b) => b.card.rank - a.card.rank); // Büyükten küçüğe
  return validCards[0].player;
};