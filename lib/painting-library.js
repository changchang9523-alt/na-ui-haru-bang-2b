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

  // v58: more works per mood so the same picture rarely repeats in one week.
  // Loaded from Wikimedia Commons thumbnails (960px);
  // if one can't load, the gallery falls back to the mood's main painting.
  const A = (artist, year, zh, ko, en, url) => ({ artist, year, title: { zh, ko, en }, remote: url });
  const alts = {
    happy: [A("Pierre-Auguste Renoir", "1881", "游艇上的午宴", "뱃놀이 일행의 점심", "Luncheon of the Boating Party", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg"),
            A("Georges Seurat", "1886", "大碗岛的星期天下午", "그랑드자트 섬의 일요일 오후", "A Sunday on La Grande Jatte", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg"),
            A("Claude Monet", "1873", "罂粟花田", "개양귀비 들판", "Poppy Field", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Claude_Monet_-_Poppy_Field_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Poppy_Field_-_Google_Art_Project.jpg")],
    warm: [A("Mary Cassatt", "1893", "孩子的沐浴", "아이의 목욕", "The Child's Bath", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Mary_Cassatt_-_The_Child's_Bath_-_Google_Art_Project.jpg/960px-Mary_Cassatt_-_The_Child's_Bath_-_Google_Art_Project.jpg"),
           A("Gustav Klimt", "1908", "吻", "키스", "The Kiss", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/960px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg"),
           A("Pierre-Auguste Renoir", "1892", "弹钢琴的少女", "피아노 치는 소녀들", "Girls at the Piano", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Pierre-Auguste_Renoir_-_Young_Girls_at_the_Piano_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Young_Girls_at_the_Piano_-_Google_Art_Project.jpg")],
    calm: [A("Claude Monet", "1869", "喜鹊", "까치", "The Magpie", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg/960px-Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg"),
           A("Johannes Vermeer", "1658", "小街", "작은 거리", "The Little Street", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Johannes_Vermeer_-_Het_straatje_-_Google_Art_Project.jpg/960px-Johannes_Vermeer_-_Het_straatje_-_Google_Art_Project.jpg"),
           A("Claude Monet", "1899", "睡莲与日本桥", "수련 연못과 일본식 다리", "Bridge over a Pond of Water Lilies", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Claude_Monet_-_Bridge_over_a_Pond_of_Water_Lilies.jpg/960px-Claude_Monet_-_Bridge_over_a_Pond_of_Water_Lilies.jpg")],
    lonely: [A("Caspar David Friedrich", "1810", "海边的僧侣", "해변의 수도승", "The Monk by the Sea", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Caspar_David_Friedrich_-_Der_M%C3%B6nch_am_Meer_-_Google_Art_Project.jpg/960px-Caspar_David_Friedrich_-_Der_M%C3%B6nch_am_Meer_-_Google_Art_Project.jpg"),
             A("Vilhelm Hammershøi", "1901", "阳光下的室内", "햇빛이 드는 실내", "Interior, Sunlight on the Floor", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Vilhelm_Hammersh%C3%B8i_-_Interior_in_Strandgade,_Sunlight_on_the_Floor_-_Google_Art_Project.jpg/960px-Vilhelm_Hammersh%C3%B8i_-_Interior_in_Strandgade,_Sunlight_on_the_Floor_-_Google_Art_Project.jpg"),
             A("Caspar David Friedrich", "1822", "窗边的女人", "창가의 여인", "Woman at a Window", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Caspar_David_Friedrich_-_Frau_am_Fenster_-_Google_Art_Project.jpg/960px-Caspar_David_Friedrich_-_Frau_am_Fenster_-_Google_Art_Project.jpg")],
    sad: [A("John Everett Millais", "1852", "奥菲莉亚", "오필리아", "Ophelia", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg/960px-John_Everett_Millais_-_Ophelia_-_Google_Art_Project.jpg"),
          A("Edvard Munch", "1885", "病孩", "병든 아이", "The Sick Child", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Edvard_Munch_-_The_Sick_Child_-_Google_Art_Project.jpg/960px-Edvard_Munch_-_The_Sick_Child_-_Google_Art_Project.jpg"),
          A("Vincent van Gogh", "1882", "悲伤", "슬픔", "Sorrowing Old Man", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Vincent_van_Gogh_-_Worn_Out.jpg/960px-Vincent_van_Gogh_-_Worn_Out.jpg")],
    anxious: [A("Henry Fuseli", "1781", "梦魇", "악몽", "The Nightmare", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/John_Henry_Fuseli_-_The_Nightmare.JPG/960px-John_Henry_Fuseli_-_The_Nightmare.JPG"),
              A("Edvard Munch", "1894", "焦虑", "불안", "Anxiety", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Edvard_Munch_-_Anxiety_-_Google_Art_Project.jpg/960px-Edvard_Munch_-_Anxiety_-_Google_Art_Project.jpg"),
              A("Arnold Böcklin", "1883", "死之岛", "죽음의 섬", "Isle of the Dead", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Arnold_B%C3%B6cklin_-_Isle_of_the_Dead,_Third_Version_-_Google_Art_Project.jpg/960px-Arnold_B%C3%B6cklin_-_Isle_of_the_Dead,_Third_Version_-_Google_Art_Project.jpg")],
    angry: [A("Théodore Géricault", "1819", "梅杜萨之筏", "메두사호의 뗏목", "The Raft of the Medusa", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/JEAN_LOUIS_TH%C3%89ODORE_G%C3%89RICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg/960px-JEAN_LOUIS_TH%C3%89ODORE_G%C3%89RICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg"),
            A("J. M. W. Turner", "1840", "奴隶船", "노예선", "The Slave Ship", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Slave-ship.jpg/960px-Slave-ship.jpg"),
            A("Eugène Delacroix", "1830", "自由引导人民", "민중을 이끄는 자유의 여신", "Liberty Leading the People", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg/960px-Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg")],
    hopeful: [A("Vincent van Gogh", "1890", "杏花", "꽃 피는 아몬드 나무", "Almond Blossoms", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Vincent_van_Gogh_-_Almond_blossom_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Almond_blossom_-_Google_Art_Project.jpg"),
              A("Claude Monet", "1873", "阿让特伊的帆船", "아르장퇴유의 요트", "Sailboats at Argenteuil", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Claude_Monet_-_Regatta_at_Argenteuil.jpg/960px-Claude_Monet_-_Regatta_at_Argenteuil.jpg"),
              A("Caspar David Friedrich", "1818", "吕根岛的白垩岩", "뤼겐섬의 백악 절벽", "Chalk Cliffs on Rügen", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Caspar_David_Friedrich_-_Kreidefelsen_auf_R%C3%BCgen.jpg/960px-Caspar_David_Friedrich_-_Kreidefelsen_auf_R%C3%BCgen.jpg")],
    excited: [A("Vincent van Gogh", "1888", "夜晚的咖啡馆露台", "밤의 카페 테라스", "Café Terrace at Night", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Van_Gogh_-_Terrasse_des_Caf%C3%A9s_an_der_Place_du_Forum_in_Arles_am_Abend1.jpeg/960px-Van_Gogh_-_Terrasse_des_Caf%C3%A9s_an_der_Place_du_Forum_in_Arles_am_Abend1.jpeg"),
              A("Wassily Kandinsky", "1913", "色彩习作：同心圆", "색채 연구: 동심원", "Squares with Concentric Circles", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Vassily_Kandinsky,_1913_-_Color_Study,_Squares_with_Concentric_Circles.jpg/960px-Vassily_Kandinsky,_1913_-_Color_Study,_Squares_with_Concentric_Circles.jpg"),
              A("J. M. W. Turner", "1844", "雨、蒸汽和速度", "비, 증기, 속도", "Rain, Steam and Speed", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Turner_-_Rain,_Steam_and_Speed_-_National_Gallery_file.jpg/960px-Turner_-_Rain,_Steam_and_Speed_-_National_Gallery_file.jpg")],
    tired: [A("Jean-François Millet", "1857", "拾穗者", "이삭 줍는 여인들", "The Gleaners", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg/960px-Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg"),
            A("Gustave Caillebotte", "1875", "刨地板的工人", "마루를 깎는 사람들", "The Floor Scrapers", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Gustave_Caillebotte_-_The_Floor_Scrapers_-_Google_Art_Project.jpg/960px-Gustave_Caillebotte_-_The_Floor_Scrapers_-_Google_Art_Project.jpg"),
            A("Jean-François Millet", "1859", "晚钟", "만종", "The Angelus", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/JEAN-FRAN%C3%87OIS_MILLET_-_El_%C3%81ngelus_(Museo_de_Orsay,_1857-1859._%C3%93leo_sobre_lienzo,_55.5_x_66_cm).jpg/960px-JEAN-FRAN%C3%87OIS_MILLET_-_El_%C3%81ngelus_(Museo_de_Orsay,_1857-1859._%C3%93leo_sobre_lienzo,_55.5_x_66_cm).jpg")],
    nostalgic: [A("Johannes Vermeer", "1665", "戴珍珠耳环的少女", "진주 귀걸이를 한 소녀", "Girl with a Pearl Earring", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/960px-1665_Girl_with_a_Pearl_Earring.jpg"),
                A("Johannes Vermeer", "1658", "倒牛奶的女仆", "우유 따르는 여인", "The Milkmaid", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg/960px-Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg")],
    proud: [A("Rembrandt", "1642", "夜巡", "야경", "The Night Watch", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/La_ronda_de_noche,_por_Rembrandt_van_Rijn.jpg/960px-La_ronda_de_noche,_por_Rembrandt_van_Rijn.jpg"),
            A("Vincent van Gogh", "1889", "有柏树的麦田", "사이프러스가 있는 밀밭", "Wheat Field with Cypresses", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Vincent_van_Gogh_-_Wheat_Field_with_Cypresses_(1889)_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Wheat_Field_with_Cypresses_(1889)_-_Google_Art_Project.jpg"),
            A("Claude Monet", "1872", "勒阿弗尔港", "르아브르 항구", "Boats Leaving the Harbour", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Claude_Monet_-_Boats_Leaving_the_Harbor_at_Le_Havre.jpg/960px-Claude_Monet_-_Boats_Leaving_the_Harbor_at_Le_Havre.jpg")]
  };
  for (const [k, list] of Object.entries(alts)) list.forEach((p, i) => { paintings[k + "#" + (i + 1)] = p; });
  const pool = k => [k, ...(alts[k] || []).map((_, i) => k + "#" + (i + 1))];
  // pick a work for a date: rotate by date, skip works already used this week
  function choose(mood, date, used) {
    const list = pool(mood); let h = 0; for (const c of String(date)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for (let i = 0; i < list.length; i++) { const id = list[(h + i) % list.length]; if (!used || !used.has(id)) return id; }
    return list[h % list.length];
  }
  const order = Object.keys(moods);
  // The mood line counts twice as much as the diary and thoughts.
  // v59: negations ("心情不是很好", "기분이 안 좋아", "not happy") count as a low
  // mood instead of the positive word inside them; busy days count as tired.
  // Works for Chinese, Korean, English and basic Japanese.
  const NEG_POS = [
    /(不|没|没有|並不|并不)(是|太|怎么|算|大)?(很|太|特别|那么|怎么)?(好|开心|快乐|高兴|顺利|顺心|舒服|愉快|幸福|放松|轻松|平静|美好|满意)/g,
    /(안\s*좋|좋지\s*(않|못|도\s*않)|안\s*행복|행복하지\s*(않|못)|즐겁지\s*(않|못)|안\s*즐거|편하지\s*(않|못)|기쁘지\s*(않|못)|안\s*괜찮|괜찮지\s*(않|못))/g,
    /\b(not|n't|never|hardly|wasn't|isn't|didn't|don't)\s+(feel(ing)?\s+)?(very\s+|so\s+|that\s+|really\s+|too\s+)?(good|great|happy|fine|okay|ok|well|calm|relaxed|nice|glad)\b/gi,
    /(良くない|よくない|楽しくない|嬉しくない|うれしくない|幸せじゃない)/g
  ];
  const LOW = /心情(很|太|有点|有些|特别)?(差|糟|不好|低落|烂)|糟糕|难受|郁闷|委屈|崩溃|心累|기분이?\s*(나쁘|나빴|별로|꿀꿀|최악|다운)|별로였|최악|속상|우울|bad day|\bbad\b|awful|terrible|horrible|down\b|miserable|最悪|落ち込|悲し|辛い|つらい/gi;
  const BUSY = /忙|累|加班|赶|바쁘|바빴|정신없|야근|busy|hectic|overwork|swamped|忙しい|疲れ/gi;
  const JA = { happy: /嬉し|うれし|楽し|幸せ/g, sad: /悲し|泣い|寂し/g, anxious: /不安|心配|緊張/g, angry: /怒|ムカつ|イライラ/g, tired: /疲れ|眠い/g, calm: /穏やか|落ち着/g };
  function detectMood(record) {
    if (!record) return null;
    let text = [record.mood, record.diary, record.thoughts].map(s => (s || "").replace(/\[[^\]]*\]/g, ""));
    if (!text.join("").trim()) return null;
    const score = {}; order.forEach(k => score[k] = 0);
    const add = (k, n) => { score[k] = (score[k] || 0) + n; };
    text = text.map((t, i) => {
      const w = i === 0 ? 2 : 1;
      for (const re of NEG_POS) t = t.replace(re, () => { add("sad", 3 * w); return " "; });
      (t.match(LOW) || []).forEach(() => add("sad", 2 * w));
      (t.match(BUSY) || []).forEach(() => add("tired", 1.5 * w));
      for (const [k, re] of Object.entries(JA)) (t.match(re) || []).forEach(() => add(k, w));
      return t;
    });
    for (const key of order) {
      const re = new RegExp(moods[key].words.source, "gi");
      score[key] += (text[0].match(re) || []).length * 2 + (text[1].match(re) || []).length + (text[2].match(re) || []).length;
    }
    // tired with a bad mood reads as sad; a bad mood always beats calm
    let best = null, bestScore = 0;
    for (const key of order) if (score[key] > bestScore) { best = key; bestScore = score[key]; }
    if (best === "tired" && score.sad >= score.tired * .8) best = "sad";
    return best || "calm";
  }
  window.MoodPaintings = { paintings, moods, detectMood, choose };
})();
