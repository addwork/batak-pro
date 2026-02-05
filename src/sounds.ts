// src/sounds.ts

// Ses dosyalarını önbellekte tutmak için bir nesne
const audioCache: Record<string, HTMLAudioElement> = {};

// Sesleri önceden yükle (Preload)
const preloadAudio = (filename: string) => {
  const audio = new Audio(`/sounds/${filename}`);
  audio.preload = "auto";
  audioCache[filename] = audio;
};

// Uygulama açıldığında sesleri yüklemeye başla
try {
  preloadAudio("card.mp3");
  preloadAudio("shuffle.mp3");
  preloadAudio("win.mp3");
  preloadAudio("click.mp3");
  preloadAudio("bid.mp3");
} catch (e) {
  console.warn("Ses dosyaları yüklenemedi.");
}

export const playSound = (
  type: "card" | "shuffle" | "win" | "click" | "bid"
) => {
  // 1. Haptik Titreşim (Mobil Hissiyatı)
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    if (type === "card") navigator.vibrate(5);   // Çok hafif
    if (type === "bid") navigator.vibrate(10);
    if (type === "win") navigator.vibrate([50, 30, 50]); // İki kere titret
  }

  // 2. Ses Çalma
  try {
    const fileName = `${type}.mp3`;
    const audio = audioCache[fileName] || new Audio(`/sounds/${fileName}`);
    
    // Eğer ses zaten çalıyorsa başa sar (Hızlı kart atışları için önemli)
    audio.currentTime = 0;
    
    // Ses seviyeleri
    if (type === 'card') audio.volume = 0.6;
    else if (type === 'shuffle') audio.volume = 0.5;
    else if (type === 'win') audio.volume = 0.4;
    else audio.volume = 0.3;

    // Oynat
    const playPromise = audio.play();
    
    // Tarayıcı hatasını engellemek için (User interaction policy)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Otomatik oynatma engellendiyse sessizce geç
        // (Kullanıcı ekrana ilk dokunduğunda düzelir)
      });
    }
  } catch (e) {
    // Ses dosyası yoksa uygulama çökmesin
  }
};