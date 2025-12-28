// 1. Tambah useRef di import React
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, BookOpen, Star, X, Trophy, Sparkles, Layers, Library, Crown, Medal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Tipe Data ---
interface BookData {
  title: string;
  author: string;
  pages: number;
  rating: number;
  dateRead: Date | null;
  dateAdded: Date | null;
  shelf: string; // 'read', 'to-read', 'currently-reading'
}

interface Aura {
  name: string;
  desc: string;
  color1: string;
  color2: string;
  icon: React.ReactNode;
  tags: string[];
  roast: string; 
}

// --- Komponen Helper: Progress Bar ---
const StoryProgress = ({ total, current }: { total: number; current: number }) => (
  <div className="absolute top-4 left-0 w-full px-2 flex gap-1 z-50">
    {Array.from({ length: total }).map((_, idx) => (
      <div key={idx} className="h-1.5 flex-1 bg-black/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: idx <= current ? "100%" : "0%" }}
          transition={{ duration: 0.3 }}
          className="h-full bg-black"
        />
      </div>
    ))}
  </div>
);

// --- Komponen Helper: Random Barcode ---
const RandomBarcode = () => {
  // Kita generate 60 garis dengan ketebalan acak
  // Menggunakan useMemo agar barcode tidak berubah-ubah saat re-render ringan
  const bars = React.useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      key: i,
      // Ketebalan acak: 1px (tipis), 3px (sedang), atau 5px (tebal)
      width: Math.random() > 0.7 ? 5 : Math.random() > 0.4 ? 3 : 1, 
      // Tinggi sedikit bervariasi biar kesan 'grunge' atau rata saja (opsional)
      height: '100%' 
    }));
  }, []);

  return (
    <div className="w-full flex flex-col items-center mt-4 opacity-90">
      {/* Bagian Garis-garis */}
      <div className="h-12 flex justify-center items-stretch gap-[2px] w-full overflow-hidden">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="bg-black"
            style={{ 
              width: `${bar.width}px`,
              // Opsional: Bikin beberapa garis agak pendek biar kayak barcode rusak dikit
              height: Math.random() > 0.95 ? '90%' : '100%' 
            }}
          />
        ))}
      </div>
      {/* Bagian Angka di bawah barcode */}
      <div className="flex justify-between w-full max-w-[200px] mt-1 px-2">
         <p className="font-mono text-[8px] tracking-[0.5em] font-bold">
            {/* Generate angka random seolah-olah nomor seri */}
            {Math.floor(100000 + Math.random() * 900000)}
         </p>
         <p className="font-mono text-[8px] tracking-[0.5em] font-bold">
            2025
         </p>
      </div>
    </div>
  );
};

