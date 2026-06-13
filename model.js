// NAura — MVVM Model Layer
// Gestione dati, strutture dei progetti e stato applicativo globale

const PROJECTS_DATA = {
  "project-maremma": {
    id: "project-maremma",
    name: "Grid Segment 402 - Grosseto",
    location: "Grosseto, Tuscany, Italy",
    lat: 42.716,
    lng: 11.114,
    ndviBaseline: 0.38,
    ndviCurrent: 0.38,
    ndviTarget: 0.52,
    slopeAngle: 32,
    landslideRisk: 44.1, // (%)
    escrowBalance: 15.00,
    releasedAmount: 0.00,
    beforeImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_before_1781348838509.png",
    afterImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_after_1781348852593.png",
    description: "Monitoraggio piloni della Rete di Trasmissione Nazionale (RTN) esposti a elevato rischio di smottamento franoso dovuto alla pendenza. Il miglioramento della vegetazione riduce il rischio geologico sbloccando fondi di consolidamento."
  },
  "project-kenya": {
    id: "project-kenya",
    name: "Grid Segment 108 - Mau",
    location: "Rift Valley, Kenya",
    lat: -0.633,
    lng: 35.833,
    ndviBaseline: 0.42,
    ndviCurrent: 0.48,
    ndviTarget: 0.55,
    slopeAngle: 18,
    landslideRisk: 22.4,
    escrowBalance: 45.00,
    releasedAmount: 12.50,
    beforeImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_before_1781348838509.png",
    afterImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_after_1781348852593.png",
    description: "Monitoraggio della linea ad alta tensione in prossimità della foresta Mau. La perdita di vegetazione espone i tralicci a erosione e frane superficiali. Escrow finanziato da partner di progetto internazionali."
  },
  "project-amazon": {
    id: "project-amazon",
    name: "Grid Segment 315 - Xingu",
    location: "Mato Grosso, Brazil",
    lat: -11.524,
    lng: -53.189,
    ndviBaseline: 0.48,
    ndviCurrent: 0.51,
    ndviTarget: 0.60,
    slopeAngle: 25,
    landslideRisk: 29.8,
    escrowBalance: 120.00,
    releasedAmount: 40.00,
    beforeImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_before_1781348838509.png",
    afterImage: "file:///Users/matteocotena/.gemini/antigravity-ide/brain/7afd1e17-1ee1-4dc6-9e32-d09bc2680915/forest_after_1781348852593.png",
    description: "Monitoraggio della cabina di trasformazione primaria posizionata su scarpata fluviale soggetta a cedimento franoso strutturale. Gli agenti coordinano allarmi preventivi ed escrow rilasci."
  }
};

class NAuraModel {
  constructor() {
    this.projects = JSON.parse(JSON.stringify(PROJECTS_DATA)); // Deep clone
    this.state = {
      walletConnected: false,
      walletAddress: "",
      activeProjectId: "project-maremma",
      keysDerived: false,
      derivedKeys: null,
      depositStatus: "idle", 
      depositAmount: "0.01",
      notes: [],
      transferStatus: "idle", 
      transferAmount: "0.005",
      agentDebateStatus: "idle",
      totalEscrowLocked: 180.00,
      totalReleased: 52.50,
      // Privacy Pools v2 bridge state
      ppBridgeConnected: false,
      ppSessionActive: false,
      ppMode: "unknown", // "real", "simulated", or "unknown"
      sepoliaBalance: "0",
      escrowAddress: null,
      bridgeBalanceEth: "0",
      txList: [
        { type: "ETH", hash: "0x8fa1...3a9c", method: "Privacy Pool Deposit", amount: "0.10 ETH", status: "Attested", date: "10 mins ago" },
        { type: "SOL", hash: "8yTr...fG5w", method: "Escrow Release", amount: "12.50 SOL", status: "Released", date: "1 hour ago" },
        { type: "SOL", hash: "3sXp...kW9e", method: "Escrow Release", amount: "40.00 SOL", status: "Released", date: "3 hours ago" }
      ]
    };
    this.listeners = [];
  }

  // Pub/Sub per notificare il ViewModel / View di cambiamenti nello stato
  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(callback => callback(this.state, this.projects));
  }

  setWalletConnection(connected, address = "") {
    this.state.walletConnected = connected;
    this.state.walletAddress = address;
    this.notify();
  }

  setActiveProject(projectId) {
    this.state.activeProjectId = projectId;
    this.notify();
  }

  setDerivedKeys(keys) {
    this.state.derivedKeys = keys;
    this.state.keysDerived = !!keys;
    this.notify();
  }

  updateDepositStatus(status) {
    this.state.depositStatus = status;
    this.notify();
  }

  addNote(note) {
    this.state.notes.push(note);
    this.notify();
  }

  updateTransferStatus(status) {
    this.state.transferStatus = status;
    this.notify();
  }

  spendNoteAmount(amount) {
    if (this.state.notes.length > 0) {
      this.state.notes[0].value -= amount;
      if (this.state.notes[0].value <= 0) {
        this.state.notes[0].status = "SPENT";
      }
      this.notify();
    }
  }

  adjustEscrowBalance(projectId, escrowDelta, releasedDelta) {
    const proj = this.projects[projectId];
    if (proj) {
      proj.escrowBalance += escrowDelta;
      proj.releasedAmount += releasedDelta;
      this.state.totalEscrowLocked += escrowDelta;
      this.state.totalReleased += releasedDelta;
      this.notify();
    }
  }

  updateProjectNdvi(projectId, currentNdvi) {
    const proj = this.projects[projectId];
    if (proj) {
      proj.ndviCurrent = currentNdvi;
      this.notify();
    }
  }

  addTransaction(tx) {
    this.state.txList.unshift(tx);
    this.notify();
  }
}
