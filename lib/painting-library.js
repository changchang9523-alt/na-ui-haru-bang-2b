// Mood painting library for the gallery (v45).
// Every work is by a well-known painter and is in the public domain.
// Images load from Wikimedia Commons; the four works with a `local` copy also
// work offline. Each mood has keywords in Korean, Chinese and English that are
// matched against the day's mood line, diary and thoughts.
(function () {
  const W = "https://upload.wikimedia.org/wikipedia/commons/";
  const P = (path) => W + path;
  const paintings = {
    happy: {
      artist: "Pierre-Auguste Renoir", year: "1876",
      title: { zh: "煎饼磨坊的舞会", ko: "물랭 드 라 갈레트의 무도회", en: "Bal du moulin de la Galette" },
      remote: P("thumb/2/21/Pierre-Auguste_Renoir%2C_Le_Moulin_de_la_Galette.jpg/960px-Pierre-Auguste_Renoir%2C_Le_Moulin_de_la_Galette.jpg")
    },
    warm: {
      artist: "Claude Monet", year: "1875",
      title: { zh: "撑阳伞的女人", ko: "양산을 든 여인", en: "Woman with a Parasol" },
      remote: P("thumb/1/1b/Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg")
    },
    calm: {
      artist: "Claude Monet", year: "1872",
      title: { zh: "日出·印象", ko: "인상, 해돋이", en: "Impression, Sunrise" },
      remote: P("thumb/5/54/Claude_Monet%2C_Impression%2C_soleil_levant.jpg/960px-Claude_Monet%2C_Impression%2C_soleil_levant.jpg")
    },
    lonely: {
      artist: "Caspar David Friedrich", year: "1818",
      title: { zh: "雾海上的旅人", ko: "안개 바다 위의 방랑자", en: "Wanderer above the Sea of Fog" },
      remote: P("thumb/b/b9/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg/960px-Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg")
    },
    sad: {
      artist: "Vincent van Gogh", year: "1890",
      title: { zh: "在永恒之门", ko: "영원의 문에서", en: "At Eternity's Gate" },
      remote: P("a/a6/Old_Man_with_his_Head_in_his_Hands_%28At_Eternity%27s_Gate%29.jpg")
    },
    anxious: {
      artist: "Edvard Munch", year: "1893",
      title: { zh: "呐喊", ko: "절규", en: "The Scream" },
      local: "assets/paintings/scream.jpg",
      remote: P("thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/960px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg")
    },
    angry: {
      artist: "J. M. W. Turner", year: "1805",
      title: { zh: "海难", ko: "난파선", en: "The Shipwreck" },
      local: "assets/paintings/shipwreck.jpg"
    },
    hopeful: {
      artist: "Vincent van Gogh", year: "1889",
      title: { zh: "星月夜", ko: "별이 빛나는 밤", en: "The Starry Night" },
      local: "assets/paintings/starry.jpg",
      remote: P("thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/960px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg")
    },
    excited: {
      artist: "Katsushika Hokusai", year: "1831",
      title: { zh: "神奈川冲浪里", ko: "가나가와 해변의 높은 파도", en: "The Great Wave off Kanagawa" },
      local: "assets/paintings/wave.jpg",
      remote: P("thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/960px-Tsunami_by_hokusai_19th_century.jpg")
    },
    tired: {
      artist: "Vincent van Gogh", year: "1888",
      title: { zh: "阿尔勒的卧室", ko: "아를의 침실", en: "Bedroom in Arles" },
      remote: P("thumb/7/77/Vincent_van_Gogh_-_Van_Gogh%27s_Bedroom_in_Arles_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Van_Gogh%27s_Bedroom_in_Arles_-_Google_Art_Project.jpg")
    },
    nostalgic: {
      artist: "Johannes Vermeer", year: "1663",
      title: { zh: "读信的蓝衣女子", ko: "편지를 읽는 푸른 옷의 여인", en: "Woman Reading a Letter" },
      remote: P("thumb/d/db/Vermeer%2C_Johannes_-_Woman_reading_a_letter_-_ca._1662-1663.jpg/960px-Vermeer%2C_Johannes_-_Woman_reading_a_letter_-_ca._1662-1663.jpg")
    },
    proud: {
      artist: "Vincent van Gogh", year: "1889",
      title: { zh: "向日葵", ko: "해바라기", en: "Sunflowers" },
      remote: P("thumb/4/46/Vincent_Willem_van_Gogh_127.jpg/960px-Vincent_Willem_van_Gogh_127.jpg")
    }
  };
  const moods = {
    happy:     { zh: "开心", ko: "행복", en: "Happy",
      words: /행복|기쁘|기뻤|즐거|즐겁|웃었|좋았|happy|joy|glad|\bfun\b|开心|快乐|高兴|幸福|愉快|好玩/i },
    warm:      { zh: "温暖", ko: "따뜻함", en: "Warm",
      words: /따뜻|감사|고마|사랑|포근|warm|grateful|thank|\blove|cozy|温暖|感动|感谢|感恩|被爱|治愈/i },
    calm:      { zh: "平静", ko: "차분함", en: "Calm",
      words: /차분|편안|평온|잔잔|여유|고요|calm|peace|relax|quiet|serene|平静|安静|放松|宁静|舒服|安心|悠闲/i },
    lonely:    { zh: "孤独", ko: "외로움", en: "Lonely",
      words: /외롭|외로|혼자|고독|쓸쓸|lonely|alone|isolat|孤独|寂寞|一个人|孤单|冷清/i },
    sad:       { zh: "悲伤", ko: "슬픔", en: "Sad",
      words: /슬프|슬펐|우울|눈물|울었|속상|sad|cried|\bcry|depress|upset|难过|伤心|悲伤|哭|低落|失落|心痛|郁闷/i },
    anxious:   { zh: "焦虑", ko: "불안", en: "Anxious",
      words: /불안|걱정|긴장|초조|스트레스|두려|anxious|anxiety|worr|stress|nervous|afraid|焦虑|担心|紧张|压力|不安|害怕|慌/i },
    angry:     { zh: "愤怒", ko: "분노", en: "Angry",
      words: /화나|화가|짜증|분노|억울|열받|angry|annoy|furious|irritat|生气|愤怒|烦躁|烦死|讨厌|气死|恼火/i },
    hopeful:   { zh: "期待", ko: "희망", en: "Hopeful",
      words: /희망|기대|꿈|설레|바라|hope|dream|look forward|wish|希望|期待|梦想|憧憬/i },
    excited:   { zh: "激动", ko: "설렘", en: "Excited",
      words: /신나|신났|두근|흥분|짜릿|excit|thrill|激动|兴奋|刺激|心跳|热血/i },
    tired:     { zh: "疲惫", ko: "지침", en: "Tired",
      words: /지쳤|지침|피곤|지친|졸려|힘들|tired|exhaust|sleepy|worn out|疲惫|好累|很累|困了|疲倦|没精神/i },
    nostalgic: { zh: "思念", ko: "그리움", en: "Nostalgic",
      words: /그립|그리워|보고 싶|추억|옛날|\bmiss|nostalg|memories|想念|思念|怀念|回忆|想起/i },
    proud:     { zh: "充实", ko: "뿌듯함", en: "Fulfilled",
      words: /뿌듯|보람|해냈|성취|활기|proud|accomplish|achiev|productive|energ|充实|成就|满足|自豪|完成了|有活力/i }
  };
  const order = Object.keys(moods);
  // The mood line counts twice as much as the diary and thoughts.
  function detectMood(record) {
    if (!record) return null;
    const text = [record.mood, record.diary, record.thoughts].map(s => (s || "").replace(/\[[^\]]*\]/g, ""));
    if (!text.join("").trim()) return null;
    let best = null, bestScore = 0;
    for (const key of order) {
      const re = new RegExp(moods[key].words.source, "gi");
      const score = (text[0].match(re) || []).length * 2 + (text[1].match(re) || []).length + (text[2].match(re) || []).length;
      if (score > bestScore) { best = key; bestScore = score; }
    }
    return best || "calm";
  }
  window.MoodPaintings = { paintings, moods, detectMood };
})();
