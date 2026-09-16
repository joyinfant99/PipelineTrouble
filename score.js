// ScoreManager — tracks round-level scoring state.
//
// Everything that scores is attributed to the player who earned it, and every
// penalty is charged to the player who took it. That is what keeps TOTAL SCORE on
// the scorecard equal to the sum of the per-player contributions below it plus the
// team bonuses — the two used to be derived from different numbers and disagreed.
class ScoreManager {
  constructor(targetScore) {
    this.targetScore = targetScore || CONFIG.DIFFICULTY_PRESETS.normal.targetScore;
    this.reset();
  }

  reset() {
    this.blockerPoints = 0;
    this.dealPoints = 0;
    this.bonusPoints = 0;
    this.penalty = 0;
    this.blockersRemoved = 0;
    this.dealsReaccelerated = 0;
  }

  _credit(amount, playerIndex, players) {
    if (players && players[playerIndex]) players[playerIndex].contribution += amount;
  }

  // every blocker popped scores, so a round spent only breaking blockers
  // still puts points on the board
  addBlockerRemoved(tier, playerIndex, players) {
    const weights = CONFIG.SCORE_WEIGHTS.blockerByTier;
    const points = weights[tier] || weights[weights.length - 1];
    this.blockerPoints += points;
    this.blockersRemoved++;
    if (players && players[playerIndex]) players[playerIndex].blockersHit++;
    this._credit(points, playerIndex, players);
    return points;
  }

  addDealReaccelerated(playerIndex, players) {
    const points = CONFIG.SCORE_WEIGHTS.dealCleared;
    this.dealPoints += points;
    this.dealsReaccelerated++;
    this._credit(points, playerIndex, players);
    return points;
  }

  addBonus(amount, playerIndex, players) {
    this.bonusPoints += amount;
    this._credit(amount, playerIndex, players);
    return amount;
  }

  applyPenalty(amount, playerIndex, players) {
    this.penalty += amount;
    this._credit(-amount, playerIndex, players);
  }

  // what the HUD shows and what the win condition checks — the same number, so the
  // target can no longer look reached on screen without the round actually ending
  get netScore() {
    return Math.max(0, this.blockerPoints + this.dealPoints + this.bonusPoints - this.penalty);
  }

  get isTargetReached() {
    return this.netScore >= this.targetScore;
  }
}