// --- Komponen Helper: Slide Layout ---
const SlideLayout = ({ bgStyle, children, className = "" }: { bgStyle?: string, children: React.ReactNode, className?: string }) => (
  <div className={`w-full h-full border-x-4 border-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ${className}`} style={{ background: bgStyle }}>
    <div className="absolute inset-0 opacity-10 pointer-events-none" 
         style={{ backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2px)', backgroundSize: '24px 24px' }}>
    </div>
    {children}
  </div>
);

function App() {
  const [readData, setReadData] = useState<BookData[]>([]);
  const [tbrCount, setTbrCount] = useState(0); 
  const [view, setView] = useState<'upload' | 'story'>('upload');
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // STATE UNTUK NAMA USER
  const [username, setUsername] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  // --- CSV Processing ---
  const processCSV = (file: File, source: 'goodreads' | 'storygraph') => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data;
        
        // 1. Parse Raw Data
        const allBooks: BookData[] = rows.map((row: any) => {
          if (source === 'goodreads') {
            const dateReadStr = row['Date Read'];
            const dateAddedStr = row['Date Added'];
            return {
              title: row['Title'],
              author: row['Author'],
              pages: parseInt(row['Number of Pages']) || 0,
              rating: parseInt(row['My Rating']) || 0,
              dateRead: dateReadStr ? new Date(dateReadStr) : null,
              dateAdded: dateAddedStr ? new Date(dateAddedStr) : null,
              shelf: row['Exclusive Shelf'] // 'read', 'to-read'
            };
          } else {
            // StoryGraph
            return {
              title: row['Title'],
              author: row['Authors'],
              pages: parseInt(row['Pages']) || 0,
              rating: parseFloat(row['Star Rating']) || 0,
              dateRead: row['Read Date'] ? new Date(row['Read Date']) : null,
              dateAdded: null, 
              shelf: row['Read Status'] === 'read' ? 'read' : 'to-read' 
            };
          }
        });

        // 2. Filter Logic Baru (Smart Date Detection)
        const readIn2025 = allBooks.filter(b => {
          // Harus status 'read'
          if (b.shelf !== 'read') return false;

          // Cek 1: Punya Date Read di 2025?
          if (b.dateRead && b.dateRead.getFullYear() === 2025) {
            return true;
          }

          // Cek 2 (Fallback): Date Read Kosong TAPI Date Added 2025?
          if (!b.dateRead && b.dateAdded && b.dateAdded.getFullYear() === 2025) {
            // Kita anggap ini dibaca di 2025
            return true;
          }

          return false;
        }).map(b => {
            // UPDATE: Jika dateRead kosong, isi dengan dateAdded agar statistik (bulan dsb) tetap jalan
            if (!b.dateRead && b.dateAdded) {
                return { ...b, dateRead: b.dateAdded };
            }
            return b;
        });

        // 3. Filter TBR (Tetap sama)
        const addedToTbr2025 = allBooks.filter(b => 
          b.shelf === 'to-read' && 
          b.dateAdded && 
          b.dateAdded.getFullYear() === 2025
        );

        setReadData(readIn2025);
        setTbrCount(addedToTbr2025.length);
        
        setView('story');
        setCurrentSlide(0);
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, source: 'goodreads' | 'storygraph') => {
    if (!username.trim()) {
        alert("Isi nama dulu dong bestie! 😤");
        e.target.value = '';
        return;
    }
    if (e.target.files?.[0]) processCSV(e.target.files[0], source);
  };

  // --- STATS CALCULATION ---
  const totalBooks = readData.length;
  const totalPages = readData.reduce((acc, curr) => acc + curr.pages, 0);
  const avgPages = totalBooks > 0 ? Math.round(totalPages / totalBooks) : 0;
  const avgRatingVal = totalBooks > 0 ? (readData.reduce((acc, curr) => acc + curr.rating, 0) / totalBooks) : 0;
  const avgRating = avgRatingVal.toFixed(1);
  const thickestBook = readData.reduce((prev, current) => (prev.pages > current.pages) ? prev : current, { title: '-', pages: 0, author: '-' });

  // --- TOP 5 LOGIC ---
  const topBooks = [...readData]
    .filter(b => b.rating > 0)
    .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.pages - a.pages;
    })
    .slice(0, 5);

  const authorCounts: { [key: string]: number } = {};
  readData.forEach(book => {
      const cleanAuthor = book.author.split('(')[0].trim();
      authorCounts[cleanAuthor] = (authorCounts[cleanAuthor] || 0) + 1;
  });
  const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  // --- NEW LOGIC: MOST ACTIVE MONTH ---
  const getMostActiveMonth = () => {
    if (readData.length === 0) return "-";
    const monthCounts: { [key: number]: number } = {};
    readData.forEach(book => {
      if (book.dateRead) {
        const month = book.dateRead.getMonth();
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    });
    
    let maxMonth = -1;
    let maxCount = -1;
    Object.entries(monthCounts).forEach(([m, c]) => {
        if (c > maxCount) {
            maxCount = c;
            maxMonth = parseInt(m);
        }
    });

    if (maxMonth === -1) return "-";
    const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
    return `${monthNames[maxMonth]} (${maxCount} BUKU)`;
  };

  const peakMonth = getMostActiveMonth();

  // --- AURA ALGORITHM (With Roasts!) ---
  const getAura = (): Aura => {
    if (tbrCount > (totalBooks * 2) && tbrCount > 5) {
      return {
        name: "COZY COLLECTOR",
        desc: "Kamu sering nambah buku bukan karena butuh, tapi karena takut lupa pengen baca. TBR kamu isinya mimpi-mimpi kecil: “abis ini”, “kalau lagi tenang”, “pas mood-nya dapet”. Setiap buku tuh janji manis ke diri sendiri—dan kamu tulus banget waktu bikin janjinya. Soal kapan ditepati… ya itu urusan nanti.",
        color1: "#A3E635", color2: "#FBBF24", icon: <Library size={48} className="text-white"/>,
        tags: ["#TsundokuLife", "#BeliDulu", "#NantiAjaBacanya"],
        roast: "DENDA PENIMBUNAN (Buku numpuk tapi cuma jadi pajangan)"
      };
    }
    if (totalBooks < 15 && avgPages > 450) {
      return {
        name: "DEEP DIVER",
        desc: "Kamu bukan tipe yang asal nambah buku biar rak terlihat penuh. Setiap buku yang kamu pilih itu berat, tebal, dan butuh komitmen. Membaca bagimu bukan sekadar hiburan, tapi perjalanan panjang—kadang bikin melek semalaman, kadang bikin nangis di kereta. Jumlah buku sedikit? Gapapa. Kualitas pengalamanmu jauh lebih dalam daripada sekadar angka.",
        color1: "#1E3A8A", color2: "#000000", icon: <BookOpen size={48} className="text-white"/>,
        tags: ["#HilangDariPeradaban", "#CommitmentIssuesSolved", "#NoSkimmingZone"],
        roast: "BIAYA SEWA GUA (Kelamaan menghilang dari realita)"
      };
    }
    if (totalBooks > 20 && avgPages < 300 && avgRatingVal < 3.8) {
      return {
        name: "SPEEDY SKEPTIC",
        desc: "Kamu tipe pembaca yang doyan banyak buku, tapi nggak gampang terkesan. Buku cepat habis, tapi hati-hati banget kasih nilai—tidak semua cerita langsung “klik”. Setiap buku yang selesai dibaca adalah pengalaman, bukan kemenangan. Rakmu penuh, tapi ratingmu realistis: kamu bukan orang yang kasih jempol cuma karena buku itu populer. Kamu pembaca yang jujur, kritis, dan always on the move.",
        color1: "#3B82F6", color2: "#EF4444", icon: <Sparkles size={48} className="text-white"/>,
        tags: ["#SpeedRead", "#PlotArmorDetective", "#KritikusHandal"],
        roast: "PENALTI SPEEDRUN (Baca cepat tapi tetap kritis)"
      };
    }
    if (avgRatingVal >= 4.0 && avgPages > 350) {
      return {
        name: "THOROUGH ENJOYER",
        desc: "Kamu bukan tipe pembaca yang asal lari dari satu buku ke buku lain. Kamu membaca dengan serius, menikmati tiap halaman, dan selalu menemukan sesuatu yang berharga. Buku tebal bukan halangan—justru itu tantangan yang kamu nikmati. Rating tinggi bukan karena mudah terkesan, tapi karena kamu sungguh-sungguh menghargai kualitas cerita. Membaca bagimu itu bukan sekadar kebiasaan, tapi pengalaman mendalam yang bikin setiap buku terasa berarti.",
        color1: "#7E22CE", color2: "#EC4899", icon: <BookOpen size={48} className="text-white"/>,
        tags: ["#DepthOverSpeed", "#SavorEveryPage", "#InTooDeep"],
        roast: "DENDA GOODVIBES (Baca 350+ halaman tapi rating tetap 4+, mana bisa dipercaya?)"
      };
    }
    if (avgRatingVal >= 4.2) {
      return {
        name: "SOFT ENTHUSIAST",
        desc: "Kamu tipe pembaca yang gampang jatuh cinta sama cerita. Selalu nemu something to appreciate di tiap buku—entah satu kalimat, satu karakter, atau satu perasaan yang nyantol. Bukan karena bukunya selalu sempurna, tapi karena kamu baca pakai hati, bukan kalkulator. Rating >4 itu bukan lebay, itu tanda kamu menikmati proses, bukan cuma hasil.",
        color1: "#FACC15", color2: "#FB923C", icon: <Star size={48} className="text-white"/>,
        tags: ["#SoftHeartReader", "#ComfortRead", "#EasilyAttached"],
        roast: "BIAYA KEPUASAN (Gampang jatuh cinta sama buku)"
      };
    }
    return {
      name: "BALANCED REALIST",
      desc: "Objektif dan membumi. Nggak gampang kemakan hype, penilaianmu selalu adil. Teman curhat buku terbaik.",
      color1: "#60A5FA", color2: "#94A3B8", icon: <Layers size={48} className="text-white"/>,
      tags: ["#FairReader", "#StayObjective", "#NoOverrate"],
      roast: "BIAYA ADMIN (Hidup terlalu straight, tapi ya aman)"
    };
  };

  const aura = getAura();

  // --- SLIDES (FULL SET) ---
  const slides = [
    // 1. INTRO
    <SlideLayout key="intro" bgStyle="#FFFDF5">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col justify-between py-12 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-left px-2">
          <p className="font-mono text-sm bg-black text-white inline-block px-2 mb-2 rotate-2 shadow-sm">REPORT #2025</p>
          <h1 className="text-6xl font-black italic tracking-tighter leading-[0.8] drop-shadow-sm">BOOK<br/>WRAP</h1>
        </motion.div>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 0.4 }} className="relative">
          <div className="absolute inset-0 bg-pink-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
          <div className="w-48 h-48 bg-yellow-300 border-4 border-black rounded-full mx-auto flex items-center justify-center shadow-[8px_8px_0px_0px_black] relative z-10">
            <BookOpen size={80} strokeWidth={2.5} />
          </div>
        </motion.div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="bg-white border-4 border-black p-4 rounded-xl shadow-[6px_6px_0px_0px_black] rotate-1 mx-4">
           {/* Menggunakan nama user disini */}
           <p className="text-lg font-bold">"Halo, {username || 'Bookworm'}! 👋"</p>
           <p className="text-sm text-gray-600 mt-1">yuk kita bongkar kebiasaan bacamu tahun ini 😌</p>
        </motion.div>
      </motion.div>
    </SlideLayout>,

    // 2. VOLUME
    <SlideLayout key="volume" bgStyle="#F472B6" className="bg-pink-400">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
      <div className="w-full h-full flex flex-col justify-center gap-4 relative z-10">
        <motion.h2 initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-4xl font-black text-white drop-shadow-[4px_4px_0px_black] text-left px-2">
          INI NIH<br/>DATANYA 😌📊
        </motion.h2>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-yellow-300 border-4 border-black p-6 rounded-[2rem] shadow-[8px_8px_0px_0px_black] relative overflow-hidden text-left">
           <Sparkles className="absolute top-4 right-4 opacity-50" />
           <p className="text-xs font-black tracking-widest uppercase mb-2">Buku Selesai</p>
           <p className="text-8xl font-black leading-none tracking-tighter">{totalBooks}</p>
           <div className="mt-2 bg-white/50 border-2 border-black inline-block px-3 py-1 rounded-lg transform -rotate-1">
             <p className="text-xs font-bold font-mono">
               {totalBooks < 5 ? "Pelan tapi pasti... pasti ketiduran 😴" : totalBooks <= 15 ? "Not bad lah, masih sempet napas 😮‍💨" : totalBooks <= 30 ? "Rajin bener, ngejar setoran kak? 🏃💨" : totalBooks <= 60 ? "Definisi bookworm sesungguhnya 🐛" : "Kamu tinggal di perpustakaan ya? Buset... 🤯"}
             </p>
           </div>
        </motion.div>
        <div className="grid grid-cols-2 gap-4">
           <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-white border-4 border-black p-4 rounded-2xl shadow-[6px_6px_0px_0px_black] flex flex-col justify-between aspect-square text-left">
              <Layers size={24} />
              <div>
                <p className="text-5xl font-black">{totalPages < 1000 ? totalPages : (totalPages/1000).toFixed(1) + 'k'}</p>
                <p className="text-[10px] font-bold text-black-500 uppercase leading-none">Halaman</p>
                <p className="text-[8px] text-black-400 mt-1 italic">{totalPages < 1000 ? "Dikit amat..." : "Jempol keriting tuh 👍"}</p>
              </div>
           </motion.div>
           <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="bg-black text-white border-4 border-white p-4 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] flex flex-col justify-between aspect-square text-left relative overflow-hidden">
              {tbrCount > (totalBooks * 2) && (<div className="absolute top-4 -right-4 bg-yellow-400 text-black text-[7px] font-black px-8 py-1 rotate-45 border border-white z-10 shadow-sm text-center">HOARDING<br/>ALERT</div>)}
              <Library size={24} className="text-gray-400"/>
              <div>
                <div className="flex items-end gap-1">
                    <p className="text-5xl font-black text-white">{tbrCount}</p>
                    {tbrCount > totalBooks && <div className="animate-pulse text-yellow-400 mb-2">⚠️</div>}
                </div>
                <p className="text-[10px] font-bold text-white-500 uppercase leading-none">Masuk TBR</p>
                <p className="text-[9px] text-white-400 mt-2 italic leading-tight">
                   {tbrCount === 0 ? "Anti wacana club ✨" : tbrCount < totalBooks ? "Tumben produktif 💅" : tbrCount === totalBooks ? "Balance banget hidup lo ⚖️" : tbrCount > (totalBooks * 2) ? "Hobi checkout doang? 😭" : "Numpuk terooos 📉"}
                </p>
              </div>
           </motion.div>
        </div>
      </div>
    </SlideLayout>,

    // 3. AURA
    <SlideLayout key="aura" bgStyle="#111">
       <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
         <motion.div animate={{ scale: [1, 1.5, 1], rotate: [0, 90, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="w-[500px] h-[500px] blur-[100px] opacity-50 absolute rounded-full" style={{ background: `conic-gradient(from 0deg, ${aura.color1}, ${aura.color2}, ${aura.color1})` }} />
         <div className="absolute inset-0 opacity-10" style={{backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "30px 30px"}}></div>
       </div>
       <motion.div initial={{opacity:0, y:-20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="absolute top-8 left-0 w-full text-center z-20">
          <div className="inline-block px-4 py-1 rounded-full border-2 border-white/30 bg-black/50 backdrop-blur-md">
             <h2 className="text-white font-mono text-xs tracking-[0.3em] uppercase">✨ VIBE CHECK ✨</h2>
          </div>
       </motion.div>
       <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-16">
         <div className="text-center space-y-4 mb-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 0.4 }} className="inline-block p-4 rounded-full border-4 border-white bg-white/10 backdrop-blur-md shadow-[0px_0px_30px_rgba(255,255,255,0.3)]">
               {aura.icon}
            </motion.div>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}>
               <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 leading-none uppercase drop-shadow-lg font-sans px-2">
                 {aura.name}
               </h1>
            </motion.div>
         </div>
         <div className="flex flex-wrap justify-center gap-2 px-6 mb-8">
            {aura.tags.map((tag, i) => (
               <motion.span key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + (i * 0.1) }} className="text-[10px] font-bold font-mono bg-white text-black px-3 py-1 rounded-full uppercase border-2 border-black shadow-[2px_2px_0px_rgba(255,255,255,0.5)]">
                 {tag}
               </motion.span>
            ))}
         </div>
         <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="bg-black/40 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-white mx-4 w-full max-w-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full" style={{background: aura.color1}}></div>
            <p className="text-sm font-medium leading-relaxed italic opacity-90 text-left">"{aura.desc}"</p>
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-[10px] font-mono opacity-60">
               <span>AVG RATING: {avgRating}</span>
               <span>AVG PAGES: {avgPages}</span>
            </div>
         </motion.div>
       </div>
    </SlideLayout>,

    // 4. HIGHLIGHT (Thickest)
    <SlideLayout key="thickest" bgStyle="#A78BFA" className="bg-purple-400">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-45 h-10 bg-yellow-300/90 -rotate-2 z-20 shadow-md flex items-center justify-center border border-yellow-400/50">
         <span className="font-mono font-bold text-xs tracking-widest text-black/70">THICKEST_READ_2025.PNG</span>
      </div>
      <div className="w-full h-full flex flex-col justify-center relative z-10 px-4 pt-10">
         <motion.div initial={{ rotate: -2, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} className="bg-white border-4 border-black p-1 pb-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative">
            <div className="bg-black py-2 px-3 flex justify-between items-center mb-6 border-b-4 border-black">
               <span className="text-white font-mono text-[10px] uppercase tracking-wider">thickest_read_of_2025.exe</span>
               <div className="flex gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white/20"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-white/20"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-white/20"></div>
               </div>
            </div>
            <div className="px-4 text-center">
               <div className="relative inline-block">
                  <Trophy size={80} className="mx-auto mb-4 text-yellow-400 drop-shadow-[2px_2px_0px_black] stroke-[1.5]" />
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }} className="absolute -top-2 -right-10 bg-red-500 text-white text-[8px] font-black px-3 py-1 rounded-full -rotate-12 border-2 border-black shadow-sm">THICKEST READ</motion.div>
               </div>
               <h3 className="text-2xl md:text-3xl font-black leading-[0.9] line-clamp-3 mb-3 uppercase tracking-tighter">{thickestBook.title}</h3>
               <p className="text-xs font-bold font-mono bg-purple-100 text-purple-700 inline-block px-3 py-1 rounded-full border-2 border-purple-200">{thickestBook.author}</p>
               <div className="mt-8 border-2 border-black bg-gray-50 p-4 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-3 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-black">THICKNESS LEVEL</div>
                  <p className="text-6xl font-black leading-none tracking-tighter">{thickestBook.pages}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Halaman</p>
                  <div className="w-full h-3 bg-gray-200 border-2 border-black rounded-full mt-2 overflow-hidden relative">
                     <div className="absolute inset-0 opacity-20" style={{backgroundImage: "linear-gradient(45deg,rgba(0,0,0,.1) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.1) 50%,rgba(0,0,0,.1) 75%,transparent 75%,transparent)", backgroundSize: "10px 10px"}}></div>
                     <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.5, duration: 1 }} className="h-full bg-green-400" />
                  </div>
               </div>
               <div className="mt-5">
                 <p className="text-[10px] font-bold italic bg-yellow-300 text-black inline-block px-3 py-1 transform -rotate-1 border border-black shadow-[2px_2px_0px_black]">
                    {thickestBook.pages < 200 ? "Ini yang paling tebal… tahun ini ringan ya bestie 😌" : thickestBook.pages < 400 ? "Ini buku paling tebal kamu. Kamu keren bisa selesaiin buku setebal ini 👏" : thickestBook.pages < 600 ? "BUKU PALING TEBAL KAMU. DAN KAMU BERHASIL TAMATIN. RESPECT 🫡" : "INI BUKU PALING TEBAL KAMU. DAN KAMU BERHASIL TAMATIN. LEGEND 🫡🔥"}
                 </p>
               </div>
            </div>
         </motion.div>
      </div>
    </SlideLayout>,

    // 5. TOP BOOKS
    <SlideLayout key="top-books" bgStyle="#4ADE80" className="bg-green-400">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
        <div className="w-full h-full flex flex-col justify-center relative z-10 px-4">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-6">
                <h2 className="text-5xl font-black text-black drop-shadow-[4px_4px_0px_white] italic tracking-tighter">
                    TOP TIER 🌟
                </h2>
                <span className="text-xs font-mono font-bold bg-black text-white px-2 py-1 mt-2 inline-block -rotate-2">NO DEBAT. FINAL.</span>
            </motion.div>

            <div className="space-y-3">
                {topBooks.map((book, i) => (
                    <motion.div 
                        key={i}
                        initial={{ x: -50, opacity: 0 }} 
                        animate={{ x: 0, opacity: 1 }} 
                        transition={{ delay: i * 0.1 }}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_black] ${i === 0 ? 'bg-yellow-300 scale-105' : 'bg-white'}`}
                    >
                        <div className={`w-8 h-8 flex items-center justify-center font-black text-xl border-2 border-black rounded-full ${i === 0 ? 'bg-black text-yellow-300' : 'bg-gray-200 text-black'}`}>
                            {i === 0 ? <Crown size={16}/> : i + 1}
                        </div>
                        <div className="text-left overflow-hidden">
                            <p className="font-bold text-sm truncate leading-tight">{book.title}</p>
                            <div className="flex items-center gap-1">
                                <p className="text-[10px] font-mono truncate max-w-[100px]">{book.author}</p>
                                <div className="flex gap-0.5">
                                    {Array.from({length: book.rating}).map((_, idx) => (
                                        <Star key={idx} size={8} fill="black" strokeWidth={0}/>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
                {topBooks.length === 0 && <p className="text-center font-bold">Belum ada rating bintang 5 nih :(</p>}
            </div>
        </div>
    </SlideLayout>,

    // 6. TOP AUTHORS
    <SlideLayout key="top-authors" bgStyle="#FB923C" className="bg-orange-400">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
        <div className="w-full h-full flex flex-col justify-center relative z-10 px-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-8 relative inline-block mx-auto">
                <div className="bg-white border-4 border-black p-4 rounded-full">
                    <Medal size={48} />
                </div>
                <div className="absolute -bottom-2 -right-4 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 border-2 border-black -rotate-6">
                    BUCIN DETECTED
                </div>
            </motion.div>

            <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-4xl font-black text-white drop-shadow-[3px_3px_0px_black] uppercase mb-6 leading-none">
                STAN LIST 💖
            </motion.h2>

            <div className="bg-white border-4 border-black p-4 rounded-2xl shadow-[8px_8px_0px_0px_black] rotate-1">
                <div className="space-y-4">
                    {topAuthors.map(([author, count], i) => (
                        <div key={i} className="flex justify-between items-center border-b-2 border-dashed border-gray-300 last:border-0 pb-2 last:pb-0">
                            <div className="flex items-center gap-2 text-left">
                                <span className="font-mono text-xs font-bold text-gray-400">0{i+1}</span>
                                <span className="font-bold text-sm truncate w-40">{author}</span>
                            </div>
                            <span className="font-black text-sm bg-black text-white px-2 rounded-md">{count} Buku</span>
                        </div>
                    ))}
                    {topAuthors.length === 0 && <p className="text-center text-xs">Belum cukup data bestie</p>}
                </div>
                <div className="mt-4 pt-2 border-t-4 border-black text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">FIXASI TAHUN INI</p>
                </div>
            </div>
        </div>
    </SlideLayout>,

    // 7. SUMMARY (Receipt Style - Upgraded with Late Fees)
    <SlideLayout key="summary" bgStyle="#FDE047" className="bg-yellow-300">
       <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.5\"/%3E%3C/svg%3E')"}}></div>
       <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
         
         <motion.div 
           initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring" }}
           className="bg-white w-full max-w-[340px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.2)] relative text-black"
           style={{ 
             clipPath: "polygon(0 0, 100% 0, 100% 99%, 98% 100%, 96% 99%, 94% 100%, 92% 99%, 90% 100%, 88% 99%, 86% 100%, 84% 99%, 82% 100%, 80% 99%, 78% 100%, 76% 99%, 74% 100%, 72% 99%, 70% 100%, 68% 99%, 66% 100%, 64% 99%, 62% 100%, 60% 99%, 58% 100%, 56% 99%, 54% 100%, 52% 99%, 50% 100%, 48% 99%, 46% 100%, 44% 99%, 42% 100%, 40% 99%, 38% 100%, 36% 99%, 34% 100%, 32% 99%, 30% 100%, 28% 99%, 26% 100%, 24% 99%, 22% 100%, 20% 99%, 18% 100%, 16% 99%, 14% 100%, 12% 99%, 10% 100%, 8% 99%, 6% 100%, 4% 99%, 2% 100%, 0 99%)"
           }}
         >
           {/* Hole punch & Stamp */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-200 rounded-full shadow-inner"></div>
           <div className="absolute top-16 right-6 border-4 border-red-500 text-red-500 font-black text-xl px-2 py-1 rotate-[-15deg] opacity-70 mask-image-grunge">
              VERIFIED
           </div>

           {/* Header */}
           <div className="mt-4 text-center border-b-2 border-dashed border-black pb-4 mb-4">
             <h2 className="text-3xl font-black italic tracking-tighter">BOOK WRAP</h2>
             <p className="font-mono text-[10px] text-gray-500 tracking-widest mt-1">
                {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
             </p>
             <p className="font-mono text-[10px] text-gray-500">USER: {username ? username.toUpperCase() : 'YOU'}</p>
           </div>

           {/* List Items */}
           <div className="space-y-2 font-mono text-xs uppercase">
             <div className="flex justify-between">
               <span>TOTAL BOOKS</span>
               <span className="font-bold text-sm">{totalBooks} QTY</span>
             </div>
             <div className="flex justify-between">
               <span>TOTAL PAGES</span>
               <span className="font-bold text-sm">{totalPages.toLocaleString()} PGS</span>
             </div>
             {/* Most Active Month */}
             <div className="flex justify-between">
               <span>PEAK MONTH</span>
               <span className="font-bold text-sm">{peakMonth}</span>
             </div>
             
             {/* Divider */}
             <div className="border-b-2 border-dashed border-gray-300 my-3"></div>

             {/* TOP AUTHOR SECTION */}
             <div className="py-1">
                <span className="text-[10px] text-gray-500 block mb-1">TOP OBSESSION (AUTHOR)</span>
                <span className="font-black text-lg bg-black text-white px-2 py-0.5 inline-block transform -rotate-1">
                    {topAuthors.length > 0 ? topAuthors[0][0] : "-"}
                </span>
             </div>

             <div className="border-b-2 border-dashed border-gray-300 my-3"></div>

             {/* Rating & Persona */}
             <div className="flex justify-between items-end mb-4">
                <div>
                    <span className="text-[10px] text-gray-500 block">VIBE / PERSONA</span>
                    <span className="font-bold text-sm">{aura.name}</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-gray-500 block">AVG RATING</span>
                    <span className="font-black text-xl">{avgRating}/5</span>
                </div>
             </div>

             {/* LATE FEES / ROAST SECTION (NEW) */}
             <div className="py-2 border-2 border-red-500 border-dashed p-2 rounded bg-red-50">
               <div className="flex justify-between items-start">
                 <span className="text-[10px] text-red-500 font-bold">LATE FEES / PENALTY</span>
                 <span className="font-mono text-[10px] text-red-600 font-bold text-right w-2/3 leading-tight">
                    {aura.roast}
                 </span>
               </div>
               <div className="text-right text-[8px] font-mono mt-1 text-red-400">
                  + Rp 0 (Diskon Member)
               </div>
             </div>

           </div>

           {/* Footer: Thank You & Barcode */}
           <div className="mt-6 pt-4 border-t-2 border-black text-center">
              <p className="font-bold text-xs italic mb-2">"No matter the stats, kamu tetep keren!💛 2026, siap baca lebih banyak buku yaaa 😎📚"</p>
              <RandomBarcode />              
              <p className="text-[8px] font-mono mt-1 text-gray-400">Built with 💻 by @moktadikta</p>
           </div>
         </motion.div>
       </div>
    </SlideLayout>
  ];

  const nextSlide = useCallback(() => { if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1); }, [currentSlide, slides.length]);
  const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(c => c - 1); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  return (
    <div className={`min-h-screen font-sans selection:bg-pink-300 transition-colors duration-500 ${view === 'upload' ? 'bg-[#FFFDF5]' : 'bg-[#1a1a1a]'}`}>
      {view === 'upload' ? (
        <div className="min-h-screen flex flex-col relative">
            <nav className="p-6 flex justify-between items-center border-b-4 border-black bg-white sticky top-0 z-50">
                <div className="flex items-center gap-3 select-none cursor-pointer hover:scale-105 transition-transform">
                  <div className="bg-black text-yellow-300 p-2 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_#ec4899] -rotate-6">
                    <BookOpen size={24} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col leading-none">
                    <h1 className="text-3xl font-black tracking-tighter italic text-black">BOOK WRAP</h1>
                    <span className="text-[10px] font-mono font-bold bg-pink-500 text-white px-2 py-0.5 border-2 border-black rounded shadow-[2px_2px_0px_0px_black] self-start transform -rotate-2 mt-1">#2025EDITION</span>
                  </div>
                </div>
            </nav>
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6 mb-12">
                    <h2 className="text-5xl md:text-7xl font-black leading-tight text-black">
                        Apa <span className="bg-yellow-300 px-4 border-4 border-black shadow-[6px_6px_0px_0px_black] -rotate-2 inline-block mx-2 text-black">persona</span><br className="hidden md:block"/> membaca kamu di 2025?
                    </h2>
                    <p className="text-xl text-gray-600 font-medium max-w-2xl mx-auto">
                        Nggak perlu login, nggak perlu insecure. Cukup upload CSV Goodreads/Storygraph → kami spill aura bacamu 🔮📖
                    </p>
                </motion.div>
                
                {/* INPUT NAMA USER */}
                <div className="mb-8 w-full max-w-xs">
                    <label className="block text-left font-bold text-sm mb-2 ml-1">Nama kamu siapa? 👇</label>
                    <input 
                      type="text" 
                      placeholder="Ketik nama panggilan..." 
                      className="w-full border-4 border-black p-4 rounded-xl shadow-[4px_4px_0px_black] focus:outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all font-bold text-lg bg-white"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center">
                    <label className="cursor-pointer group relative flex-1 max-w-xs mx-auto md:mx-0">
                        <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'goodreads')} />
                        <div className="bg-[#F4F1EA] group-hover:bg-[#EBE6D9] border-4 border-black p-8 rounded-[32px] shadow-[8px_8px_0px_0px_black] group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-[4px_4px_0px_0px_black] transition-all aspect-square flex flex-col justify-center items-center gap-4">
                            <div className="bg-amber-100 p-5 rounded-full border-4 border-black">
                                <BookOpen size={48} className="text-black" />
                            </div>
                            <span className="font-black text-2xl">Goodreads</span>
                            <span className="text-xs font-mono bg-black text-white px-3 py-1 rounded-full">Upload CSV-nya langsung gas 🚀</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group relative flex-1 max-w-xs mx-auto md:mx-0 opacity-50 grayscale cursor-not-allowed">
                        <div className="bg-[#2CE0D3] border-4 border-black p-8 rounded-[32px] shadow-[8px_8px_0px_0px_black] aspect-square flex flex-col justify-center items-center gap-4">
                            <div className="bg-white p-5 rounded-full border-4 border-black">
                                <Upload size={48} className="text-black" />
                            </div>
                            <span className="font-black text-2xl">StoryGraph</span>
                            <span className="text-xs font-mono bg-black text-white px-3 py-1 rounded-full">Coming Soon (sabar ya bestie ✌️) </span>
                        </div>
                    </label>
                </div>
            </main>
            {/* Updated Footer with Credit */}
            <footer className="p-4 text-center font-mono text-xs text-black-400 space-y-2">
                <p>Client-side only. Kami kepo bacaanmu, tapi nggak nyimpen datanya kok 😉</p>
                <p className="font-bold text-black opacity-50">Built with 💻 by @moktadikta</p>
            </footer>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen p-4">
             <div className="relative w-full md:w-[400px] h-[85vh] md:h-[800px] bg-white md:rounded-[30px] overflow-hidden shadow-[0px_0px_50px_rgba(255,255,255,0.1)] border-4 border-black md:border-none">
                <div className="absolute top-0 w-full p-4 z-50 flex justify-between items-start pointer-events-none">
                    <button onClick={() => { setView('upload'); setReadData([]); }} className="pointer-events-auto bg-black/10 backdrop-blur rounded-full p-2 hover:bg-black/20 transition">
                    <X size={24} color="white" />
                    </button>
                    {/* <button 
                        onClick={handleDownloadImage} 
                        className="pointer-events-auto bg-black/10 backdrop-blur rounded-full p-2 hover:bg-black/20 transition group"
                        title="Download Slide"
                    >
                        <Download size={24} color="white" className="group-hover:scale-110 transition-transform" />
                    </button> */}
                </div>
                <StoryProgress total={slides.length} current={currentSlide} />
                <div className="absolute inset-0 z-40 flex">
                    <div className="w-[30%] h-full cursor-w-resize" onClick={prevSlide} />
                    <div className="w-[70%] h-full cursor-e-resize" onClick={nextSlide} />
                </div>
                <AnimatePresence mode='wait'>
                    <motion.div 
                        key={currentSlide} 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="w-full h-full"
                    >
                        {/* Ref sudah terpasang dengan benar di sini */}
                        <div ref={printRef} className="w-full h-full bg-[#1a1a1a]">
                            {slides[currentSlide]}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
            <div className="hidden md:block fixed bottom-8 text-white font-mono text-xs opacity-50">Tekan ← / → buat lanjut. Santai, ini bukan ujian.</div>
        </div>
      )}
    </div>
  );
}

export default App;
