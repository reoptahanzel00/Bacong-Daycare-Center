export type ECCDRating = 'P' | 'O' | 'R' | null;
export type EvaluationType = 'baseline' | 'summative';

export interface ECCDItem {
  id: string;
  number: number;
  description: string;
}

export interface ECCDDomain {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  items: ECCDItem[];
}

export const ECCD_DOMAINS: ECCDDomain[] = [
  {
    id: 'gross_motor',
    label: 'Gross Motor Domain',
    shortLabel: 'Gross Motor',
    color: '#3B82F6',
    items: [
      { id: 'GM-01', number: 1, description: 'Climbs on chair or other elevated piece of furniture like a bed without help.' },
      { id: 'GM-02', number: 2, description: 'Walks backwards.' },
      { id: 'GM-03', number: 3, description: 'Runs without tripping or falling.' },
      { id: 'GM-04', number: 4, description: 'Walks down stairs, 2 feet on each step, with one held.' },
      { id: 'GM-05', number: 5, description: 'Walks upstairs holding handrail, 2 feet on each step.' },
      { id: 'GM-06', number: 6, description: 'Walks upstairs with alternate feet without holding handrail.' },
      { id: 'GM-07', number: 7, description: 'Walks downstairs with alternate feet without holding handrail.' },
      { id: 'GM-08', number: 8, description: 'Moves body parts as directed.' },
      { id: 'GM-09', number: 9, description: 'Jumps up.' },
      { id: 'GM-10', number: 10, description: 'Throws ball overhead with direction.' },
      { id: 'GM-11', number: 11, description: 'Hops 1-3 steps on preferred foot.' },
      { id: 'GM-12', number: 12, description: 'Jump and turn.' },
      { id: 'GM-13', number: 13, description: 'Dances patterns/joins group movement activities.' },
    ]
  },
  {
    id: 'fine_motor',
    label: 'Fine Motor Domain',
    shortLabel: 'Fine Motor',
    color: '#8B5CF6',
    items: [
      { id: 'FM-01', number: 1, description: 'Uses 5 fingers to get food/toys placed on flat surface.' },
      { id: 'FM-02', number: 2, description: 'Picks up objects with thumb and index finger.' },
      { id: 'FM-03', number: 3, description: 'Displays a definite hand preference.' },
      { id: 'FM-04', number: 4, description: 'Puts small objects in/out of containers.' },
      { id: 'FM-05', number: 5, description: 'Holds crayon with all the fingers of his hand making a fist (palmar grasp).' },
      { id: 'FM-06', number: 6, description: 'Unscrews lid of container or unwraps food.' },
      { id: 'FM-07', number: 7, description: 'Scribbles spontaneously.' },
      { id: 'FM-08', number: 8, description: 'Scribbles vertical and horizontal lines.' },
      { id: 'FM-09', number: 9, description: 'Draws circle purposely.' },
      { id: 'FM-10', number: 10, description: 'Draws a human figure (head, eyes, trunk, arms, hands/fingers).' },
      { id: 'FM-11', number: 11, description: 'Draws a house using geometric forms.' },
    ]
  },
  {
    id: 'self_help',
    label: 'Self-Help Domain',
    shortLabel: 'Self-Help',
    color: '#F59E0B',
    items: [
      { id: 'SH-01', number: 1, description: 'Feeds self with finger food using fingers.' },
      { id: 'SH-02', number: 2, description: 'Feeds self using spoon with spillage.' },
      { id: 'SH-03', number: 3, description: 'Feeds self using spoon without spillage.' },
      { id: 'SH-04', number: 4, description: 'Eats without need for spoonfeeding during any meal.' },
      { id: 'SH-05', number: 5, description: 'Helps hold cup for drinking.' },
      { id: 'SH-06', number: 6, description: 'Drinks from cup unassisted.' },
      { id: 'SH-07', number: 7, description: 'Gets drink for self unassisted.' },
      { id: 'SH-08', number: 8, description: 'Pours from pitcher without spillage.' },
      { id: 'SH-09', number: 9, description: 'Participates when being dressed (raises arms/lifts legs).' },
      { id: 'SH-10', number: 10, description: 'Pulls down gartered short pants.' },
      { id: 'SH-11', number: 11, description: 'Removes sando/shirt.' },
      { id: 'SH-12', number: 12, description: 'Dresses without assistance except for buttons and tying.' },
      { id: 'SH-13', number: 13, description: 'Dresses without assistance including buttons and tying.' },
      { id: 'SH-14', number: 14, description: 'Informs adult of need to urinate or move bowels.' },
      { id: 'SH-15', number: 15, description: 'Goes to comfort room to urinate or move bowels unassisted.' },
      { id: 'SH-16', number: 16, description: 'Wipes/cleans self after bowel movement.' },
      { id: 'SH-17', number: 17, description: 'Participates when bathing (rubbing with soap).' },
      { id: 'SH-18', number: 18, description: 'Washes and dries hands without any help.' },
      { id: 'SH-19', number: 19, description: 'Washes face without any help.' },
      { id: 'SH-20', number: 20, description: 'Bathes without any help.' },
    ]
  },
  {
    id: 'receptive_language',
    label: 'Receptive Language Domain',
    shortLabel: 'Receptive Lang.',
    color: '#10B981',
    items: [
      { id: 'RL-01', number: 1, description: 'Points to family members when asked to do so.' },
      { id: 'RL-02', number: 2, description: 'Points to 5 body parts on himself when asked.' },
      { id: 'RL-03', number: 3, description: 'Points to 5 named pictured objects when asked.' },
      { id: 'RL-04', number: 4, description: 'Follows one-step instructions including prepositions (in, on, under).' },
      { id: 'RL-05', number: 5, description: 'Follows 2-step instructions that include simple prepositions.' },
    ]
  },
  {
    id: 'expressive_language',
    label: 'Expressive Language Domain',
    shortLabel: 'Expressive Lang.',
    color: '#06B6D4',
    items: [
      { id: 'EL-01', number: 1, description: 'Uses 5-20 recognizable words.' },
      { id: 'EL-02', number: 2, description: 'Uses pronouns (I, me, ako, akin).' },
      { id: 'EL-03', number: 3, description: 'Uses 2-3 word verb-noun combinations (e.g. hingi gatas).' },
      { id: 'EL-04', number: 4, description: 'Names objects in pictures.' },
      { id: 'EL-05', number: 5, description: 'Speaks in grammatically correct 2-3 word sentences.' },
      { id: 'EL-06', number: 6, description: 'Asks "what" questions.' },
      { id: 'EL-07', number: 7, description: 'Asks "who" questions.' },
      { id: 'EL-08', number: 8, description: 'Gives account of recent experiences in order of occurrence using past tense.' },
    ]
  },
  {
    id: 'cognitive',
    label: 'Cognitive Domain',
    shortLabel: 'Cognitive',
    color: '#EF4444',
    items: [
      { id: 'COG-01', number: 1, description: 'Looks in direction of fallen object.' },
      { id: 'COG-02', number: 2, description: 'Looks for completely hidden object.' },
      { id: 'COG-03', number: 3, description: 'Exhibits simple pretend play (feed doll, put to sleep).' },
      { id: 'COG-04', number: 4, description: 'Matches objects.' },
      { id: 'COG-05', number: 5, description: 'Matches 2-3 colors.' },
      { id: 'COG-06', number: 6, description: 'Matches pictures.' },
      { id: 'COG-07', number: 7, description: 'Sorts based on shapes.' },
      { id: 'COG-08', number: 8, description: 'Sorts objects based on 2 attributes (size and color).' },
      { id: 'COG-09', number: 9, description: 'Arranges objects according to size from smallest to biggest.' },
      { id: 'COG-10', number: 10, description: 'Names 4-6 colors.' },
      { id: 'COG-11', number: 11, description: 'Copies shapes.' },
      { id: 'COG-12', number: 12, description: 'Names 3 animals or vegetables when asked.' },
      { id: 'COG-13', number: 13, description: 'States what common household items are used for.' },
      { id: 'COG-14', number: 14, description: 'Can assemble simple puzzles.' },
      { id: 'COG-15', number: 15, description: 'Demonstrates understanding of opposites (malaki vs maliit).' },
      { id: 'COG-16', number: 16, description: 'Points to left and right side of the body.' },
      { id: 'COG-17', number: 17, description: 'States what is silly or wrong with pictures.' },
      { id: 'COG-18', number: 18, description: 'Matches upper and lower case letters.' },
    ]
  },
  {
    id: 'socio_emotional',
    label: 'Socio-Emotional Domain',
    shortLabel: 'Socio-Emotional',
    color: '#EC4899',
    items: [
      { id: 'SE-01', number: 1, description: 'Enjoys watching activities of nearby people or animals.' },
      { id: 'SE-02', number: 2, description: 'Friendly with strangers but initially may show slight anxiety.' },
      { id: 'SE-03', number: 3, description: 'Plays alone but likes to be near familiar adults or siblings.' },
      { id: 'SE-04', number: 4, description: 'Laughs or squeals aloud in play.' },
      { id: 'SE-05', number: 5, description: 'Demonstrates respect for elders using terms like "po" and "opo".' },
      { id: 'SE-06', number: 6, description: 'Shares toys with others.' },
      { id: 'SE-07', number: 7, description: 'Imitates adult activities (cooking, washing).' },
      { id: 'SE-08', number: 8, description: 'Identifies feelings in others.' },
      { id: 'SE-09', number: 9, description: 'Appropriately uses cultural greetings (mano, bless, kiss).' },
      { id: 'SE-10', number: 10, description: 'Comforts playmates/siblings in distress.' },
      { id: 'SE-11', number: 11, description: 'Helps with family chores (wiping tables, watering plants).' },
      { id: 'SE-12', number: 12, description: 'Waits for turn.' },
      { id: 'SE-13', number: 13, description: 'Asks permission to play with toy being used by another.' },
      { id: 'SE-14', number: 14, description: 'Plays organized group games fairly.' },
      { id: 'SE-15', number: 15, description: 'Can talk about difficult feelings (anger, sadness, worry).' },
      { id: 'SE-16', number: 16, description: 'Cooperates with adults and peers in group situations.' },
    ]
  }
];
