// src/App.tsx
import React, { useEffect, useState } from "react";
import { validateMove, getTrickWinner } from "./rules";
import {
  calculateAdvancedBotBid,
  findSmartMove,
  resetAIMemory,
  rememberCard,
} from "./ai";
import { playSound } from "./sounds";
import {
  createDeck,
  shuffleDeck,
  sortHand,
  getNextPlayer,
  getPartner,
} from "./deck";
import {
  Card,
  SuitSymbols,
  GamePhase,
  PlayerPosition,
  Suit,
  UserStats,
} from "./types";
import "./App.css";

const CIZ_BID = 14;
const CHARACTERS = ["FATİH", "BARIŞ", "MUHAMMET", "BAYRAM"];

const getInitialStats = (): UserStats => {
  try {
    const saved = localStorage.getItem("batakStats");
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { totalGames: 0, wins: 0, cizCount: 0, totalPoints: 0, league: "BRONZE" };
};

type HandRenderMode = "FACE_UP" | "FACE_DOWN";

function App() {
  const [stats, setStats] = useState<UserStats>(getInitialStats());
  const [setupComplete, setSetupComplete] = useState(false);
  const [myIdentity, setMyIdentity] = useState<string>("FATİH");
  const [isFriendMode, setIsFriendMode] = useState<boolean>(false);
  const [playerNames, setPlayerNames] = useState<Record<PlayerPosition, string>>({
    south: "",
    west: "",
    north: "",
    east: "",
  });

  const [phase, setPhase] = useState<GamePhase>("IDLE");
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [bidOwner, setBidOwner] = useState<PlayerPosition | null>(null);
  const [trump, setTrump] = useState<string>("");
  const [turn, setTurn] = useState<PlayerPosition>("south");
  const [dealer, setDealer] = useState<PlayerPosition>("east");
  const [hands, setHands] = useState<{
    south: Card[];
    west: Card[];
    north: Card[];
    east: Card[];
  }>({ south: [], west: [], north: [], east: [] });
  const [tableCards, setTableCards] = useState<{ player: PlayerPosition; card: Card }[]>([]);
  const [roundTricks, setRoundTricks] = useState<{
    south: number;
    west: number;
    north: number;
    east: number;
  }>({ south: 0, west: 0, north: 0, east: 0 });
  const [totalScore, setTotalScore] = useState<{ US: number; THEM: number }>({
    US: 0,
    THEM: 0,
  });
  const [roundSummary, setRoundSummary] = useState<any>(null);
  const [bidHistory, setBidHistory] = useState<{ player: string; action: string }[]>([]);
  const [activeBidders, setActiveBidders] = useState<PlayerPosition[]>([]);

  const playerTypes = {
    south: "HUMAN",
    west: "BOT",
    north: isFriendMode ? "HUMAN" : "BOT",
    east: "BOT",
  } as const;

  // --- SETUP ---
  const finalizeSetup = () => {
    const s = myIdentity;
    const n =
      s === "FATİH"
        ? "MUHAMMET"
        : s === "MUHAMMET"
        ? "FATİH"
        : s === "BARIŞ"
        ? "BAYRAM"
        : "BARIŞ";
    const others = CHARACTERS.filter((c) => c !== s && c !== n);
    setPlayerNames({ south: s, north: n, west: others[0], east: others[1] });
    setSetupComplete(true);
    playSound("click");
    startNewRound();
  };

  const startNewRound = () => {
    playSound("shuffle");
    resetAIMemory();

    const deck = shuffleDeck(createDeck());
    const south = sortHand(deck.slice(0, 13));
    const west = sortHand(deck.slice(13, 26));
    const north = sortHand(deck.slice(26, 39));
    const east = sortHand(deck.slice(39, 52));

    setHands({ south, west, north, east });
    setTableCards([]);
    setRoundTricks({ south: 0, west: 0, north: 0, east: 0 });

    setCurrentBid(0);
    setBidOwner(null);
    setTrump("");
    setRoundSummary(null);
    setBidHistory([]);

    setActiveBidders(["south", "west", "north", "east"]);
    const firstBidder = getNextPlayer(dealer);
    setTurn(firstBidder);
    setPhase("BIDDING");
  };

  // --- GAME LOGIC ---
  const handleBidAction = (player: PlayerPosition, amount: number | "PAS") => {
    const actionText = amount === "PAS" ? "PAS" : amount === CIZ_BID ? "ÇİZ!" : amount.toString();
    setBidHistory((prev) => [...prev, { player: playerNames[player], action: actionText }]);
    playSound(amount === "PAS" ? "click" : "bid");

    // 1) ÇİZ
    if (amount === CIZ_BID) {
      setBidOwner(player);
      setCurrentBid(CIZ_BID);

      if (playerTypes[player] === "HUMAN") {
        setTurn(player);
        setPhase("TRUMP_SELECTION");
      } else {
        const analysis = calculateAdvancedBotBid(hands[player]);
        setTimeout(() => handleTrumpSelect(analysis.preferredSuit), 800);
      }
      return;
    }

    // 2) PAS
    if (amount === "PAS") {
      const remaining = activeBidders.filter((p) => p !== player);
      setActiveBidders(remaining);

      // SENARYO A: Herkes PAS dedi (İhale mecburen dağıtıcıya 7 ile kaldı)
      if (currentBid === 0 && remaining.length === 1) {
        setBidOwner(dealer);
        setCurrentBid(7);

        // --- DÜZELTME BURADA ---
        // Eğer dağıtıcı İNSAN ise, otomatik koz seçme! Seçtirt.
        if (playerTypes[dealer] === "HUMAN") {
            setTurn(dealer);
            setPhase("TRUMP_SELECTION"); // Koz seçme ekranına git
        } else {
            // Dağıtıcı BOT ise otomatik seçip başlasın
            const analysis = calculateAdvancedBotBid(hands[dealer]);
            setTrump(analysis.preferredSuit);
            setPhase("PLAYING");
            setTurn(dealer);
        }
        return;
      }

      // SENARYO B: İhaleyi birisi yükseltti ve diğer herkes çekildi (Kazanan belli)
      if (remaining.length === 1) {
        const winner = remaining[0];
        setBidOwner(winner);

        if (playerTypes[winner] === "HUMAN") {
          setTurn(winner);
          setPhase("TRUMP_SELECTION");
        } else {
          const analysis = calculateAdvancedBotBid(hands[winner]);
          setTimeout(() => handleTrumpSelect(analysis.preferredSuit), 800);
        }
        return;
      }

      // SENARYO C: Hala teklif verenler var, sıradakine geç
      let next = getNextPlayer(player);
      while (!remaining.includes(next)) next = getNextPlayer(next);
      setTurn(next);
      return;
    }

    // 3) normal raise
    if (typeof amount === "number" && amount > currentBid) {
      setCurrentBid(amount);
      setBidOwner(player);

      let next = getNextPlayer(player);
      while (!activeBidders.includes(next)) next = getNextPlayer(next);
      setTurn(next);
    }
  };

  const handleTrumpSelect = (selectedSuit: Suit) => {
    setTrump(selectedSuit);
    setPhase("PLAYING");
    playSound("bid");
    // DÜZELTME 2: İhale kaç olursa olsun, İhaleyi Alan (bidOwner) başlar.
    setTurn(bidOwner as PlayerPosition);
  };

  const playCardGeneric = (player: PlayerPosition, card: Card) => {
    playSound("card");
    rememberCard(card);

    setHands((prev) => ({ ...prev, [player]: prev[player].filter((c) => c.id !== card.id) }));
    setTableCards((prev) => {
      const newTable = [...prev, { player, card }];
      if (newTable.length < 4) setTurn(getNextPlayer(player));
      return newTable;
    });
  };

  const handleUserClick = (card: Card, cardOwner: PlayerPosition) => {
    if (phase !== "PLAYING") return;

    // KURAL 1: Eşim (North) ihaleyi aldıysa, ben (South) İZLEYİCİYİM.
    // Sıra bende bile olsa kartlarıma dokunamam, Bot (North) oynayacak.
    if (bidOwner === "north" && cardOwner === "south") {
        console.log("Sen izleyicisin, eşin oynayacak.");
        return;
    }

    // KURAL 2: Oynama yetkisi kontrolü
    let canIPlay = false;

    // A) Sıra bende ve kart benim
    if (turn === "south" && cardOwner === "south") {
        canIPlay = true;
    }
    
    // B) İhaleyi BEN aldım, sıra EŞİMDE (North) ve kart EŞİMİN
    // (Normalde North bir BOT ama ihaleyi ben aldığım için onu ben yönetiyorum)
    if (bidOwner === "south" && turn === "north" && cardOwner === "north") {
        canIPlay = true;
    }

    if (canIPlay) {
      const validation = validateMove(card, hands[cardOwner], tableCards, trump);
      if (!validation.isValid) {
        alert(validation.message);
        return;
      }
      playCardGeneric(cardOwner, card);
    }
  };

  // --- BOT BIDDING ---
  useEffect(() => {
    if (phase === "BIDDING" && playerTypes[turn] === "BOT") {
      const timer = setTimeout(() => {
        // Güvenlik: El boşsa PAS geç
        if (!hands[turn] || hands[turn].length === 0) {
           handleBidAction(turn, "PAS");
           return;
        }

        const analysis = calculateAdvancedBotBid(hands[turn]);
        if (analysis.bid === CIZ_BID) handleBidAction(turn, CIZ_BID);
        else if (typeof analysis.bid === "number" && analysis.bid > currentBid) handleBidAction(turn, analysis.bid);
        else handleBidAction(turn, "PAS");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [phase, turn, currentBid, activeBidders, hands]);

  // --- BOT PLAYING (KUSURSUZ İHALECİ MANTIĞI) ---
  useEffect(() => {
    // Sadece OYUN (PLAYING) aşamasında ve masa dolmamışken çalışır
    if (phase !== "PLAYING" || tableCards.length === 4) return;

    const activePlayer = turn;
    let shouldBotPlay = false;

    // --- SENARYO ANALİZİ ---

    // 1. Sıra Batı (West) veya Doğu (East) ise -> DAİMA BOT OYNAR
    if (activePlayer === "west" || activePlayer === "east") {
        shouldBotPlay = true;
    }
    
    // 2. Sıra Kuzey (North) ise:
    else if (activePlayer === "north") {
        // Eğer ihaleyi GÜNEY (Sen) aldıysan -> Sen oynayacaksın. (Bot SUSAR)
        if (bidOwner === "south") {
            shouldBotPlay = false;
        } 
        // Eğer ihaleyi başkası aldıysa -> Bot kendi oynar.
        else {
            shouldBotPlay = true;
        }
    }

    // 3. Sıra Güney (South - SEN) ise:
    else if (activePlayer === "south") {
        // Eğer ihaleyi KUZEY (Bot Eşin) aldıysa -> O senin yerine oynar. (Bot OYNAR)
        if (bidOwner === "north") {
            shouldBotPlay = true;
        }
        // Değilse kontrol sende (Bot SUSAR)
        else {
            shouldBotPlay = false;
        }
    }

    if (!shouldBotPlay) return;

    // --- BOT HAMLESİ ---
    const timer = setTimeout(() => {
      const botHand = hands[activePlayer];
      if (!botHand || botHand.length === 0) return;

      // İhaleyi alan takımı belirle (Botun stratejisi için)
      const isBidder = (bidOwner === activePlayer) || (getPartner(bidOwner!) === activePlayer);
      
      // Masadaki açık el (Dummy)
      // Eğer ihale Güney veya Kuzey'deyse -> Kuzey açıktır.
      // Eğer ihale Batı veya Doğu'daysa -> İhalecinin ortağı açıktır.
      let dummyHand: Card[] | null = null;
      if (bidOwner === "south" || bidOwner === "north") dummyHand = hands.north;
      else if (bidOwner === "west") dummyHand = hands.east;
      else if (bidOwner === "east") dummyHand = hands.west;

      const cardToPlay = findSmartMove(
          botHand, 
          tableCards, 
          trump, 
          activePlayer, 
          isBidder, 
          dummyHand 
      );
      
      playCardGeneric(activePlayer, cardToPlay);
    }, 1000); 

    return () => clearTimeout(timer);
  }, [turn, phase, hands, tableCards, trump, bidOwner]);

  // --- TRICK RESOLUTION ---
  useEffect(() => {
    if (tableCards.length !== 4) return;

    const winner = getTrickWinner(tableCards, trump);
    const timer = setTimeout(() => {
      const updatedTricks = { ...roundTricks, [winner]: roundTricks[winner] + 1 };
      setRoundTricks(updatedTricks);
      setTableCards([]);

      if (currentBid === CIZ_BID) {
        const bidderTeam = bidOwner === "south" || bidOwner === "north" ? "US" : "THEM";
        const winnerTeam = winner === "south" || winner === "north" ? "US" : "THEM";
        if (bidderTeam !== winnerTeam) {
          finishRound(false, updatedTricks);
          return;
        }
      }

      if (hands.south.length === 0) finishRound(false, updatedTricks);
      else setTurn(winner);
    }, 1200);

    return () => clearTimeout(timer);
  }, [tableCards, trump, hands, roundTricks, currentBid, bidOwner]);

  const finishRound = (isSurrender: boolean = false, finalTricks = roundTricks) => {
    const usTricks = finalTricks.south + finalTricks.north;
    const themTricks = finalTricks.west + finalTricks.east;

    let scoreUS = 0,
      scoreTHEM = 0;
    const bidderTeam = bidOwner === "south" || bidOwner === "north" ? "US" : "THEM";

    let resultStatus = "";

    if (isSurrender) {
      if (bidderTeam === "US") {
        scoreUS = -currentBid;
        scoreTHEM = 14 - currentBid;
        resultStatus = "PES ETTİNİZ";
      } else {
        scoreTHEM = -currentBid;
        scoreUS = 14 - currentBid;
        resultStatus = "RAKİP PES ETTİ";
      }
    } else {
      if (currentBid === CIZ_BID) {
        if ((bidderTeam === "US" ? usTricks : themTricks) === 13) {
          resultStatus = "ÇİZ BAŞARILI!";
          if (bidderTeam === "US") {
            scoreUS = 150;
            scoreTHEM = -100;
          } else {
            scoreTHEM = 150;
            scoreUS = -100;
          }
        } else {
          resultStatus = "ÇİZ BAŞARISIZ";
          setTotalScore({ US: 0, THEM: 0 });
          setRoundSummary({
            bidder: playerNames[bidOwner || "south"],
            result: "OYUN BİTTİ",
            usScore: 0,
            themScore: 0,
          });
          setPhase("FINISHED");
          return;
        }
      } else {
        if (bidderTeam === "US") {
          scoreUS = usTricks >= currentBid ? usTricks : -currentBid;
          scoreTHEM = themTricks === 0 ? -currentBid : themTricks;
          resultStatus = usTricks >= currentBid ? "İHALE TUTTU" : "BATTIK";
        } else {
          scoreTHEM = themTricks >= currentBid ? themTricks : -currentBid;
          scoreUS = usTricks === 0 ? -currentBid : usTricks;
          resultStatus = themTricks >= currentBid ? "RAKİP ALDI" : "RAKİP BATTI";
        }
      }
    }

    setTotalScore({ US: totalScore.US + scoreUS, THEM: totalScore.THEM + scoreTHEM });
    if (scoreUS > 0 && !isSurrender) playSound("win");

    setRoundSummary({
      bidder: playerNames[bidOwner || "south"],
      bid: currentBid === CIZ_BID ? "ÇİZ" : currentBid,
      trump: trump ? SuitSymbols[trump as Suit] : "",
      result: resultStatus,
      usScore: scoreUS,
      themScore: scoreTHEM,
    });

    setPhase("FINISHED");
  };

  // --- UI HELPERS ---
  const getCardImageUrl = (card: Card) => {
    const r =
      card.rank === 10
        ? "0"
        : card.rank === 11
        ? "J"
        : card.rank === 12
        ? "Q"
        : card.rank === 13
        ? "K"
        : card.rank === 14
        ? "A"
        : card.rank.toString();

    const s =
      card.suit === "Maca"
        ? "S"
        : card.suit === "Kupa"
        ? "H"
        : card.suit === "Sinek"
        ? "C"
        : "D";

    return `https://deckofcardsapi.com/static/img/${r}${s}.png`;
  };

  const getSuitColor = (suit: string) =>
    suit === "Kupa" || suit === "Karo" ? "suit-red" : "suit-black";

  const renderPlayerBadge = (pos: PlayerPosition, extra: string) => (
    <div className={`player-badge ${extra} ${turn === pos ? "active-turn" : ""}`}>
      <div className="pb-name">
        {playerNames[pos]} {bidOwner === pos && "👑"}
      </div>
      <div className="pb-score">{roundTricks[pos]}</div>
    </div>
  );

const renderPlayedCard = (item: { player: PlayerPosition; card: Card }) => {
  let x = "-50%";
  let y = "-50%";
  let rot = Math.random() * 6 - 3;

  if (item.player === "south") {
    y = "-20%";
    x = "-90%";
  }

  if (item.player === "north") {
    y = "-80%";
    x = "-80%";
  }

  if (item.player === "west") {
    x = "-20%";
    y = "-50%";
    rot -= 10;
  }

  if (item.player === "east") {
    x = "-110%";
    y = "-50%";
    rot += 10;
  }

  return (
    <div
      key={item.card.id}
      className="played-card"
      style={{
        transform: `translate(${x}, ${y}) rotate(${rot}deg)`,
        zIndex: 10,
      }}
    >
      <img
        src={getCardImageUrl(item.card)}
        className="card-img"
        alt="played"
      />
    </div>
  );
};

  const renderHandTwoRows = (
    cards: Card[],
    owner: PlayerPosition,
    mode: HandRenderMode,
    isInteractable: boolean,
    extraClass: string = ""
  ) => {
    const topRow = cards.slice(0, 6);
    const bottomRow = cards.slice(6, 13);

    const renderRow = (row: Card[], rowKey: "top" | "bottom") => (
      <div className={`hand-row ${rowKey}`}>
        {row.map((card) => (
          <div
            key={card.id}
            className={`card-visual ${isInteractable ? "interactive my-card" : ""}`}
            onClick={() => {
              if (mode === "FACE_UP") handleUserClick(card, owner);
            }}
          >
            <img
              src={
                mode === "FACE_UP"
                  ? getCardImageUrl(card)
                  : "https://deckofcardsapi.com/static/img/back.png"
              }
              className="card-img"
              alt={mode === "FACE_UP" ? "card" : "back"}
            />
          </div>
        ))}
      </div>
    );

    return (
      <div className={`hand-container ${owner}-hand ${extraClass}`}>
        {renderRow(topRow, "top")}
        {renderRow(bottomRow, "bottom")}
      </div>
    );
  };

  const renderNorthHand = () => {
    const isBiddingFinished = phase !== "IDLE" && phase !== "BIDDING";
    const isMyTeamBidder = bidOwner === "south" || bidOwner === "north";
    const canSee = isBiddingFinished && isMyTeamBidder;
    return renderHandTwoRows(hands.north, "north", canSee ? "FACE_UP" : "FACE_DOWN", false, "north-slot");
  };

  const renderSideStack = (pos: PlayerPosition) => {
    const isDummy =
      phase === "PLAYING" && bidOwner !== null && getPartner(bidOwner) === pos;

    if (isDummy) {
      return renderHandTwoRows(hands[pos], pos, "FACE_UP", false, "side-open");
    }

    return (
      <>
        {Array.from({ length: hands[pos].length }).map((_, i) => (
          <div key={i} className="side-card-back" style={{ marginBottom: -10, zIndex: i }} />
        ))}
      </>
    );
  };

  if (!setupComplete) {
    return (
      <div className="login-screen">
        <div className="logo-container">
          <h1 className="hero-title">BATAK</h1>
          <div className="hero-title" style={{ fontSize: 24, marginTop: -10 }}>
            PRO
          </div>
          <div className="hero-sub">ROYAL CASINO EDITION</div>
        </div>

        <div className="hero-fan">
          <img
            src="https://deckofcardsapi.com/static/img/AC.png"
            className="fan-card"
            style={{ transform: "rotate(-30deg) translateY(10px) translateX(-40px)" }}
            alt="C"
          />
          <img
            src="https://deckofcardsapi.com/static/img/AD.png"
            className="fan-card"
            style={{ transform: "rotate(-10deg) translateY(-5px) translateX(-15px)", zIndex: 2 }}
            alt="D"
          />
          <img
            src="https://deckofcardsapi.com/static/img/AH.png"
            className="fan-card"
            style={{ transform: "rotate(10deg) translateY(-5px) translateX(15px)", zIndex: 3 }}
            alt="H"
          />
          <img
            src="https://deckofcardsapi.com/static/img/AS.png"
            className="fan-card"
            style={{ transform: "rotate(30deg) translateY(10px) translateX(40px)", zIndex: 4 }}
            alt="S"
          />
        </div>

        <div className="char-selection-area">
          <div className="selection-title">OYUNCU SEÇİNİZ</div>
          <div className="char-grid">
            {CHARACTERS.map((c) => (
              <button
                key={c}
                onClick={() => setMyIdentity(c)}
                className={`char-btn ${myIdentity === c ? "selected" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
          <button onClick={finalizeSetup} className="btn-start-shiny">
            MASAYA OTUR
          </button>
        </div>
      </div>
    );
  }

  const isSouthInteractable =
    phase === "PLAYING" && turn === "south" && !(bidOwner === "north" && playerTypes["north"] === "BOT");

  return (
    <div className="mobile-container">
      <div className="status-bar">
        <div className="score-pill">
          <span style={{ color: "#81d4fa" }}>BİZ: {totalScore.US}</span>{" "}
          <span style={{ color: "#ef9a9a" }}>ONLAR: {totalScore.THEM}</span>
        </div>

        {currentBid > 0 && (
  <div className="bid-box">
    <div className="bid-label">İHALE</div>
    <div className="bid-value">
      {currentBid === CIZ_BID ? "ÇİZ" : currentBid}
      {trump && (
        <span
          className={`bid-suit ${
            getSuitColor(trump) === "suit-red" ? "red" : "black"
          }`}
        >
          {SuitSymbols[trump as Suit]}
        </span>
      )}
    </div>
  </div>
)}
      </div>

      <div className="game-area">
        <div className="pos-north">{renderPlayerBadge("north", "")}</div>
        <div className="pos-west">{renderPlayerBadge("west", "")}</div>
        <div className="pos-east">{renderPlayerBadge("east", "")}</div>

        <div className="north-area">{renderNorthHand()}</div>

        <div className="west-area">
          <div className="side-stack-container">{renderSideStack("west")}</div>
        </div>
        <div className="east-area">
          <div className="side-stack-container">{renderSideStack("east")}</div>
        </div>

        <div className="center-stack">{tableCards.map(renderPlayedCard)}</div>
      </div>

      <div className="my-hand-container">
        {renderHandTwoRows(hands.south, "south", "FACE_UP", isSouthInteractable, "south-slot")}

        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {renderPlayerBadge("south", turn === "south" ? "active-turn" : "")}
        </div>
      </div>

      {phase === "BIDDING" && playerTypes[turn] === "HUMAN" && (
        <div className="top-sheet-overlay">
          <div className="top-sheet">
            <div className="sheet-title">İHALE SIRASI</div>
            <div className="bid-log-container">
              {bidHistory.map((h, i) => (
                <div key={i} className="log-item">
                  <span className="log-player">{h.player}</span>
                  <span className="log-action">{h.action}</span>
                </div>
              ))}
            </div>
            <div className="grid-4">
              <button className="btn-mobile btn-pass" onClick={() => handleBidAction(turn, "PAS")}>
                PAS
              </button>
              {[8, 9, 10, 11, 12, 13].map((n) => {
                if (n <= currentBid) return null;
                return (
                  <button key={n} className="btn-mobile" onClick={() => handleBidAction(turn, n)}>
                    {n}
                  </button>
                );
              })}
              {currentBid !== CIZ_BID && (
                <button className="btn-mobile btn-ciz" onClick={() => handleBidAction(turn, CIZ_BID)}>
                  ÇİZ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "TRUMP_SELECTION" && playerTypes[turn] === "HUMAN" && (
        <div className="top-sheet-overlay">
          <div className="top-sheet">
            <div className="sheet-title">KOZ SEÇ</div>
            <div className="trump-grid">
              {(["Maca", "Kupa", "Sinek", "Karo"] as Suit[]).map((s) => (
                <button key={s} onClick={() => handleTrumpSelect(s)} className="trump-btn">
                  <span className={getSuitColor(s) === "suit-red" ? "red" : "black"}>
                    {SuitSymbols[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "FINISHED" && roundSummary && (
        <div className="top-sheet-overlay">
          <div className="top-sheet">
            <div className="sheet-title">{roundSummary.result}</div>

            <div className="result-info">
              <div>
                İhaleci: <span className="result-highlight">{roundSummary.bidder}</span> (
                {roundSummary.bid})
              </div>
              <div style={{ marginTop: 10 }}>
                KAZANILAN PUAN: <span className="result-highlight">{roundSummary.usScore}</span>
              </div>
            </div>

            <button
              className="btn-start-mobile"
              onClick={() => {
                setDealer(getNextPlayer(dealer));
                startNewRound();
              }}
            >
              DEVAM ET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;