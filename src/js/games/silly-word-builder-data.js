window.sillyWordBuilderData = {
  unlockThresholds: {
    2: 6,
    3: 16,
    4: 24
  },
  badges: [
    { id: 'spark-star', label: 'Spark Star', icon: '⭐', unlockStreak: 3, description: 'Reach a 3-word streak.' },
    { id: 'giggle-bug', label: 'Giggle Bug', icon: '🐞', unlockStreak: 5, description: 'Reach a 5-word streak.' },
    { id: 'reading-rocket', label: 'Reading Rocket', icon: '🚀', unlockStreak: 8, description: 'Reach an 8-word streak.' }
  ],
  skillBands: [
    {
      id: 1,
      label: 'Starter Sounds',
      shortLabel: 'Band 1',
      description: 'VC, CV, and very simple word building.',
      grownupNote: 'This band focuses on blending and reading very simple VC and CV patterns before broader CVC practice.',
      graphemes: {
        first: ['a', 'i', 'u', 'g', 'n', 'm', 'h', 'p'],
        last: ['t', 'm', 'n', 'p', 'o'],
        middle: ['a', 'i', 'u', 'o']
      },
      entries: [
        { word: 'at', pattern: 'VC', vowel: 'a', segments: ['a', 't'], emoji: '👉', modes: ['first', 'last'] },
        { word: 'am', pattern: 'VC', vowel: 'a', segments: ['a', 'm'], emoji: '🙂', modes: ['first', 'last'] },
        { word: 'in', pattern: 'VC', vowel: 'i', segments: ['i', 'n'], emoji: '📥', modes: ['first', 'last'] },
        { word: 'it', pattern: 'VC', vowel: 'i', segments: ['i', 't'], emoji: '🎁', modes: ['first', 'last'] },
        { word: 'up', pattern: 'VC', vowel: 'u', segments: ['u', 'p'], emoji: '⬆️', modes: ['first', 'last'] },
        { word: 'go', pattern: 'CV', vowel: 'o', segments: ['g', 'o'], emoji: '🏃', modes: ['first', 'last'] },
        { word: 'no', pattern: 'CV', vowel: 'o', segments: ['n', 'o'], emoji: '🙅', modes: ['first', 'last'] }
      ]
    },
    {
      id: 2,
      label: 'Short-Vowel Words',
      shortLabel: 'Band 2',
      description: 'Simple CVC words with short vowels.',
      grownupNote: 'This band focuses on basic CVC decoding and listening for beginning, middle, and ending sounds.',
      graphemes: {
        first: ['c', 'd', 'p', 's', 'm', 'b', 'f', 'l', 'h', 'v'],
        middle: ['a', 'e', 'i', 'o', 'u'],
        last: ['t', 'g', 'p', 'n', 'd', 'g', 'm', 'b', 'f', 'k']
      },
      entries: [
        { word: 'cat', pattern: 'CVC', vowel: 'a', segments: ['c', 'a', 't'], emoji: '🐱', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'dog', pattern: 'CVC', vowel: 'o', segments: ['d', 'o', 'g'], emoji: '🐶', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'pig', pattern: 'CVC', vowel: 'i', segments: ['p', 'i', 'g'], emoji: '🐷', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'sun', pattern: 'CVC', vowel: 'u', segments: ['s', 'u', 'n'], emoji: '☀️', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'map', pattern: 'CVC', vowel: 'a', segments: ['m', 'a', 'p'], emoji: '🗺️', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'bed', pattern: 'CVC', vowel: 'e', segments: ['b', 'e', 'd'], emoji: '🛏️', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'fin', pattern: 'CVC', vowel: 'i', segments: ['f', 'i', 'n'], emoji: '🦈', modes: ['first', 'middle', 'last'] },
        { word: 'log', pattern: 'CVC', vowel: 'o', segments: ['l', 'o', 'g'], emoji: '🪵', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'cup', pattern: 'CVC', vowel: 'u', segments: ['c', 'u', 'p'], emoji: '🥤', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'hat', pattern: 'CVC', vowel: 'a', segments: ['h', 'a', 't'], emoji: '🧢', modes: ['first', 'middle', 'last', 'picture'] }
      ]
    },
    {
      id: 3,
      label: 'Sound Teams',
      shortLabel: 'Band 3',
      description: 'Early digraph practice after CVC success.',
      grownupNote: 'This band introduces a small set of beginning and ending digraphs after core short-vowel decoding is established.',
      graphemes: {
        first: ['sh', 'ch', 'f', 'm'],
        middle: ['i', 'a', 'u', 'o'],
        last: ['p', 't', 'sh', 'ch']
      },
      entries: [
        { word: 'ship', pattern: 'digraph', vowel: 'i', segments: ['sh', 'i', 'p'], emoji: '🚢', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'chat', pattern: 'digraph', vowel: 'a', segments: ['ch', 'a', 't'], emoji: '💬', modes: ['first', 'middle', 'last'] },
        { word: 'shop', pattern: 'digraph', vowel: 'o', segments: ['sh', 'o', 'p'], emoji: '🛍️', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'fish', pattern: 'digraph', vowel: 'i', segments: ['f', 'i', 'sh'], emoji: '🐟', modes: ['first', 'middle', 'last', 'picture'] },
        { word: 'chin', pattern: 'digraph', vowel: 'i', segments: ['ch', 'i', 'n'], emoji: '🙂', modes: ['first', 'middle', 'last'] },
        { word: 'much', pattern: 'digraph', vowel: 'u', segments: ['m', 'u', 'ch'], emoji: '📦', modes: ['first', 'middle', 'last'] }
      ]
    },
    {
      id: 4,
      label: 'Snap Words',
      shortLabel: 'Band 4',
      description: 'A small set of early high-frequency words.',
      grownupNote: 'This band keeps high-frequency words separate from the decodable sets so they can be reviewed on purpose.',
      graphemes: {
        first: ['th', 's', 'l', 'm', 'i'],
        middle: ['e', 'i', 'y'],
        last: ['e', 's', 'my']
      },
      entries: [
        { word: 'the', pattern: 'high_frequency', vowel: 'e', segments: ['th', 'e'], emoji: null, modes: ['first', 'last'] },
        { word: 'see', pattern: 'high_frequency', vowel: 'ee', segments: ['s', 'ee'], emoji: null, modes: ['first', 'last'] },
        { word: 'like', pattern: 'high_frequency', vowel: 'i_e', segments: ['l', 'i', 'ke'], emoji: null, modes: ['first', 'middle', 'last'] },
        { word: 'is', pattern: 'high_frequency', vowel: 'i', segments: ['i', 's'], emoji: null, modes: ['first', 'last'] },
        { word: 'my', pattern: 'high_frequency', vowel: 'y', segments: ['m', 'y'], emoji: null, modes: ['first', 'last'] }
      ]
    }
  ]
};
