// NAura — MVVM ViewModel Layer
// Coordinamento azioni UI, logica di business e connessione WebSocket con l'agente Python
// + Privacy Pools v2 bridge integration via pp-bridge server

const PP_BRIDGE_URL = "http://localhost:3001";

class NAuraViewModel {
  constructor(model) {
    this.model = model;
    this.ws = null;
    this.wsConnected = false;
    this.onLogReceived = null; // Callback registrata dalla View per stampare i log a schermo
    this.onScanReveal = null;  // Callback registrata dalla View per avviare l'effetto di transizione satellite
    this.onArcTrigger = null;   // Callback registrata dalla View per visualizzare l'arco sul globo
    
    // Tenta di connettersi al WebSocket server Python locale
    this.connectWebSocket();
    
    // Tenta di connettersi al PP Bridge server
    this.checkPPBridgeStatus();
  }

  // ─── PP Bridge Connection ───────────────────────────────────────────────
  async checkPPBridgeStatus() {
    try {
      const resp = await fetch(`${PP_BRIDGE_URL}/api/pp/status`);
      if (resp.ok) {
        const data = await resp.json();
        this.model.state.ppBridgeConnected = true;
        this.model.state.ppMode = data.sdkAvailable ? "real" : "simulated";
        this.model.state.sepoliaBalance = data.donorSepoliaBalance || "0";
        this.model.state.escrowAddress = data.escrowAddress;
        this.model.state.bridgeBalanceEth = data.bridgeBalanceEth || "0";
        if (data.keysDerived) {
          this.model.state.keysDerived = true;
        }
        if (data.sessionActive) {
          this.model.state.ppSessionActive = true;
        }
        this.model.notify();
        this.logLocal("system", `Connected to PP Bridge (${data.sdkAvailable ? 'Real SDK' : 'Simulated'}). Sepolia balance: ${data.donorSepoliaBalance} ETH`, "system");
      }
    } catch (err) {
      this.model.state.ppBridgeConnected = false;
      this.model.state.ppMode = "simulated";
      this.model.notify();
      console.log("[VM] PP Bridge not available, using client-side simulation.");
    }
  }

