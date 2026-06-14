// NAura — MVVM View Layer
// Gestione DOM, rendering e binding eventi utente

class NAuraView {
  constructor(model, viewModel) {
    this.model = model;
    this.viewModel = viewModel;
    
    this.globeInstance = null;
    this.isSliding = false;

    // Elementi DOM cache
    this.connectWalletBtn = document.getElementById("connect-wallet-btn");
    this.walletStatusIndicator = document.getElementById("wallet-status-indicator");
    
    this.statEscrowLocked = document.getElementById("stat-escrow-locked");
    this.statTotalReleased = document.getElementById("stat-total-released");
    
    this.inspectorProjName = document.getElementById("inspector-project-name");
    this.inspectorProjLoc = document.getElementById("inspector-project-loc");
    this.inspectorProjDesc = document.getElementById("inspector-project-desc");
    this.inspectorNdviBaseline = document.getElementById("inspector-ndvi-baseline");
    this.inspectorNdviCurrent = document.getElementById("inspector-ndvi-current");
    this.inspectorNdviTarget = document.getElementById("inspector-ndvi-target");
    this.inspectorEscrowBalance = document.getElementById("inspector-escrow-balance");
    this.inspectorReleasedAmount = document.getElementById("inspector-released-amount");
    this.inspectorSlopeAngle = document.getElementById("inspector-slope-angle");
    this.inspectorLandslideRisk = document.getElementById("inspector-landslide-risk");
    
    this.ndviProgressBar = document.getElementById("ndvi-progress-bar");
    this.ndviProgressVal = document.getElementById("ndvi-progress-val");
    
    this.satelliteBeforeImg = document.querySelector(".satellite-image.before");
    this.satelliteAfterImg = document.querySelector(".satellite-image.after");
    
    this.sliderBar = document.getElementById("slider-bar");
    this.visualizer = document.getElementById("satellite-visualizer");
    
    this.txTableBody = document.getElementById("tx-table-body");
    this.consoleLogs = document.getElementById("console-logs");
    
    this.runSwarmBtn = document.getElementById("run-swarm-btn");
    
    // Privacy Pools Elements
    this.deriveKeysBtn = document.getElementById("derive-keys-btn");
    this.keysDerivationStatus = document.getElementById("keys-derivation-status");
    this.derivedKeysDetails = document.getElementById("derived-keys-details");
    
    this.depositBtn = document.getElementById("deposit-btn");
    this.inputDepositAmount = document.getElementById("input-deposit-amount");
    this.depositFlowStatus = document.getElementById("deposit-flow-status");
    
    this.transferBtn = document.getElementById("transfer-btn");
    this.inputTransferAmount = document.getElementById("input-transfer-amount");
    this.selectTransferNote = document.getElementById("select-transfer-note");
    this.transferFlowStatus = document.getElementById("transfer-flow-status");
    
    this.sigModalBackdrop = document.getElementById("sig-modal-backdrop");
    this.cancelSigBtn = document.getElementById("cancel-sig-btn");
    this.confirmSigBtn = document.getElementById("confirm-sig-btn");

    // Public Mode Elements
    this.togglePrivateMode = document.getElementById("toggle-private-mode");
    this.togglePublicMode = document.getElementById("toggle-public-mode");
    this.zkModeContent = document.getElementById("zk-mode-content");
    this.publicModeContent = document.getElementById("public-mode-content");
    this.publicDepositBtn = document.getElementById("public-deposit-btn");
    this.inputPublicAmount = document.getElementById("input-public-amount");
    this.publicFlowStatus = document.getElementById("public-flow-status");
    
    this.init();
  }

  init() {
    this.initGlobe();
    this.setupUIEvents();
    
    // Sottoscrizione alle modifiche del modello
    this.model.subscribe((state, projects) => this.render(state, projects));
    
    // Registrazione delle callback nel ViewModel
    this.viewModel.onLogReceived = (tag, message, type) => this.appendConsoleLog(tag, message, type);
    this.viewModel.onScanReveal = () => this.animateSatelliteReveal();
    this.viewModel.onArcTrigger = (proj) => this.triggerGlobeArc(proj);

    // Render iniziale
    this.render(this.model.state, this.model.projects);
  }

