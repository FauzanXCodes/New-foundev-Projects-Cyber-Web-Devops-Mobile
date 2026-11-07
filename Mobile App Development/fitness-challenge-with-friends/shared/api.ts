// The JSON shapes the API returns. Screens render these directly; the server does the math.
import type { Activity, Band, ChallengeType, Per, Result, TrackType } from './catalog.ts';

/** A badge someone is wearing because of how a challenge ended: a reward for winning it, a forfeit for coming last. */
export type Flair = { emoji: string; kind: 'reward' | 'forfeit' };

export type Person = { id: string; name: string; avatar: number; flair?: Flair | null };

/** Your own badge, with where it came from and when it comes off. */
export type FlairDetail = Flair & { title: string; challengeName: string; until: string };

/** What a challenge puts on the line inside the app. */
export type Stakes = {
  reward: { emoji: string; title: string; days: number };
  forfeit: { emoji: string; title: string; days: number };
  /** No opponents: it comes down to whether you reach the goal. */
  solo: boolean;
};

/** A medal for something done across challenges, earned or still to earn. */
export type Achievement = {
  id: string; emoji: string; title: string; text: string;
  earned: boolean;
  /** The rare ones are struck in gold. */
  gold: boolean;
  /** 0 to 1 toward earning it. */
  progress: number;
  progressText: string;
};

/** A last name a challenge winner gave someone, while it lasts. */
export type NameChange = { lastName: string; by: string; challengeName: string; until: string };

export type Me = Person & {
  /** Set while a winner's chosen last name is in effect. `name` is then the changed one. */
  nameChange: NameChange | null;
  /** The badge you are wearing right now, if any. */
  flairDetail: FlairDetail | null;
  workoutTime: string;
  trackedTypes: TrackType[];
  notifications: boolean;
  band: Band;
  /** Digits only, no formatting. Null until they add one. */
  phone: string | null;
  hasPin: boolean;
};

export type SignupResult = { token: string; user: Me; challengeId: string | null };

export type ChallengeCard = {
  id: string;
  name: string;
  type: ChallengeType;
  /** You started this one, so it is yours to delete. */
  mine: boolean;
  targetShort: string;
  progressText: string;
  fraction: number;
  periodDone: boolean;
  complete: boolean;
  members: Person[];
  memberCount: number;
  daysLeftText: string;
  waiting: boolean;
  live: boolean;
  /** The friend who put you in this one, when you did not join it yourself. */
  addedBy?: string;
};

/** A challenge someone in your crew is in, that you could join too. */
export type Suggestion = { id: string; name: string; type: ChallengeType; targetText: string; friends: Person[]; memberCount: number };

export type HomeData = {
  user: Me;
  crew: (Person & { loggedToday: boolean })[];
  challenges: ChallengeCard[];
  suggested: Suggestion[];
};

/** One line of talk in a challenge. */
export type TalkLine = Person & { lineId: string; text: string; mine: boolean; when: string };

/** Your own days in a challenge, one bar each, and what they add up to. */
export type Timeline = {
  unit: string;
  /** What a day needs to be to stay on pace, when that is a meaningful number. */
  pace: number | null;
  days: { date: string; label: string; amount: number; today: boolean; future: boolean }[];
  trend: 'up' | 'down' | 'flat' | null;
  trendText: string | null;
  bestText: string | null;
  goalText: string;
};

/** One logged workout, with whatever extra detail its owner chose to add. */
export type Exercise = { name: string; sets: number | null; reps: number | null; weight: number | null };
export type Workout = {
  /** The check-in it belongs to. */
  id: string;
  date: string;
  dateText: string;
  activity: Activity;
  activityLabel: string;
  /** The specific workout, when one was picked: "Trail run", its emoji and "3.2 mi". */
  kind: string | null;
  kindEmoji: string | null;
  metricText: string | null;
  minutes: number | null;
  note: string;
  exercises: Exercise[];
  /** Shared workouts are visible to your crew. Private is the default. */
  shared: boolean;
  /** Names of the challenges it counted toward. */
  countedToward: string[];
};

/** A medal earned by a finished challenge: gold for winning it, goal for reaching your own goal. */
export type Medal = 'gold' | 'goal';

