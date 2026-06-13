// NAura — MVVM ViewModel Layer
// Coordinamento azioni UI, logica di business e connessione WebSocket con l'agente Python

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
    }
  }

  selectProject(projectId) {
    this.model.setActiveProject(projectId);
  }

  deriveKeys() {
    if (this.onLogReceived) {
      this.onLogReceived("system", "Derivation requested...", "system");
    }
    
    // Simula ritardo crittografico
    setTimeout(() => {
      const derived = {
        identityNullifier: "0x6f913d8b5c928e1...4a2c",
        identitySecret: "0x9a832c3f1e948c2...1b7f",
        viewingKey: "0x04fb91e0a29f8d1c...3b8e",
        spendingKey: "0x3e1bc09a2df98c3...5a7b",
        revocableKeyIndex: "0x0"
      };
      this.model.setDerivedKeys(derived);
    }, 1500);
  }

  executeDeposit(amount) {
    this.model.updateDepositStatus("submitting");
    
    // Logica di avanzamento locale per feedback utente immediato
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

  executePrivateTransfer(amount) {
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
