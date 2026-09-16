// ScoreManager — tracks round-level scoring state
class ScoreManager {
  constructor(targetMrr) {
    this.targetMrr = targetMrr || CONFIG.TARGET_MRR;
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

  get isTargetReached() {
    return this.mrr >= this.targetMrr;
  }
}