  initGlobe() {
    const container = document.getElementById("globe-canvas");
    const gData = Object.values(this.model.projects).map(proj => ({
      id: proj.id,
      lat: proj.lat,
      lng: proj.lng,
      size: 1.2,
      color: '#10b981',
      name: proj.name,
      released: proj.releasedAmount
    }));

    this.globeInstance = Globe()
      (container)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('')
      .backgroundColor('#060913')
      .pointsData(gData)
      .pointColor('color')
      .pointAltitude(0.06)
      .pointRadius(0.8)
      .pointsMerge(false)
      .pointLabel('name')
      .onPointClick(point => {
        this.viewModel.selectProject(point.id);
      });

    this.globeInstance.controls().enableZoom = true;
    this.globeInstance.controls().autoRotate = true;
    this.globeInstance.controls().autoRotateSpeed = 0.4;
    this.globeInstance.atmosphereColor('#10b981');
    this.globeInstance.atmosphereAltitude(0.12);

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.globeInstance.width(width);
      this.globeInstance.height(height);
    };
    window.addEventListener("resize", handleResize);
    setTimeout(handleResize, 100);
  }

  setupUIEvents() {
    // Wallet Connection click
    this.connectWalletBtn.addEventListener("click", () => this.viewModel.toggleWalletConnection());
    
    // Project clicks
    document.querySelectorAll(".project-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        this.viewModel.selectProject(id);
      });
    });

    // Sentinel Image Slider
    this.sliderBar.addEventListener("mousedown", () => this.isSliding = true);
    window.addEventListener("mouseup", () => this.isSliding = false);
    window.addEventListener("mousemove", (e) => {
      if (!this.isSliding) return;
      this.moveSlider(e.clientX);
    });

    // Touch support
    this.sliderBar.addEventListener("touchstart", () => this.isSliding = true);
    window.addEventListener("touchend", () => this.isSliding = false);
    window.addEventListener("touchmove", (e) => {
      if (!this.isSliding) return;
      this.moveSlider(e.touches[0].clientX);
    });

    // Tabs switching
    document.querySelectorAll(".widget-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        const tabId = e.currentTarget.getAttribute("data-tab");
        this.switchTabsUI(tabId);
      });
    });

    // Toggle Mode Event Listeners
    this.togglePrivateMode.addEventListener("click", () => {
      this.togglePrivateMode.classList.add("active");
      this.togglePrivateMode.style.background = "var(--color-blue)";
      this.togglePrivateMode.style.color = "#fff";
      
      this.togglePublicMode.classList.remove("active");
      this.togglePublicMode.style.background = "transparent";
      this.togglePublicMode.style.color = "var(--text-muted)";
      
      this.zkModeContent.style.display = "block";
      this.publicModeContent.style.display = "none";
    });

    this.togglePublicMode.addEventListener("click", () => {
      this.togglePublicMode.classList.add("active");
      this.togglePublicMode.style.background = "var(--color-blue)";
      this.togglePublicMode.style.color = "#fff";
      
      this.togglePrivateMode.classList.remove("active");
      this.togglePrivateMode.style.background = "transparent";
      this.togglePrivateMode.style.color = "var(--text-muted)";
      
      this.zkModeContent.style.display = "none";
      this.publicModeContent.style.display = "block";
    });

    this.publicDepositBtn.addEventListener("click", () => {
      const val = this.inputPublicAmount.value;
      this.viewModel.executePublicDeposit(val);
    });

    // Privacy Pools Action clicks
    this.deriveKeysBtn.addEventListener("click", () => this.showSignatureRequestModal());
    this.cancelSigBtn.addEventListener("click", () => this.hideSignatureRequestModal());
    this.confirmSigBtn.addEventListener("click", () => {
      this.hideSignatureRequestModal();
      this.viewModel.deriveKeys();
    });

    this.depositBtn.addEventListener("click", () => {
      const val = this.inputDepositAmount.value;
      this.viewModel.executeDeposit(val);
    });

    this.transferBtn.addEventListener("click", () => {
      const val = this.inputTransferAmount.value;
      this.viewModel.executePrivateTransfer(val);
    });

    // Run Swarm
    this.runSwarmBtn.addEventListener("click", () => {
      this.runSwarmBtn.disabled = true;
      this.runSwarmBtn.innerHTML = `<i class="animate-spin" data-lucide="loader"></i> Orchestrating Swarm...`;
      lucide.createIcons();
      this.viewModel.runSwarmScan();
    });
  }

  moveSlider(clientX) {
    const rect = this.visualizer.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    this.sliderBar.style.left = `${percentage}%`;
    this.satelliteAfterImg.style.clipPath = `inset(0 0 0 ${percentage}%)`;
  }

  switchTabsUI(tabId) {
    document.querySelectorAll(".widget-tab").forEach(tab => {
      tab.classList.remove("active");
      if (tab.getAttribute("data-tab") === tabId) tab.classList.add("active");
    });

    document.querySelectorAll(".widget-content-pane").forEach(pane => {
      pane.classList.remove("active");
      if (pane.id === `tab-${tabId}`) pane.classList.add("active");
    });
  }

  showSignatureRequestModal() {
    if (!this.model.state.walletConnected) {
      alert("Please connect your simulated wallet first.");
      return;
    }
    
    const payloadJson = JSON.stringify({
      domain: {
        name: "Privacy Pools",
        version: "2.0.0",
        chainId: 11155111,
        verifyingContract: "0x0000000000000000000000000000000000000000"
      },
      message: {
        owner: this.model.state.walletAddress,
        addressHash: "0x238a8e1dfc2d99d146c31bf0d8a562efad55c0e14bf9d29193150cd8e68cfb8a",
        message: "Derive cryptographic secret keys for privacy pool transactions on Sepolia. The keys derived will allow you to generate zero-knowledge proofs client-side.",
        revocableKeyIndex: "0x0"
      },
      primaryType: "SecretDerivation"
    }, null, 2);

    document.getElementById("sig-payload-content").innerText = payloadJson;
    this.sigModalBackdrop.classList.add("show");
  }

  hideSignatureRequestModal() {
    this.sigModalBackdrop.classList.remove("show");
  }

  appendConsoleLog(tag, message, type = "system") {
    const row = document.createElement("div");
    row.className = "console-log-row";
    row.innerHTML = `
      <span class="console-tag ${type}">${tag.toUpperCase()}</span>
      <span style="color:#ffffff">${new Date().toLocaleTimeString()}</span> - ${message}
    `;
    this.consoleLogs.appendChild(row);
    this.consoleLogs.scrollTop = this.consoleLogs.scrollHeight;
  }

  animateSatelliteReveal() {
    let pos = 100;
    const interval = setInterval(() => {
      pos -= 1.5;
      if (pos < 0) {
        pos = 0;
        clearInterval(interval);
      }
      this.sliderBar.style.left = `${pos}%`;
      this.satelliteAfterImg.style.clipPath = `inset(0 0 0 ${pos}%)`;
    }, 30);
  }

  triggerGlobeArc(proj) {
    if (!this.globeInstance) return;
    const dests = [
      { lat: 46.2, lng: 6.1 },
      { lat: 40.7, lng: -74.0 },
      { lat: 51.5, lng: -0.1 }
    ];
    const dest = dests[Math.floor(Math.random() * dests.length)];

    const arcsData = [{
      startLat: proj.lat,
      startLng: proj.lng,
      endLat: dest.lat,
      endLng: dest.lng,
      color: ['#10b981', '#3b82f6']
    }];

    this.globeInstance.arcsData(arcsData)
      .arcColor('color')
      .arcAltitude(0.25)
      .arcStroke(1.2)
      .arcDashLength(0.4)
      .arcDashGap(2)
      .arcDashAnimateTime(1500);

    setTimeout(() => {
      this.globeInstance.arcsData([]);
    }, 6000);
  }

  render(state, projects) {
    // 1. Wallet state render
    if (state.walletConnected) {
      this.connectWalletBtn.innerText = "Wallet Connected";
      this.connectWalletBtn.classList.add("connected");
      this.walletStatusIndicator.innerHTML = `<span class="status-dot"></span> Wallet: ${state.walletAddress.substring(0, 6)}...${state.walletAddress.substring(38)}`;
    } else {
      this.connectWalletBtn.innerText = "Simulate Wallet Connection";
      this.connectWalletBtn.classList.remove("connected");
      this.walletStatusIndicator.innerHTML = `<span class="status-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span> Wallet: Disconnected`;
    }

    // 2. Active project render
    const activeProj = projects[state.activeProjectId];
    if (activeProj) {
      // Inspector Info
      this.inspectorProjName.innerText = activeProj.name;
      this.inspectorProjLoc.innerText = `${activeProj.location} (${activeProj.lat.toFixed(3)}° N, ${activeProj.lng.toFixed(3)}° E)`;
      this.inspectorProjDesc.innerText = activeProj.description;
      this.inspectorNdviBaseline.innerText = activeProj.ndviBaseline.toFixed(2);
      this.inspectorNdviCurrent.innerText = activeProj.ndviCurrent.toFixed(2);
      this.inspectorNdviTarget.innerText = activeProj.ndviTarget.toFixed(2);
      this.inspectorEscrowBalance.innerText = `${activeProj.escrowBalance.toFixed(2)} ETH`;
      this.inspectorReleasedAmount.innerText = `${activeProj.releasedAmount.toFixed(2)} ETH`;
      
      this.inspectorSlopeAngle.innerText = `${activeProj.slopeAngle}°`;
      const currentRisk = Math.max(0, activeProj.slopeAngle * (1.0 - activeProj.ndviCurrent) * 2.2215);
      this.inspectorLandslideRisk.innerText = `${currentRisk.toFixed(1)}%`;
      
      this.satelliteBeforeImg.src = activeProj.beforeImage;
      this.satelliteAfterImg.src = activeProj.afterImage;

      // Progress calculation
      const progressPercent = Math.min(100, Math.max(0, ((activeProj.ndviCurrent - activeProj.ndviBaseline) / (activeProj.ndviTarget - activeProj.ndviBaseline)) * 100));
      this.ndviProgressBar.style.width = `${progressPercent}%`;
      this.ndviProgressVal.innerText = `${progressPercent.toFixed(0)}%`;

      // Update sidebar items
      document.querySelectorAll(".project-item").forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-id") === activeProj.id) {
          item.classList.add("active");
        }
      });
    }

    // 3. Stats top bar
    this.statEscrowLocked.innerText = `${state.totalEscrowLocked.toFixed(2)} ETH`;
    this.statTotalReleased.innerText = `${state.totalReleased.toFixed(2)} ETH`;

    // 4. Notes dropdown update
    this.selectTransferNote.innerHTML = "";
    if (state.notes.length === 0) {
      const opt = document.createElement("option");
      opt.innerText = "No notes available. Make a deposit first.";
      opt.disabled = true;
      this.selectTransferNote.appendChild(opt);
    } else {
      state.notes.forEach((note, index) => {
        if (note.status === "ACTIVE") {
          const opt = document.createElement("option");
          opt.value = index;
          const noteVal = Number(note.value) || 0;
          const commitmentStr = note.commitment ? String(note.commitment) : "";
          opt.innerText = `${noteVal.toFixed(3)} ETH (Commitment: ${commitmentStr.substring(0, 10)}...)`;
          this.selectTransferNote.appendChild(opt);
        }
      });
    }

    // 5. Transaction feed render
    this.txTableBody.innerHTML = "";
    state.txList.forEach(tx => {
      const row = document.createElement("tr");
      let badgeClass = "pending";
      if (tx.status === "Attested") badgeClass = "attested";
      if (tx.status === "Released") badgeClass = "released";

      row.innerHTML = `
        <td><span class="tx-type ${tx.type.toLowerCase()}">${tx.type}</span></td>
        <td><span class="tx-method">${tx.method}</span></td>
        <td>${tx.amount}</td>
        <td><span class="tx-status-badge ${badgeClass}">${tx.status}</span></td>
        <td><a href="#" class="tx-hash-link" onclick="alert('Mock Tx: ${tx.hash}'); return false;">${tx.hash}</a></td>
        <td style="color:var(--text-faint)">${tx.date}</td>
      `;
      this.txTableBody.appendChild(row);
    });

    // 6. Privacy Pools Widgets log rendering
    this.renderPrivacyPoolLogs(state);

    // 7. Reset Scan button if done
    if (state.agentDebateStatus === "idle") {
      this.runSwarmBtn.disabled = false;
      this.runSwarmBtn.innerHTML = `<i data-lucide="play" style="width:12px; height:12px; margin-right:4px;"></i> Run Swarm Scan`;
      lucide.createIcons();
    }
  }

  renderPrivacyPoolLogs(state) {
    // Keys log
    if (state.keysDerived) {
      this.deriveKeysBtn.innerText = "Keys Derived (EIP-712 cached)";
      this.deriveKeysBtn.classList.add("success");
      this.keysDerivationStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>Protocol Keys Derived Successfully: Cached client-side.</span></div>
      `;
      this.derivedKeysDetails.innerHTML = `
        <div class="key-row">
          <span class="key-label">Public Viewing Key</span>
          <span class="key-val">${state.derivedKeys.viewingKey.substring(0, 16)}...</span>
        </div>
        <div class="key-row">
          <span class="key-label">Identity Nullifier</span>
          <span class="key-val">${state.derivedKeys.identityNullifier.substring(0, 16)}...</span>
        </div>
        <div class="key-row">
          <span class="key-label">Revocable Key Index</span>
          <span class="key-val">${state.derivedKeys.revocableKeyIndex}</span>
        </div>
      `;
    } else {
      this.deriveKeysBtn.innerText = "Derive Protocol Keys";
      this.deriveKeysBtn.classList.remove("success");
      this.keysDerivationStatus.innerHTML = `<span style="color:var(--text-faint)">Status: Idle</span>`;
      this.derivedKeysDetails.innerHTML = `<div style="color:var(--text-faint); font-style:italic; font-size:10px; text-align:center;">No keys derived yet. Sign the derivation payload.</div>`;
    }

    // Deposit logs
    if (state.depositStatus === "idle") {
      this.depositFlowStatus.innerHTML = `<span style="color:var(--text-faint)">Status: Waiting for Input</span>`;
      this.depositBtn.innerText = "Deposit to Privacy Pool";
      this.depositBtn.classList.remove("success");
    } else if (state.depositStatus === "submitting") {
      this.depositFlowStatus.innerHTML = `<div class="flow-log-line"><i class="flow-log-icon blue animate-spin" data-lucide="loader"></i> <span>PoolSession: Initializing deposit of ${state.depositAmount} ETH...</span></div>`;
    } else if (state.depositStatus === "attesting") {
      this.depositFlowStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>Submitting deposit transaction on Sepolia...</span></div>
        <div class="flow-log-line"><i class="flow-log-icon blue animate-spin" data-lucide="loader"></i> <span>Waiting for ASP (Attestation Service Provider) attestation...</span></div>
      `;
    } else if (state.depositStatus === "syncing") {
      this.depositFlowStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>ASP Attestation received! Note registered in pool.</span></div>
        <div class="flow-log-line"><i class="flow-log-icon blue animate-spin" data-lucide="loader"></i> <span>Syncing Note State: session.discoverNotes()...</span></div>
      `;
    } else if (state.depositStatus === "done") {
      this.depositBtn.innerText = "Deposit Settled";
      this.depositBtn.classList.add("success");
      this.depositFlowStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>Deposit successful. Note synced and active in pool.</span></div>
      `;
    }

    // Transfer logs
    if (state.transferStatus === "idle") {
      this.transferFlowStatus.innerHTML = `<span style="color:var(--text-faint)">Status: Idle</span>`;
      this.transferBtn.innerText = "Send zk-Private Transfer";
      this.transferBtn.classList.remove("success");
    } else if (state.transferStatus === "preparing") {
      this.transferFlowStatus.innerHTML = `<div class="flow-log-line"><i class="flow-log-icon blue animate-spin" data-lucide="loader"></i> <span>session.prepareTransfer(): Generating zero-knowledge membership proof...</span></div>`;
    } else if (state.transferStatus === "relaying") {
      this.transferFlowStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>ZK Proof Generated (Sepolia membership verified).</span></div>
        <div class="flow-log-line"><i class="flow-log-icon blue animate-spin" data-lucide="loader"></i> <span>Broadcasting to 0xBow Relayer (Processor: 0x4Ba5...f1f7)...</span></div>
      `;
    } else if (state.transferStatus === "done") {
      this.transferBtn.innerText = "Transfer Relayed";
      this.transferBtn.classList.add("success");
      this.transferFlowStatus.innerHTML = `
        <div class="flow-log-line"><i class="flow-log-icon green" data-lucide="check-circle-2"></i> <span>Relayer Transfer Landed! Tx settled.</span></div>
      `;
    }

    lucide.createIcons();
  }
}
