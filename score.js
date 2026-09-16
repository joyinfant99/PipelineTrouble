// ScoreManager — tracks round-level scoring state
class ScoreManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.mrr = 0;
    this.blockersRemoved = 0;
    this.dealsReaccelerated = 0;
    this.pipelinePenalty = 0;
  }

  addMrr(amount, playerIndex, players) {
    this.mrr += amount;
    if (players && players[playerIndex]) {
      players[playerIndex].mrrContribution += amount;
    }
  }

  addBlockerRemoved(playerIndex, players) {
    this.blockersRemoved++;
    if (players && players[playerIndex]) {
      players[playerIndex].blockersHit++;
    }
  }

  addDealReaccelerated() {
    this.dealsReaccelerated++;
  }

  applyPenalty(amount) {
    this.pipelinePenalty += amount;
  }

  // net MRR — what's actually shown as "TOTAL MRR" everywhere (HUD, scorecard,
  // highscores). The win condition below used to check raw `mrr` while every
  // display showed this net figure, so a team could see the target hit on
  // screen without the round actually ending, or vice versa.
  get netMrr() {
    return Math.max(0, this.mrr - this.pipelinePenalty);
  }

  get isTargetReached() {
    return this.netMrr >= CONFIG.TARGET_MRR;
  }
}
