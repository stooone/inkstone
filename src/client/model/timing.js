import { PersistentVar } from '/client/model/persistence';
import { Lists } from '/client/model/lists';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';
import { assert, timestamp } from '/lib/base';
import { Tracker, ReactiveVar, Meteor } from '/src/store/meteor-mock';

const getTodayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

const timing = new PersistentVar('timing');

timing.update = (ts, update) => {
  const counts = timing.get();
  if (!counts || counts.ts !== ts) return false;
  timing.set(update(counts));
  return true;
}

const newCounts = (ts) => ({
  adds: 0,
  failures: 0,
  reviews: 0,
  min_cards: 0,
  ts: ts,
});

// Timing state tier 2: reactive variables
const maxes = new ReactiveVar();
const next_card = new ReactiveVar();
const remainder = new ReactiveVar();
const time_left = new ReactiveVar();

const tick = () => {
  const now = timestamp();
  const counts = timing.get();
  const todayMidnight = getTodayMidnight();
  const nextMidnight = todayMidnight + 86400;
  time_left.set(nextMidnight - now);

  // If persistent data hasn't loaded yet, don't reset — wait until
  // it's available to avoid overwriting saved counts with zeros.
  if (!counts) return;

  if (counts.ts < todayMidnight) {
    timing.set(newCounts(now));
  }
}

// Start the timer tick
setInterval(tick, 1000);
tick();

const buildErrorCard = (counts, extra) => {
  if (Object.keys(Lists.getEnabledLists()).length === 0) {
    const data = {
      error: 'You have no lists enabled!',
      options: [{link: 'lists', text: 'Enable a word list.'}],
    };
    return {data: data, deck: 'errors'};
  }
  const error = "You're done for the day!";
  const options = [{
    link: 'settings',
    text: 'Change scheduling settings',
  }];
  if (extra > 0) {
    const total = counts.adds + counts.reviews;
    options.unshift({
      extra: {min_cards: extra + total, ts: counts.ts},
      text: `Add ${extra} cards to today's deck`,
    });
  } else {
    options.push({
      link: 'lists',
      text: 'Enable another word list',
    });
  }
  return {data: {error: error, options: options}, deck: 'errors'};
}

const draw = (deck, ts) => {
  const data = getters[deck](ts).next();
  assert(data, `Drew from empty deck: ${deck}`);
  return {data: data, deck: deck, ts: ts};
}

const getters = {
  adds:     (ts) => Vocabulary.getNewItems(),
  extras:   (ts) => Vocabulary.getExtraItems(ts),
  failures: (ts) => {
    const todayMidnight = getTodayMidnight();
    return Vocabulary.getFailuresInRange(todayMidnight, todayMidnight + 86400);
  },
  reviews:  (ts) => Vocabulary.getItemsDueBy(ts, ts),
};

const mapDecks = (callback) => {
  const result = {};
  for (const deck in getters) {
    if (deck === 'extras') continue;
    result[deck] = callback(deck);
  }
  return result;
}

export const shuffle = () => {
  const counts = timing.get();
  const left = remainder.get();
  if (!counts || !left) return;

  if (left.adds + left.reviews > 0) {
    // New cards are only introduced after 80% of reviews are done,
    // so falling behind doesn't pile on even more new cards.
    const reviewsDone = counts.reviews;
    const reviewsTotal = reviewsDone + left.reviews;
    const reviewThreshold = 0.8 * reviewsTotal;
    const canAddNew = reviewsDone >= reviewThreshold || left.reviews === 0;

    if (canAddNew) {
      const index = Math.random() * (left.adds + left.reviews);
      const deck = index < left.adds ? 'adds' : 'reviews';
      next_card.set(draw(deck, counts.ts));
    } else {
      next_card.set(draw('reviews', counts.ts));
    }
  } else if (left.extras > 0) {
    const card = draw('extras', counts.ts);
    card.deck = card.data.attempts === 0 ? 'adds' : 'reviews';
    next_card.set(card);
  } else if (left.failures > 0) {
    next_card.set(draw('failures', counts.ts));
  } else {
    const max = maxes.get() ? maxes.get().adds : 0;
    const extra = Math.min(getters.extras(counts.ts).count(), max);
    next_card.set(buildErrorCard(counts, extra));
  }
}

// Reactive autoruns (wired to our reactive system)
Tracker.autorun(() => {
  const value = mapDecks((k) => Settings.get(`max_${k}`));
  value.failures = Settings.get('revisit_failures') ? Infinity : 0;
  maxes.set(value);
});

Tracker.autorun(() => {
  const counts = timing.get();
  if (!counts || !maxes.get()) return;
  const value = mapDecks((k) => {
    const limit = maxes.get()[k] - counts[k];
    if (limit <= 0) return 0;
    return Math.min(getters[k](counts.ts).count(), limit);
  });
  const planned = counts.adds + counts.reviews + value.adds + value.reviews;
  if (planned < counts.min_cards) {
    const needed = counts.min_cards - planned;
    value.extras = Math.min(getters.extras(counts.ts).count(), needed);
  } else {
    value.extras = 0;
  }
  remainder.set(value);
});

Tracker.autorun(shuffle);

// Timing state tier 3: card completion

const addExtraCards = (extra) => {
  const update = (x) => { x.min_cards = extra.min_cards; return x; };
  timing.update(extra.ts, update);
}

const completeCard = (card, result) => {
  const update = (x) => { x[card.deck] += 1; return x; };
  if (!timing.update(card.ts, update)) {
    console.error('Failed to update card:', card, 'with result:', result);
    return;
  }
  if (card.deck === 'failures') {
    Vocabulary.clearFailed(card.data);
  } else {
    Vocabulary.updateItem(card.data, result, timestamp());
  }
}

class Timing {
  static addExtraCards(extra) { addExtraCards(extra); }
  static completeCard(card, result) { completeCard(card, result); }
  static getNextCard() { return next_card.get(); }
  static getRemainder() { return remainder.get(); }
  static getTimeLeft() { return time_left.get(); }
  static shuffle() { shuffle(); }
}

export { Timing };