  // Connessione al WebSocket Backend
  connectWebSocket() {
    this.ws = new WebSocket("ws://localhost:8000/events");

    this.ws.onopen = () => {
      this.wsConnected = true;
      this.logLocal("system", "Connected to local Agent Swarm WebSocket server.", "system");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketEvent(data);
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    this.ws.onclose = () => {
      this.wsConnected = false;
      this.logLocal("system", "WebSocket server disconnected. Falling back to simulated client-side mode.", "system");
      // Riconnessione dopo 5 secondi
      setTimeout(() => this.connectWebSocket(), 5000);
    };

    this.ws.onerror = () => {
      this.wsConnected = false;
    };
  }

  handleWebSocketEvent(data) {
    switch (data.type) {
      case "log":
        if (this.onLogReceived) {
          this.onLogReceived(data.tag, data.message, data.logType);
        }
        break;
      case "ndvi_update":
        this.model.updateProjectNdvi(data.projectId, data.ndvi);
        if (this.onScanReveal) {
          this.onScanReveal();
        }
        break;
      case "tx_release":
        this.model.adjustEscrowBalance(data.projectId, data.escrowDelta, data.releasedDelta);
        this.model.addTransaction({
          type: "SOL",
          hash: data.txHash,
          method: "Escrow Impact Release",
          amount: `${data.releasedDelta.toFixed(2)} SOL`,
          status: "Released",
          date: "Just now"
        });
        
        // Attiva l'arco sul globo per il progetto specifico
        if (this.onArcTrigger) {
          const activeProj = this.model.projects[data.projectId];
          this.onArcTrigger(activeProj);
        }
        break;
      case "scan_status":
        this.model.state.agentDebateStatus = data.status;
        this.model.notify();
        break;
    }
  }

  // Helper per scrivere log di fallback locali
  logLocal(tag, message, type) {
    if (this.onLogReceived) {
      this.onLogReceived(tag, message, type);
    }
  }

  // Comandi UI

  toggleWalletConnection() {
    if (this.model.state.walletConnected) {
      this.model.setWalletConnection(false);
    } else {
      this.model.setWalletConnection(true, "0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
      // Re-check PP bridge status when wallet connects
      this.checkPPBridgeStatus();
    }
  }

  selectProject(projectId) {
    this.model.setActiveProject(projectId);
  }

  // ─── Privacy Pools v2 — Real Integration ──────────────────────────────

  async deriveKeys() {
    if (this.onLogReceived) {
      this.onLogReceived("system", "Derivation requested...", "system");
    }

    if (this.model.state.ppBridgeConnected) {
      // Real PP Bridge call
      try {
        this.logLocal("system", "[PP Bridge] Signing EIP-712 derivation payload on Sepolia...", "system");
        
        const resp = await fetch(`${PP_BRIDGE_URL}/api/pp/derive-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: this.model.state.walletAddress }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Key derivation failed");
        }

        const keys = await resp.json();
        this.model.setDerivedKeys(keys);
        this.logLocal("system", `[PP Bridge] Protocol keys derived (${keys.mode}). Creating pool session...`, "system");

        // Auto-create session after key derivation
        const sessionResp = await fetch(`${PP_BRIDGE_URL}/api/pp/create-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          this.model.state.ppSessionActive = true;
          this.model.notify();
          this.logLocal("system", `[PP Bridge] Pool session active (${sessionData.mode}). Ready for deposits.`, "system");
        }
      } catch (err) {
        console.error("[VM] PP Bridge key derivation error:", err);
        this.logLocal("system", `[PP Bridge] Error: ${err.message}. Falling back to local simulation.`, "system");
        this._deriveKeysSimulated();
      }
    } else {
      // Fallback: client-side simulation
      this._deriveKeysSimulated();
    }
  }

  _deriveKeysSimulated() {
    setTimeout(() => {
      const derived = {
        identityNullifier: "0x6f913d8b5c928e1...4a2c",
        identitySecret: "0x9a832c3f1e948c2...1b7f",
        viewingKey: "0x04fb91e0a29f8d1c...3b8e",
        spendingKey: "0x3e1bc09a2df98c3...5a7b",
        revocableKeyIndex: "0x0",
        mode: "simulated"
      };
      this.model.setDerivedKeys(derived);
    }, 1500);
  }

  async executeDeposit(amount) {
    this.model.updateDepositStatus("submitting");

    if (this.model.state.ppBridgeConnected) {
      // Real PP Bridge deposit
      try {
        this.logLocal("system", `[PP Bridge] Submitting ${amount} ETH deposit to Privacy Pool (Sepolia)...`, "system");
        this.model.updateDepositStatus("attesting");

        const resp = await fetch(`${PP_BRIDGE_URL}/api/pp/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Deposit failed");
        }

        const data = await resp.json();
        this.model.updateDepositStatus("syncing");

        // Add note from response
        const note = data.note || {
          commitment: data.commitment,
          tokenId: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          value: parseFloat(amount),
          status: "ACTIVE",
        };
        this.model.addNote(note);

        // Add transaction record
        const txHash = data.txHash || ("0x" + Math.random().toString(16).substring(2, 14));
        this.model.addTransaction({
          type: "ETH",
          hash: txHash.slice(0, 10) + "..." + txHash.slice(-6),
          method: "Privacy Pool Deposit",
          amount: `${amount} ETH`,
          status: "Attested",
          date: "Just now",
        });

        this.model.updateDepositStatus("done");
        this.logLocal("system", `[PP Bridge] ✅ Deposit confirmed (${data.mode}). Commitment: ${(data.commitment || '').slice(0, 14)}...`, "system");

        // Refresh status
        this.checkPPBridgeStatus();
      } catch (err) {
        console.error("[VM] PP Bridge deposit error:", err);
        this.logLocal("system", `[PP Bridge] Deposit error: ${err.message}. Using simulated fallback.`, "system");
        this._executeDepositSimulated(amount);
      }
    } else {
      this._executeDepositSimulated(amount);
    }
  }

  _executeDepositSimulated(amount) {
    this.model.updateDepositStatus("submitting");
    setTimeout(() => {
      this.model.updateDepositStatus("attesting");
      setTimeout(() => {
        this.model.updateDepositStatus("syncing");
        setTimeout(() => {
          const mockCommitment = "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 8);
          const newNote = {
            commitment: mockCommitment,
            tokenId: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            value: parseFloat(amount),
            status: "ACTIVE"
          };
          this.model.addNote(newNote);
          this.model.updateDepositStatus("done");

          const txHash = "0x" + Math.random().toString(16).substring(2, 12) + "..." + Math.random().toString(16).substring(2, 8);
          this.model.addTransaction({
            type: "ETH",
            hash: txHash,
            method: "Privacy Pool Deposit",
            amount: `${amount} ETH`,
            status: "Attested",
            date: "Just now"
          });
        }, 1500);
      }, 1500);
    }, 1500);
  }

  async executePrivateTransfer(amount) {
    this.model.updateTransferStatus("preparing");

    if (this.model.state.ppBridgeConnected) {
      // Real PP Bridge transfer
      try {
        this.logLocal("system", `[PP Bridge] Preparing ZK private transfer of ${amount} ETH to escrow...`, "system");
        this.model.updateTransferStatus("relaying");

        const resp = await fetch(`${PP_BRIDGE_URL}/api/pp/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Transfer failed");
        }

        const data = await resp.json();

        // Spend the note locally
        this.model.spendNoteAmount(parseFloat(amount));

        // Update escrow balance (cross-chain bridge effect)
        this.model.adjustEscrowBalance(this.model.state.activeProjectId, parseFloat(amount), 0);

        // Record transaction
        const txHash = data.txHash || ("0x" + Math.random().toString(16).substring(2, 14));
        this.model.addTransaction({
          type: "ETH",
          hash: txHash.slice(0, 10) + "..." + txHash.slice(-6),
          method: "Private ZK Transfer",
          amount: `${amount} ETH`,
          status: "Relayed",
          date: "Just now",
        });

        this.model.updateTransferStatus("done");
        this.logLocal("system", `[PP Bridge] ✅ Private transfer relayed (${data.mode}). Tx: ${(data.txHash || '').slice(0, 14)}...`, "system");

        // Update bridge balance
        this.model.state.bridgeBalanceEth = data.bridgeBalanceEth || "0";
        this.model.notify();
      } catch (err) {
        console.error("[VM] PP Bridge transfer error:", err);
        this.logLocal("system", `[PP Bridge] Transfer error: ${err.message}. Using simulated fallback.`, "system");
        this._executePrivateTransferSimulated(amount);
      }
    } else {
      this._executePrivateTransferSimulated(amount);
    }
  }

  _executePrivateTransferSimulated(amount) {
    this.model.updateTransferStatus("preparing");
    setTimeout(() => {
      this.model.updateTransferStatus("relaying");
      setTimeout(() => {
        const txHash = "0x" + Math.random().toString(16).substring(2, 12) + "..." + Math.random().toString(16).substring(2, 8);
        this.model.spendNoteAmount(parseFloat(amount));
        
        // Aumenta il saldo escrow in Solana (derivato dall'anonimato ETH relayer)
        this.model.adjustEscrowBalance(this.model.state.activeProjectId, parseFloat(amount), 0);
        
        this.model.addTransaction({
          type: "ETH",
          hash: txHash,
          method: "Private ZK Transfer",
          amount: `${amount} ETH`,
          status: "Attested",
          date: "Just now"
        });

        this.model.updateTransferStatus("done");
      }, 2000);
    }, 2000);
  }

  // ─── Swarm Scan ───────────────────────────────────────────────────────

  runSwarmScan() {
    if (this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      // Invia comando al server di agenti Python reale
      this.ws.send(JSON.stringify({
        action: "run_scan",
        projectId: this.model.state.activeProjectId
      }));
    } else {
      // Modalità simulata client-side di fallback se il server backend non risponde
      this.runSwarmScanSimulated();
    }
  }

  runSwarmScanSimulated() {
    this.logLocal("system", "Initializing Proof-of-Impact Swarm Consensus Protocol (Simulated)", "system");
    
    const activeProj = this.model.projects[this.model.state.activeProjectId];
    const logTimeline = [
      { t: 1000, tag: "observer", msg: `[Observer Agent] Querying Copernicus STAC API for project coordinates (${activeProj.lat}, ${activeProj.lng})`, type: "observer" },
      { t: 2500, tag: "observer", msg: `[Observer Agent] Downloading Sentinel-2 tiles. Date t0: 2024-06-12 | Date t1: 2025-06-11`, type: "observer" },
      { t: 4000, tag: "observer", msg: `[Observer Agent] Computing NDVI matrices. NIR band 8, RED band 4...`, type: "observer" },
      { t: 5500, tag: "observer", msg: `[Observer Agent] Delta: +14.3%. Result: THRESHOLD MET. Claims submitted.`, type: "observer" },
      { t: 6000, triggerScanReveal: true },
      { t: 7500, tag: "auditor", msg: `[Auditor Agent] Reviewing claim. Checking cloud compositing masks (1.8% cloud contamination).`, type: "auditor" },
      { t: 9500, tag: "auditor", msg: `[Auditor Agent] Discrepancy checked. NDVI delta validated. Verdict APPROVED. Verdict Hash: 0x5a31...`, type: "auditor" },
      { t: 11000, tag: "treasurer", msg: `[Treasurer Agent] Auditor verdict verified. Building escrow release transaction.`, type: "treasurer" },
      { t: 12500, tag: "treasurer", msg: `[Treasurer Agent] Smart account PDA receiver validated: 8yTr...fG5w.`, type: "treasurer" },
      { t: 14500, tag: "treasurer", msg: `[Treasurer Agent] Escrow released. Tx Signature: 5uVq${Math.random().toString(36).substring(2, 8)}...`, type: "treasurer", triggerRelease: true },
      { t: 15500, tag: "system", msg: "Consensus Swarm execution completed successfully. Funds released.", type: "system" }
    ];

    logTimeline.forEach(step => {
      setTimeout(() => {
        if (step.msg) {
          this.logLocal(step.tag, step.msg, step.type);
        }
        if (step.triggerScanReveal && this.onScanReveal) {
          this.onScanReveal();
        }
        if (step.triggerRelease) {
          const targetDelta = activeProj.ndviTarget - activeProj.ndviBaseline;
          const finalNdvi = activeProj.ndviBaseline + targetDelta * 1.05;
          const releaseAmount = activeProj.escrowBalance * 0.4;

          this.model.updateProjectNdvi(activeProj.id, finalNdvi);
          this.model.adjustEscrowBalance(activeProj.id, -releaseAmount, releaseAmount);
          this.model.addTransaction({
            type: "SOL",
            hash: "5uVq" + Math.random().toString(36).substring(2, 10),
            method: "Escrow Impact Release",
            amount: `${releaseAmount.toFixed(2)} SOL`,
            status: "Released",
            date: "Just now"
          });

          if (this.onArcTrigger) {
            this.onArcTrigger(activeProj);
          }
        }
      }, step.t);
    });
  }
}