export type FriendData = Person & { completed: number; biggestWin: string | null; recent: Workout[] };

export type Standing = Person & {
  /** Something true and specific about how this person is going, changing as the challenge does. */
  fact?: string | null;
  rank: number;
  fraction: number;
  percent: number;
  /** "7 of 12" — credit against this person's own goal. */
  label: string;
  /** "8,000 steps a day", only when fair play is on. */
  goalText: string | null;
  /** Rank movement over the last week: "+2", "-1" or null for no change. */
  delta: string | null;
  isYou: boolean;
  onTheHook: boolean;
  complete: boolean;
};

/** The three numbers at the top of a challenge: where you stand, in one glance. */
export type HeroStats = { rank: string; progress: string; people: string };

export type ConsequenceView = {
  status: 'none' | 'proposed' | 'agreed';
  text: string | null;
  proposedBy: string | null;
  youProposed: boolean;
  youAgreed: boolean;
  waitingOn: number;
};

/** The last name punishment, once the challenge is over and its consequence is the rename one. */
export type RenameView = {
  /** You won and someone here still needs a new last name. */
  canSet: boolean;
  targets: {
    id: string;
    /** Their own name, before any change. */
    name: string;
    isYou: boolean;
    /** pending: still the winner's to pick. active: they carry it now. over: it ran its course. */
    status: 'pending' | 'active' | 'over';
    /** The full name they carry now, while active. */
    newName: string | null;
    setBy: string | null;
    until: string | null;
  }[];
};

export type ChallengeDetail = {
  id: string;
  name: string;
  targetText: string;
  type: ChallengeType;
  target: number;
  per: Per;
  lengthDays: number;
  numeric: boolean;
  house: boolean;
  status: 'waiting' | 'live' | 'done';
  daysLeftText: string;
  timeFraction: number;
  rangeText: string;
  consequence: ConsequenceView | null;
  stakes: Stakes;
  rename: RenameView | null;
  hero: HeroStats;
  /** Ranked on percent of each person's own goal. */
  fair: boolean;
  yourGoalText: string | null;
  winnerName: string | null;
  resultText: string | null;
  standings: Standing[];
  members: Person[];
  alerts: string[];
  you: {
    member: boolean; commissioner: boolean; readOnly: boolean; result: Result | null;
    /** A session challenge takes one log a day; this is whether today's is in. Always false for steps and miles. */
    loggedToday: boolean;
    /** Set once the challenge is over, if you earned one. */
    medal: Medal | null;
  };
  manage: (Person & { pending: boolean })[];
  talk: TalkLine[];
  timeline: Timeline | null;
  /** Whether the crews of people in it can see and join it. */
  shared: boolean;
  /** People in your crew who are not in this challenge yet, when you are in it and it is still running. */
  addable: Person[];
};

export type CheckinChallenge = {
  id: string;
  name: string;
  type: ChallengeType;
  numeric: boolean;
  unitMany: string;
  loggedToday: boolean;
  progressText: string;
};

export type WorkoutOption = { key: string; label: string; emoji: string; activity: Activity; unit: string; ask: string; whole: boolean; max: number };
export type CheckinData = { checkedIn: boolean; streak: number; challenges: CheckinChallenge[]; workouts: WorkoutOption[] };

export type CheckinResult = { cards: ChallengeCard[]; previous: Record<string, number>; line: string; checkinId: string };

export type TrackedCard = {
  type: TrackType;
  label: string;
  totalText: string;
  days: (number | null)[];
  todayIndex: number;
};

export type PastRow = { id: string; name: string; type: ChallengeType; rangeText: string; result: 'Won' | 'Finished' | 'Dropped'; medal: Medal | null };

export type MeData = {
  user: Me;
  achievements: Achievement[];
  streak: number;
  longestStreak: number;
  completed: number;
  won: number;
  tracked: TrackedCard[];
  past: PastRow[];
};

export type HouseCard = { id: string; name: string; type: ChallengeType; targetText: string; memberCount: number; joined: boolean; stakes: Stakes };

export type InvitePreview = {
  token: string;
  inviterName: string;
  challenge: ChallengeDetail | null;
  alreadyMember: boolean;
  ended: boolean;
};
